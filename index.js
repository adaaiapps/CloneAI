#!/usr/bin/env node
// 1. npx gepeto <name> <git url>: external git
// 2. npx gepeto <name>: no external git
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
        return JSON.parse(result); // Parse output JSON
    } catch (error) {
        console.error("❌ Gagal menganalisis repositori:", error);
        return null;
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
            name: 'install',
            message: '',
            initial: "requirements.txt",
            onRender(kleur) {
                this.msg = `${kleur.green('PIP install file')} (Leave empty to use the default)`;
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

    // 4. Replace <INSTALL_FILE> with response.install
    const installFile = path.resolve(dest, "install.js");
    try {
        let install_str = fs.readFileSync(installFile, "utf8");
        install_str = install_str.replaceAll("<INSTALL_FILE>", install);
        fs.writeFileSync(installFile, install_str);
    } catch (error) {
        console.error("❌ Gagal memodifikasi install.js:", error);
    }

    // 5. Replace <START_FILE> with response.start
    const startFile = path.resolve(dest, "start.js");
    try {
        let start_str = fs.readFileSync(startFile, "utf8");
        start_str = start_str.replaceAll("<START_FILE>", start);
        fs.writeFileSync(startFile, start_str);
    } catch (error) {
        console.error("❌ Gagal memodifikasi start.js:", error);
    }

    // If url doesn't exist => means start fresh, so create those files
    // if url exists => assume the files exist in the cloned repo
    if (!url) {
        // 6. If url does not exist, it's template/2 => create an empty start file and install file
        const requirementsFile = path.resolve(dest, install);
        try {
            if (!fs.existsSync(requirementsFile)) {
                await fs.promises.writeFile(requirementsFile, "");
            }
            await fs.promises.rename(path.resolve(dest, "requirements.txt"), requirementsFile);
        } catch (error) {
            console.error("❌ Gagal membuat atau memindahkan requirements.txt:", error);
        }

        const appFile = path.resolve(dest, start);
        try {
            await fs.promises.rename(path.resolve(dest, "app.py"), appFile);
        } catch (error) {
            console.error("❌ Gagal memindahkan app.py:", error);
        }
    }

    // 7. Icon handling
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

    // 8. Add .gitignore
    const gitIgnore = path.resolve(dest, ".gitignore");
    const gitIgnoreContent = [
        "node_modules",
        ".DS_Store"
    ].join("\n");
    try {
        fs.writeFileSync(gitIgnore, gitIgnoreContent);
    } catch (error) {
        console.error("❌ Gagal membuat .gitignore:", error);
    }

    // 9. Git init
    try {
        await git.init({ fs, dir: dest, defaultBranch: 'main' });
        console.log('✅ Repository initialized successfully.');
    } catch (error) {
        console.error("❌ Gagal menginisialisasi Git:", error);
        return;
    }

    // 10. Git add
    try {
        await git.add({ fs, dir: dest, filepath: '.' });
        console.log('✅ Files added to Git.');
    } catch (error) {
        console.error("❌ Gagal menambahkan file ke Git:", error);
        return;
    }

    // 11. Git commit
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

    // 12. Git branch main
    /*try {
        await git.branch({ fs, dir: dest, ref: 'main' });
        console.log('✅ Git branch "main" created.');
    } catch (error) {
        console.error("❌ Gagal membuat branch Git:", error);
        return;
    }
    */
   
    // If git url is present, analyze the repo
    if (url) {
        const repoName = gitUrlInput.split("/").pop().replace(".git", "");
        const repoPath = path.resolve(dest, repoName);
        const analysis = analyzeRepo(repoPath, apiKeyInput, aiProviderInput);
        if (analysis && analysis.pinokio_script) {
            // Update install.js with dependencies
            const installFile = path.resolve(dest, "install.js");
            try {
                let installContent = fs.readFileSync(installFile, "utf8");
                installContent = installContent.replace(
                    '"uv pip install -r <INSTALL_FILE>"',
                    `"${analysis.install_script}"`
                );
                fs.writeFileSync(installFile, installContent);
            } catch (error) {
                console.error("❌ Gagal memodifikasi install.js:", error);
            }

            // Update start.js with command to run the app
            const startFile = path.resolve(dest, "start.js");
            try {
                let startContent = fs.readFileSync(startFile, "utf8");
                startContent = startContent.replace(
                    '"python <START_FILE>"',
                    `"${analysis.start_script}"`
                );
                fs.writeFileSync(startFile, startContent);
            } catch (error) {
                console.error("❌ Gagal memodifikasi start.js:", error);
            }

            // Update pinokio.js with description
            const pinokioFile = path.resolve(dest, "pinokio.js");
            try {
                let pinokioContent = fs.readFileSync(pinokioFile, "utf8");
                pinokioContent = pinokioContent.replace(
                    '"<DESCRIPTION>"',
                    `"${analysis.description}"`
                );
                fs.writeFileSync(pinokioFile, pinokioContent);
            } catch (error) {
                console.error("❌ Gagal memodifikasi pinokio.js:", error);
            }

            // Update requirements.txt
            if (analysis.requirements) {
                const requirementsFile = path.resolve(dest, "requirements.txt");
                try {
                    fs.writeFileSync(requirementsFile, analysis.requirements);
                } catch (error) {
                    console.error("❌ Gagal memodifikasi requirements.txt:", error);
                }
            }
        } else {
            console.error("❌ Gagal menganalisis repositori atau tidak ada hasil yang valid.");
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