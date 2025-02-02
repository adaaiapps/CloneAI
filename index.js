#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { bold, green } = require('kleur');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const prompts = require('prompts');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node'); // Untuk operasi HTTP (opsional)
const { execSync } = require('child_process');

// Konstanta untuk path direktori Pinokio
const PINOKIO_HOME = "C:/pinokio/api";

// Fungsi untuk menjalankan gepeto_ai.py dan mendapatkan hasil analisis
function analyzeRepo(repoPath, apiKey, aiProvider) {
    try {
        // Jalankan gepeto_ai.py sebagai subprocess
        const result = execSync(
            `python ${__dirname}/gepeto_ai.py "${repoPath}" "${apiKey}" "${aiProvider}"`, 
            { cwd: __dirname }
        ).toString();
        return JSON.parse(result); // Parse output JSON
    } catch (error) {
        console.error("❌ Gagal menganalisis repositori:", error);
        return null;
    }
}

// Fungsi untuk membuat proyek baru
async function createProject(name, gitUrl, iconUrl, apiKey, aiProvider) {
    const argv = yargs(hideBin(process.argv)).parse();
    let response;

    // Ambil input dari command line atau prompt
    if (name) {
        response = {
            name: decodeURIComponent(name),
            git: (gitUrl ? decodeURIComponent(gitUrl) : ""),
            icon: (iconUrl ? decodeURIComponent(iconUrl) : ""),
            install: (argv.install ? decodeURIComponent(argv.install) : "requirements.txt"),
            start: (argv.start ? decodeURIComponent(argv.start) : "app.py"),
            apiKey: (apiKey ? decodeURIComponent(apiKey) : ""),
            aiProvider: (aiProvider ? decodeURIComponent(aiProvider) : "openai"),
        };
    } else {
        response = await prompts([
            {
                type: 'text',
                initial: 'my-app',
                name: 'name',
                message: 'Project name',
            },
            {
                type: 'text',
                name: 'icon',
                message: 'Icon URL (Leave empty to use the default icon)',
            },
            {
                type: 'text',
                name: 'git',
                message: '3rd party git URL (Leave empty if not using an external repository)',
            },
            {
                type: 'text',
                name: 'start',
                message: 'App python file (Leave empty to use the default)',
                initial: "app.py",
            },
            {
                type: 'text',
                name: 'install',
                message: 'PIP install file (Leave empty to use the default)',
                initial: "requirements.txt",
            },
            {
                type: 'text',
                name: 'apiKey',
                message: 'AI API Key',
            },
            {
                type: 'select',
                name: 'aiProvider',
                message: 'AI Provider',
                choices: [
                    { title: 'OpenAI', value: 'openai' },
                    { title: 'Gemini', value: 'gemini' },
                ],
            },
        ]);
    }

    // Perbaikan utama: menghindari duplikasi variabel
    const { 
        name: projectName, 
        git: gitUrlResponse,
        icon: iconUrlResponse,
        install,
        start,
        apiKey: apiKeyInput,
        aiProvider: aiProviderInput 
    } = response;

    // Tentukan URL Git yang akan digunakan
    const url = gitUrlResponse ? gitUrlResponse : gitUrl;
    const template = url ? "templates/1" : "templates/2";
    const dest = path.resolve(PINOKIO_HOME, projectName);
    const src = path.resolve(__dirname, template);

    // 1. Salin file template ke direktori proyek
    fs.cpSync(src, dest, { recursive: true });

    // 2. Update install.js dengan URL Git (jika ada)
    if (url) {
        const installFile = path.resolve(dest, "install.js");
        let installContent = fs.readFileSync(installFile, "utf8");
        installContent = installContent.replaceAll("<GIT_REPOSITORY>", url);
        fs.writeFileSync(installFile, installContent);
    }

    // 3. Update pinokio.js dengan nama proyek
    if (projectName) {
        const pinokioFile = path.resolve(dest, "pinokio.js");
        let pinokioContent = fs.readFileSync(pinokioFile, "utf8");
        pinokioContent = pinokioContent.replaceAll("<TITLE>", projectName);
        fs.writeFileSync(pinokioFile, pinokioContent);
    }

    // 4. Update install.js dengan file instalasi yang diberikan
    const installFile = path.resolve(dest, "install.js");
    let installContent = fs.readFileSync(installFile, "utf8");
    installContent = installContent.replaceAll("<INSTALL_FILE>", install);
    fs.writeFileSync(installFile, installContent);

    // 5. Update start.js dengan file start yang diberikan
    const startFile = path.resolve(dest, "start.js");
    let startContent = fs.readFileSync(startFile, "utf8");
    startContent = startContent.replaceAll("<START_FILE>", start);
    fs.writeFileSync(startFile, startContent);

    // 6. Jika tidak ada URL Git, buat file requirements.txt dan app.py
    if (!url) {
        const requirementsFile = path.resolve(dest, install);
        fs.renameSync(path.resolve(dest, "requirements.txt"), requirementsFile);

        const appFile = path.resolve(dest, start);
        fs.renameSync(path.resolve(dest, "app.py"), appFile);
    }

    // 7. Handle icon
    let iconPath = "icon.png";
    if (iconUrlResponse) {
        try {
            const { default: fetch } = await import('node-fetch');
            const res = await fetch(iconUrlResponse);
            if (!res.ok) {
                throw new Error(`Failed to fetch icon: ${res.statusText}`);
            }
            const contentType = res.headers.get('content-type');
            const extension = contentType.split('/')[1];
            iconPath = `icon.${extension}`;
            const iconFile = path.resolve(dest, iconPath);
            const fileStream = fs.createWriteStream(iconFile);
            await res.body.pipe(fileStream);
        } catch (error) {
            console.error("❌ Gagal mengunduh ikon:", error);
        }
    }

    // Update pinokio.js dengan path icon
    const pinokioFile = path.resolve(dest, "pinokio.js");
    let pinokioContent = fs.readFileSync(pinokioFile, "utf8");
    pinokioContent = pinokioContent.replaceAll("<ICON>", iconPath);
    fs.writeFileSync(pinokioFile, pinokioContent);

    // 8. Buat README.md jika ada URL Git
    if (url) {
        const readmeContent = `# ${projectName}\n\nA pinokio script for ${url}\n`;
        const readmeFile = path.resolve(dest, "README.md");
        fs.writeFileSync(readmeFile, readmeContent);
    }

    // 9. Buat .gitignore
    const gitIgnoreContent = "node_modules\n.DS_Store\n";
    const gitIgnoreFile = path.resolve(dest, ".gitignore");
    fs.writeFileSync(gitIgnoreFile, gitIgnoreContent);

    // 10. Inisialisasi Git
    await git.init({ fs, dir: dest });
    await git.add({ fs, dir: dest, filepath: '.' });
    await git.commit({
        fs,
        dir: dest,
        author: { name: 'gepeto', email: 'gepeto@pinokio.computer' },
        message: 'init',
    });
    await git.branch({ fs, dir: dest, ref: 'main' });

    console.log(`✅ Proyek "${projectName}" berhasil dibuat di ${dest}`);
}

// Panggil fungsi untuk membuat proyek
if (require.main === module) {
    const name = process.argv[2];
    const git = process.argv[3];
    const icon = process.argv[4];
    const apiKey = process.argv[5];
    const aiProvider = process.argv[6];

    // Validasi argumen
    if (!name || !apiKey || !aiProvider) {
        console.error('Error: Please provide all required arguments.');
        process.exit(1);
    }

    createProject(name, git, icon, apiKey, aiProvider);
}

module.exports = { createProject };