const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const source = path.join(dist, 'assets', 'node_modules');
const target = path.join(dist, 'assets', 'vendor');

if (!fs.existsSync(source)) {
  console.log('No assets/node_modules folder found, nothing to rename.');
  process.exit(0);
}

fs.renameSync(source, target);

const textExtensions = new Set(['.js', '.html', '.css', '.json', '.map', '.txt']);
const replacements = [
  ['assets/node_modules/', 'assets/vendor/'],
  ['assets\\/node_modules\\/', 'assets\\/vendor\\/'],
];
let changed = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const original = fs.readFileSync(full, 'utf8');
    let updated = original;
    for (const [from, to] of replacements) updated = updated.split(from).join(to);
    if (updated !== original) {
      fs.writeFileSync(full, updated);
      changed += 1;
    }
  }
}

walk(dist);
console.log(`Renamed assets/node_modules to assets/vendor and updated ${changed} file(s).`);