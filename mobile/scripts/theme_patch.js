const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '../src/screens');
const themeImport = "import {useTheme} from '../../theme/ThemeContext';";

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
const notDone = all.filter(function(f) {
  const content = fs.readFileSync(path.join(screensDir, f), 'utf8');
  return !content.includes('useTheme');
});

let patched = 0;
let skipped = 0;

notDone.forEach(function(f) {
  const filePath = path.join(screensDir, f);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1) 在最后一个 import 行后面插入 useTheme import
  // 找到最后一个以 import 开头的行的位置
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      lastImportIdx = i;
    }
  }
  if (lastImportIdx === -1) {
    console.log('SKIP (no import found): ' + f);
    skipped++;
    return;
  }
  lines.splice(lastImportIdx + 1, 0, themeImport);
  content = lines.join('\n');

  // 2) 在 export default function XXX(...) { 后面第一行插入 const {theme} = useTheme();
  // 找到 export default function 的行
  const funcMatch = content.match(/export default function \w+\([^)]*\)[^{]*\{/);
  if (!funcMatch) {
    console.log('SKIP (no export default function): ' + f);
    // 还是保存 import 的修改
    fs.writeFileSync(filePath, content, 'utf8');
    patched++;
    return;
  }
  const funcIdx = content.indexOf(funcMatch[0]);
  const insertAt = funcIdx + funcMatch[0].length;
  content = content.slice(0, insertAt) + '\n  const {theme} = useTheme();' + content.slice(insertAt);

  // 3) 替换 SafeAreaView style={styles.container} -> style={[styles.container, {backgroundColor: theme.bg}]}
  content = content.replace(
    /style={styles\.container}/g,
    'style={[styles.container, {backgroundColor: theme.bg}]}'
  );

  // 4) 替换 colors={['#xxx']} in RefreshControl -> colors={[theme.refreshColor]}
  content = content.replace(
    /colors=\{\[['"][^'"]+['"]\]\}/g,
    'colors={[theme.refreshColor]}'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  patched++;
  console.log('PATCHED: ' + f);
});

console.log('\nDone. Patched: ' + patched + ', Skipped: ' + skipped);
