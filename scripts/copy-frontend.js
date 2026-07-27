const fs = require('fs');
const path = require('path');

const src = process.cwd();
const dest = path.join(src, 'frontend-dist');
const exclude = new Set([
    'src-tauri', 'node_modules', '.git', 'dist', '.github',
    '.claude', 'frontend-dist', 'scripts', '.DS_Store'
]);

function copyDir(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (exclude.has(entry.name)) continue;
        const s = path.join(srcDir, entry.name);
        const d = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDir(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

// Clean and recreate
if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
}
copyDir(src, dest);
console.log('Frontend assets copied to frontend-dist/');
