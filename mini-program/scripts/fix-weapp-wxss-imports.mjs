import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');
const appWxssPath = path.join(distRoot, 'app.wxss');
const appOriginWxssPath = path.join(distRoot, 'app-origin.wxss');
const commonWxssPath = path.join(distRoot, 'common.wxss');
const watchMode = process.argv.includes('--watch');
const appOriginImportPattern = /@import\s+['"]\.\/app-origin\.wxss['"];?/;
const commonImportPattern = /@import\s+['"]\.\/common\.wxss['"];?/;

const readIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
};

if (watchMode) {
  fs.mkdirSync(distRoot, { recursive: true });
}

const inlineWxssImports = () => {
  if (!fs.existsSync(appWxssPath)) {
    return false;
  }

  const appWxss = fs.readFileSync(appWxssPath, 'utf8');
  const referencesAppOrigin = appOriginImportPattern.test(appWxss);
  const referencesCommon = commonImportPattern.test(appWxss);

  if (!referencesAppOrigin && !referencesCommon) {
    return false;
  }

  const chunks = [
    '/* generated: inlined by scripts/fix-weapp-wxss-imports.mjs to avoid DevTools app-origin.wxss import races */',
    readIfExists(appOriginWxssPath),
    readIfExists(commonWxssPath),
  ].filter(Boolean);

  fs.writeFileSync(appWxssPath, `${chunks.join('\n')}\n`);
  return true;
};

inlineWxssImports();

if (!watchMode) {
  process.exit(0);
}

let timer = null;

const scheduleInline = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    inlineWxssImports();
  }, 80);
};

fs.watch(distRoot, (_eventType, filename) => {
  if (!filename) return;
  if (['app.wxss', 'app-origin.wxss', 'common.wxss'].includes(filename.toString())) {
    scheduleInline();
  }
});
