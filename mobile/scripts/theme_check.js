const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '../src/screens');
const alreadyDone = new Set([
  'auth/LoginScreen.tsx',
  'home/HomeScreen.tsx',
  'order/OrderListScreen.tsx'
]);

function getAllTsx(dir, base) {
  base = base || '';
  const items = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const rel = path.join(base, f);
    if (fs.statSync(full).isDirectory()) {
      items.push(...getAllTsx(full, rel));
    } else if (f.endsWith('.tsx')) {
      items.push(rel);
    }
  }
  return items;
}

const all = getAllTsx(screensDir);
const remaining = all.filter(function(f) { return !alreadyDone.has(f); });
const notDone = remaining.filter(function(f) {
  const content = fs.readFileSync(path.join(screensDir, f), 'utf8');
  return !content.includes('useTheme');
});

console.log('Total screens: ' + all.length);
console.log('Already done: ' + alreadyDone.size);
console.log('Remaining to process: ' + notDone.length);
notDone.forEach(function(f) { console.log(f); });
