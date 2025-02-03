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
        
        const installMatch = result.match(/install_script:\s*(.+)/);
        const startMatch = result.match(/start_script:\s*(.+)/);
        const descriptionMatch = result.match(/description:\s*(.+)/);
        const requirementsMatch = result.match(/requirements:\s*(.+)/);

        return {
            install_script: installMatch ? installMatch[1].trim() : 'uv pip install -r requirements.txt',
            start_script: startMatch ? startMatch[1].trim() : 'python app.py',
            description: descriptionMatch ? descriptionMatch[1].trim() : 'A Pinokio project',
            requirements: requirementsMatch ? requirementsMatch[1].trim() : '# Default dependencies\\nflask\\nnumpy\\nrequests\\n',
            terminal_regex: ''
        };
    } catch (error) {
        console.error("❌ Gagal menganalisis repositori:", error);
         return {
                install_script: 'uv pip install -r requirements.txt',
                start_script: 'python app.py',
                description: 'A Pinokio project',
                requirements: '# Default dependencies\\nflask\\nnumpy\\nrequests\\n',
                terminal_regex: ''
            };
    }
}

// Fungsi untuk mencari dan membaca file .env
function findAndReadEnvFile(repoPath) {
    const envFilePath = path.resolve(repoPath, ".env");
    if (fs.existsSync(envFilePath)) {
        try {
            const envContent = fs.readFileSync(envFilePath, "utf8");
            return envContent;
        } catch (error) {
            console.error("❌ Gagal membaca file .env:", error);
            return null;
        }
    }
    return null;
}

// Fungsi untuk membuat file ENVIRONMENT
function createEnvironmentFile(dest, envContent) {
    const environmentFilePath = path.resolve(dest, "ENVIRONMENT");
    try {
        if (envContent) {
            fs.writeFileSync(environmentFilePath, envContent);
            console.log('✅ File ENVIRONMENT berhasil dibuat dari file .env.');
        } else {
            const defaultEnvContent = `
# Silakan isi variabel lingkungan di bawah ini
API_KEY=your_api_key_here
DATABASE_URL=your_database_url_here
`;
            fs.writeFileSync(environmentFilePath, defaultEnvContent);
            console.log('✅ File ENVIRONMENT berhasil dibuat dengan template default.');
        }
    } catch (error) {
        console.error("❌ Gagal membuat file ENVIRONMENT:", error);
    }
}

// Fungsi untuk membuat proyek baru
async function createProject(name, gitUrl, icon, apiKey, aiProvider) {
    const argv = yargs(hideBin(process.argv)).parse();
    let response;

    // Ambil input dari command line atau prompt
    if (name) {
        response = {
            name: decodeURIComponent(name),
            git: (gitUrl ? decodeURIComponent(gitUrl) : ""),
            icon: (icon ? decodeURIComponent(icon) : ""),
            install: (argv.install ? decodeURIComponent(argv.install) : "requirements.txt"),
            start: (argv.start ? decodeURIComponent(argv.start) : "app.py"),
            apiKey: (apiKey ? decodeURIComponent(apiKey) : ""),
            aiProvider: (aiProvider ? decodeURIComponent(aiProvider) : "openai"),
        };
    } else {
        response = await prompts([{
            type: 'text',
            initial: 'my-app',
            name: 'name',
            message: '',
            onRender(kleur) {
                this.msg = `${kleur.green('Project name')}`;
            }
        }, {
            type: 'text',
            name: 'icon',
            message: '',
            onRender(kleur) {
                this.msg = `${kleur.green('Icon URL')} (Leave empty to use the default icon)`;
            }
        }, {
            type: 'text',
            name: 'git',
            message: '',
            onRender(kleur) {
                this.msg = `${kleur.green('3rd party git URL')} (Leave empty if not using an external repository)`;
            }
        }, {
            type: 'text',
            name: 'start',
            message: '',
            initial: "app.py",
            onRender(kleur) {
                this.msg = `${kleur.green('App python file')} (Leave empty to use the default)`;
            }
        }, {
            type: 'text',
            name: 'apiKey',
            message: '',
            onRender(kleur) {
                this.msg = `${kleur.green('AI API Key')}`;
            }
        }, {
            type: 'select',
            name: 'aiProvider',
            message: '',
            choices: [
                { title: 'OpenAI', value: 'openai' },
                { title: 'Gemini', value: 'gemini' },
            ],
            onRender(kleur) {
                this.msg = `${kleur.green('AI Provider')}`;
            }
        }]);
    }

    const { name: projectName, git: gitUrlInput, icon: iconUrl, install, start, apiKey: apiKeyInput, aiProvider: aiProviderInput } = response;
    const url = gitUrlInput.trim().length > 0 ? gitUrlInput.trim() : null;
    const template = url ? "templates/1" : "templates/2";
    const dest = path.resolve(PINOKIO_HOME, projectName);
    const src = path.resolve(__dirname, template);

    // 1. Copy common files
    try {
        fs.cpSync(src, dest, { recursive: true });
    } catch (error) {
        console.error("❌ Gagal menyalin file template:", error);
        return;
    }

    // 2. Replace $GIT_REPOSITORY from install.js
    if (url) {
        const installFile = path.resolve(dest, "install.js");
        try {
            let str = fs.readFileSync(installFile, "utf8");
            str = str.replaceAll("<GIT_REPOSITORY>", url);
            fs.writeFileSync(installFile, str);
        } catch (error) {
            console.error("❌ Gagal memodifikasi install.js:", error);
        }
    }

    // 3. Replace $TITLE from pinokio.js
    if (projectName) {
        const pinokioFile = path.resolve(dest, "pinokio.js");
        try {
            let str = fs.readFileSync(pinokioFile, "utf8");
            str = str.replaceAll("<TITLE>", projectName);
            fs.writeFileSync(pinokioFile, str);
        } catch (error) {
            console.error("❌ Gagal memodifikasi pinokio.js:", error);
        }
    }

    // 4. Icon handling
    let iconPath = "icon.png";
    if (iconUrl) {
        try {
            const streamPipeline = promisify(pipeline);
            const res = await fetch(iconUrl);
            if (!res.ok) {
                throw new Error(`unexpected response ${res.statusText}`);
            }
            const contentType = res.headers.get('content-type');
            const extension = contentType.split('/')[1];
            iconPath = `icon.${extension}`;
            const iconFile = path.resolve(dest, iconPath);
            await streamPipeline(res.body, fs.createWriteStream(iconFile));
        } catch (error) {
            console.error("❌ Gagal mengunduh ikon:", error);
        }
    }

    let pinokioFile = path.resolve(dest, "pinokio.js");
    try {
        let str = fs.readFileSync(pinokioFile, "utf8");
        str = str.replaceAll("<ICON>", iconPath);
        fs.writeFileSync(pinokioFile, str);
    } catch (error) {
        console.error("❌ Gagal memodifikasi pinokio.js:", error);
    }

    // Autogenerate README
    if (url) {
        const readme = `# ${projectName}\n\nA pinokio script for ${url}\n`;
        const readmeFile = path.resolve(dest, "README.md");
        try {
            fs.writeFileSync(readmeFile, readme);
        } catch (error) {
            console.error("❌ Gagal membuat README.md:", error);
        }
    }

    // 5. Add .gitignore
    const gitIgnore = path.resolve(dest, ".gitignore");
    const gitIgnoreContent = [
        "node_modules",
        ".DS_Store"
    ].join("\n");
    try {
        fs.writeFileSync(gitIgnore, gitIgnoreContent);
    } catch (error) {
        console.error("❌ Gagal membuat .gitignore:", error);
        return;
    }

    // 6. Git init
    try {
        await git.init({ fs, dir: dest, defaultBranch: 'main' });
        console.log('✅ Repository initialized successfully.');
    } catch (error) {
        console.error("❌ Gagal menginisialisasi Git:", error);
        return;
    }

    // 7. Git add
    try {
        await git.add({ fs, dir: dest, filepath: '.' });
        console.log('✅ Files added to Git.');
    } catch (error) {
        console.error("❌ Gagal menambahkan file ke Git:", error);
        return;
    }

    // 8. Git commit
    try {
        const sha = await git.commit({
            fs,
            dir: dest,
            author: { name: 'gepeto', email: 'gepeto@pinokio.computer' },
            message: 'init'
        });
        console.log('✅ Git commit successful.');
    } catch (error) {
        console.error("❌ Gagal melakukan commit Git:", error);
        return;
    }

    // Jika URL Git ada, analisis repositori dan cari file .env
    if (url) {
        const repoName = gitUrlInput.split("/").pop().replace(".git", "");
        const repoPath = path.resolve(dest, repoName);

        // Cari dan baca file .env
        const envContent = findAndReadEnvFile(repoPath);

        // Buat file ENVIRONMENT
        createEnvironmentFile(dest, envContent);

        // Lanjutkan dengan analisis AI
        const analysis = analyzeRepo(repoPath, apiKeyInput, aiProviderInput);
        
        // Update install.js
        const installFile = path.resolve(dest, "install.js");
        try {
            let installContent = fs.readFileSync(installFile, "utf8");
            console.log("Install file content before:", installContent)
            installContent = installContent.replace(
                '"uv pip install -r <INSTALL_FILE>"',
                `"${analysis.install_script || 'uv pip install -r requirements.txt'}"`
            );
            console.log("Install file content after:", installContent)
            fs.writeFileSync(installFile, installContent);
        } catch (error) {
            console.error("❌ Gagal memodifikasi install.js:", error);
        }

        // Update start.js
        const startFile = path.resolve(dest, "start.js");
        try {
            let startContent = fs.readFileSync(startFile, "utf8");
            console.log("Start file content before:", startContent)
            startContent = startContent.replace(
                '"python <START_FILE>"',
                `"${analysis.start_script || 'python app.py'}"`
            );
             console.log("Start file content after:", startContent)
            fs.writeFileSync(startFile, startContent);
        } catch (error) {
            console.error("❌ Gagal memodifikasi start.js:", error);
        }

        // Update pinokio.js description
        try {
            let pinokioContent = fs.readFileSync(pinokioFile, "utf8");
            console.log("Pinokio file content before:", pinokioContent)
            pinokioContent = pinokioContent.replace(
                'description: ""',
                `description: "${analysis.description || 'A Pinokio project'}"`
            );
            console.log("Pinokio file content after:", pinokioContent)
            fs.writeFileSync(pinokioFile, pinokioContent);
        } catch (error) {
            console.error("❌ Gagal memodifikasi pinokio.js:", error);
        }

        // Update requirements.txt
        if (analysis.requirements) {
            const requirementsFile = path.resolve(dest, "requirements.txt");
            try {
                fs.writeFileSync(requirementsFile, analysis.requirements);
                console.log('✅ File requirements.txt berhasil dibuat berdasarkan analisis AI.');
            } catch (error) {
                console.error("❌ Gagal membuat requirements.txt:", error);
            }
        }
    } else {
        // Jika tidak ada URL Git, buat file ENVIRONMENT dengan template default
        createEnvironmentFile(dest, null);

        // Create default files if not git url
        const requirementsFile = path.resolve(dest, install);
        try {
            if (!fs.existsSync(requirementsFile)) {
                await fs.promises.writeFile(requirementsFile, "# Default dependencies\\nflask\\nnumpy\\nrequests\\n"); // Fallback
            }
        } catch (error) {
            console.error("❌ Gagal membuat atau memindahkan requirements.txt:", error);
        }

        const appFile = path.resolve(dest, start);
        try {
            if (!fs.existsSync(appFile)) {
                await fs.promises.writeFile(appFile, "# Default Python script\\nprint('Hello, Pinokio!')\\n"); // Fallback
            }
        } catch (error) {
            console.error("❌ Gagal membuat app.py:", error);
        }
    }
    console.log(`✅ Proyek "${projectName}" berhasil dibuat di ${dest}`);
}

// Panggil fungsi untuk membuat proyek
if (require.main === module) {
    const name = process.argv[2];
    const gitUrl = process.argv[3];
    const icon = process.argv[4];
    const apiKey = process.argv[5];
    const aiProvider = process.argv[6];

    // Validasi argumen
    if (!name || !apiKey || !aiProvider) {
        console.error('Error: Please provide all required arguments.');
        process.exit(1);
    }

    createProject(name, gitUrl, icon, apiKey, aiProvider);
}

module.exports = { createProject };
