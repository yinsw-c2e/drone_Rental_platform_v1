const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '../src/screens');

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

// Find files that have useTheme import but no const {theme} = useTheme()
const needsCall = all.filter(function(f) {
  const content = fs.readFileSync(path.join(screensDir, f), 'utf8');
  return content.includes('useTheme') && !content.includes('const {theme} = useTheme()');
});

console.log('Files needing useTheme() call: ' + needsCall.length);

let fixed = 0;
needsCall.forEach(function(f) {
  const filePath = path.join(screensDir, f);
  let content = fs.readFileSync(filePath, 'utf8');

  // Try to insert after "const XxxScreen: React.FC..." pattern
  const constFuncMatch = content.match(/const \w+Screen[^=]*= [^{]*\{/);
  if (constFuncMatch) {
    const idx = content.indexOf(constFuncMatch[0]);
    const insertAt = idx + constFuncMatch[0].length;
    content = content.slice(0, insertAt) + '\n  const {theme} = useTheme();' + content.slice(insertAt);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('FIXED const: ' + f);
    fixed++;
    return;
  }

  // Try to insert after "export default function XXX(...) {"
  const funcMatch = content.match(/export default function \w+\([^)]*\)[^{]*\{/);
  if (funcMatch) {
    const idx = content.indexOf(funcMatch[0]);
    const insertAt = idx + funcMatch[0].length;
    content = content.slice(0, insertAt) + '\n  const {theme} = useTheme();' + content.slice(insertAt);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('FIXED func: ' + f);
    fixed++;
    return;
  }

  console.log('COULD NOT FIX: ' + f);
});

console.log('\nFixed: ' + fixed);
