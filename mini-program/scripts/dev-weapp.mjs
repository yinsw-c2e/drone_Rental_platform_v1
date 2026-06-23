import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const taroBin = path.join(projectRoot, 'node_modules', '.bin', 'taro');

const childEnv = {
  ...process.env,
  MINI_PROGRAM_API_BASE: process.env.MINI_PROGRAM_API_BASE || 'https://dronerentalplat.cpolar.top/api/v2',
};

const fixer = spawn(process.execPath, ['scripts/fix-weapp-wxss-imports.mjs', '--watch'], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
});

const taro = spawn(taroBin, ['build', '--type', 'weapp', '--watch'], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
});

let shuttingDown = false;

const stop = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!fixer.killed) fixer.kill();
  if (!taro.killed) taro.kill();
  process.exit(code);
};

fixer.on('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    stop(code || 1);
  }
});

fixer.on('error', () => {
  stop(1);
});

taro.on('error', () => {
  stop(1);
});

taro.on('exit', (code) => {
  stop(code || 0);
});

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
