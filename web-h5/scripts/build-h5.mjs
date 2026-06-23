import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const taroBin = path.join(projectRoot, 'node_modules', '.bin', 'taro');

// 从 .env.h5.local 读取高德 Key 等本地配置（与 dev-h5.mjs 一致）。
const loadLocalEnv = () => {
  const envFile = path.join(projectRoot, '.env.h5.local');
  if (!existsSync(envFile)) return {};
  const out = {};
  for (const rawLine of readFileSync(envFile, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const localEnv = loadLocalEnv();
const childEnv = {
  ...localEnv,
  ...process.env,
  NODE_ENV: 'production',
  MINI_PROGRAM_BUILD_ENV: 'production',
  MINI_PROGRAM_API_BASE:
    process.env.MINI_PROGRAM_API_BASE || localEnv.MINI_PROGRAM_API_BASE || 'http://127.0.0.1:8080/api/v2',
};

const taro = spawn(taroBin, ['build', '--type', 'h5'], { cwd: projectRoot, env: childEnv, stdio: 'inherit' });
taro.on('exit', (code) => process.exit(code || 0));
taro.on('error', () => process.exit(1));
