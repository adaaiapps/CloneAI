const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Path ke direktori Pinokio
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

// Ambil argumen dari command line
const name = process.argv[2];
const git = process.argv[3];
const icon = process.argv[4];
const apiKey = process.argv[5];
const aiProvider = process.argv[6];

if (!name || !apiKey || !aiProvider) {
    console.error('Error: Please provide all required arguments.');
    process.exit(1);
}

// Path ke direktori proyek baru
const dest = path.resolve(PINOKIO_HOME, name);

// Salin template ke direktori proyek
const template = git ? "templates/1" : "templates/2";
const src = path.resolve(__dirname, template);
fs.cpSync(src, dest, { recursive: true });

// Jika URL Git diberikan, analisis repositori
if (git) {
    const repoName = git.split("/").pop().replace(".git", "");
    const repoPath = path.resolve(dest, repoName);

    // Kloning repositori
    if (!fs.existsSync(repoPath)) {
        execSync(`git clone ${git} ${repoPath}`, { cwd: dest });
    }

    // Analisis repositori dengan AI
    const analysis = analyzeRepo(repoPath, apiKey, aiProvider);
    if (analysis && analysis.pinokio_script) {
        // Update install.js dengan dependensi
        const installFile = path.resolve(dest, "install.js");
        let installContent = fs.readFileSync(installFile, "utf8");
        installContent = installContent.replace(
            '"pip install -r requirements.txt"',
            `"${analysis.install_script}"`
        );
        fs.writeFileSync(installFile, installContent);

        // Update start.js dengan perintah menjalankan aplikasi
        const startFile = path.resolve(dest, "start.js");
        let startContent = fs.readFileSync(startFile, "utf8");
        startContent = startContent.replace(
            '"python app.py"',
            `"${analysis.start_script}"`
        );
        fs.writeFileSync(startFile, startContent);

        // Update pinokio.js dengan skrip Pinokio yang dihasilkan oleh AI
        const pinokioFile = path.resolve(dest, "pinokio.js");
        fs.writeFileSync(pinokioFile, analysis.pinokio_script);
    } else {
        console.error("❌ Gagal menganalisis repositori atau tidak ada hasil yang valid.");
    }
}

// Update icon jika diberikan
if (icon) {
    const pinokioFile = path.resolve(dest, "pinokio.js");
    let pinokioContent = fs.readFileSync(pinokioFile, "utf8");
    pinokioContent = pinokioContent.replace(
        '"icon.png"',
        `"${icon}"`
    );
    fs.writeFileSync(pinokioFile, pinokioContent);
}

console.log(`✅ Proyek "${name}" berhasil dibuat di ${dest}`);