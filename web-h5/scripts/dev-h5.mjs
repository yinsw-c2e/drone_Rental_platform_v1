import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const taroBin = path.join(projectRoot, 'node_modules', '.bin', 'taro');

// 可选：从 mini-program/.env.h5.local 读取高德 Key 等本地配置（该文件已 gitignore）。
// 形如：
//   H5_AMAP_KEY=你的高德JSKey
//   H5_AMAP_SECURITY_CODE=你的安全密钥
//   MINI_PROGRAM_API_BASE=http://127.0.0.1:8080/api/v2
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const localEnv = loadLocalEnv();

const childEnv = {
  ...localEnv,    // .env.h5.local 提供默认值
  ...process.env, // 真实 shell 环境变量优先级更高，方便临时覆盖
  // H5 默认直连本地后端（CORS 已放行 http://localhost:3000）。
  MINI_PROGRAM_API_BASE: process.env.MINI_PROGRAM_API_BASE || localEnv.MINI_PROGRAM_API_BASE || 'http://127.0.0.1:8080/api/v2',
};

if (!childEnv.H5_AMAP_KEY) {
  console.warn('[dev:h5] ⚠️ 未检测到 H5_AMAP_KEY，地图将以降级占位渲染。可在 mini-program/.env.h5.local 配置或前缀环境变量。');
}

const taro = spawn(taroBin, ['build', '--type', 'h5', '--watch'], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
});

let shuttingDown = false;
const stop = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!taro.killed) taro.kill();
  process.exit(code);
};

taro.on('error', () => stop(1));
taro.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
