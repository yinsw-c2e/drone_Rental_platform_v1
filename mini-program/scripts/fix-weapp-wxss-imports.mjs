import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');
const appWxssPath = path.join(distRoot, 'app.wxss');
const appOriginWxssPath = path.join(distRoot, 'app-origin.wxss');
const commonWxssPath = path.join(distRoot, 'common.wxss');

const readIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
};

if (!fs.existsSync(appWxssPath)) {
  process.exit(0);
}

const appWxss = fs.readFileSync(appWxssPath, 'utf8');
const referencesAppOrigin = appWxss.includes('app-origin.wxss');
const referencesCommon = appWxss.includes('common.wxss');

if (!referencesAppOrigin && !referencesCommon) {
  process.exit(0);
}

const chunks = [
  '/* generated: inlined by scripts/fix-weapp-wxss-imports.mjs to avoid DevTools app-origin.wxss import races */',
  readIfExists(appOriginWxssPath),
  readIfExists(commonWxssPath),
].filter(Boolean);

fs.writeFileSync(appWxssPath, `${chunks.join('\n')}\n`);
