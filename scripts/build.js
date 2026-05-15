const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const allowedExts = new Set([".html", ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"]);
const blockedNames = new Set(["server.js"]);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile()) {
        continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (blockedNames.has(entry.name) || !allowedExts.has(ext)) {
        continue;
    }
    fs.copyFileSync(path.join(root, entry.name), path.join(dist, entry.name));
}

console.log(`Static files copied to ${dist}`);
