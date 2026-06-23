/**
 * H5 双单位换算插件（替代 Taro 默认 postcss-pxtransform）。
 *
 * 背景：本项目源码混用两种单位——
 *   - `px`  按 375 设计稿（375px = 满屏）
 *   - `rpx` 按 750 设计稿（750rpx = 满屏，小程序原生单位）
 * 小程序端两者都能正确渲染（rpx 原生 750 基准；px 经 designWidth=375 换算成 2rpx）。
 * 但 Taro H5 的 pxtransform 用同一个 rootValue 同时换算 px 和 rpx，无法区分两套基准，
 * 导致 rpx 页面在 H5 上被放大 2 倍。
 *
 * 本插件按单位分别换算成 rem，并配合 Taro 注入的自适应根字号脚本
 * （designWidth=375 → 根字号 = 20 * 视口宽 / 375）：
 *   - `Npx`  → (N / 20) rem  → 渲染 N * 视口宽 / 375 （375 基准，正确）
 *   - `Nrpx` → (N / 40) rem  → 渲染 N * 视口宽 / 750 （750 基准，正确）
 * 与小程序端渲染保持一致。
 *
 * 仅转换小写 `px` / `rpx`；大写 `PX`/`Px`/`pX` 视为"字面像素"原样保留（与 Taro 约定一致）。
 */
const VALUE_RE = /(-?\d*\.?\d+)(rpx|px)\b/g;

module.exports = (opts = {}) => {
  const pxRoot = opts.pxRoot || 20;
  const rpxRoot = opts.rpxRoot || 40;
  const precision = opts.unitPrecision || 6;

  const round = (n) => {
    const f = Math.pow(10, precision);
    return Math.round(n * f) / f;
  };

  const convert = (value) =>
    value.replace(VALUE_RE, (match, num, unit) => {
      const n = parseFloat(num);
      if (!isFinite(n)) return match;
      if (n === 0) return '0';
      const rem = unit === 'rpx' ? n / rpxRoot : n / pxRoot;
      return `${round(rem)}rem`;
    });

  return {
    postcssPlugin: 'postcss-rpx-dual',
    Declaration(decl) {
      // content 里多是文本，避免误伤；其余声明都换算。
      if (decl.prop === 'content') return;
      if (decl.value.indexOf('px') === -1) return;
      decl.value = convert(decl.value);
    },
  };
};

module.exports.postcss = true;
