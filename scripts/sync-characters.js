// Auto-generates characters/.characters-cache.json from files in characters/.
// Run: node scripts/sync-characters.js
// (Optional fallback when the browser cannot read directory listings.)

const fs = require('fs');
const path = require('path');

const charactersDir = path.join(__dirname, '..', 'characters');
const outputFile = path.join(charactersDir, '.characters-cache.json');
const imageRe = /\.(png|jpe?g|gif|webp)$/i;

const files = fs
  .readdirSync(charactersDir)
  .filter(name => imageRe.test(name) && !name.startsWith('.'))
  .sort((a, b) => a.localeCompare(b));

fs.writeFileSync(outputFile, `${JSON.stringify(files, null, 2)}\n`, 'utf8');
console.log(`Updated ${path.relative(process.cwd(), outputFile)} (${files.length} sprites).`);
