const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware untuk parsing JSON dan form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (index.html)
app.use(express.static(path.join(__dirname)));

// Endpoint untuk membuat proyek
app.post('/create-project', (req, res) => {
    const { name, git, icon, aiProvider, apiKey } = req.body;

    if (!name || !apiKey || !aiProvider) {
        return res.status(400).json({ error: 'Name, API Key, and AI Provider are required.' });
    }

    try {
        // Jalankan index.js dengan parameter yang diberikan
        const result = execSync(
            `node index.js "${name}" "${git || ''}" "${icon || ''}" "${apiKey}" "${aiProvider}"`,
            { cwd: __dirname }
        ).toString();

        // Kirim respons ke client
        res.json({ success: true, message: 'Project created successfully!', output: result });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project.', details: error.message });
    }
});

// Jalankan server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});