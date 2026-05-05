const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src', 'db', 'schema.sql');
const targetDir = path.join(root, 'dist', 'db');
const target = path.join(targetDir, 'schema.sql');

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
