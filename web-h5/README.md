# 无人机重载吊运平台 · H5 网页版（web-h5）

独立的 Taro + React H5 工程，从 `../mini-program` 复制而来，用于在浏览器里演示、自动化测试（无需微信开发者工具/真机）。

> ⚠️ 这是 `mini-program` 的**独立副本**，两边不会自动同步。小程序若有业务改动，需要手动同步到这里。

## 快速开始

1. 启动后端（默认 `http://127.0.0.1:8080`，已对 `http://localhost:3000` 放行 CORS）。
2. 配置高德地图 Key（可选，缺省时地图降级为搜索选点）：
   ```bash
   cp .env.h5.local.example .env.h5.local
   # 编辑 .env.h5.local，填入 H5_AMAP_KEY 与 H5_AMAP_SECURITY_CODE（JS API 2.0 安全密钥）
   ```
3. 开发服务器：
   ```bash
   cd web-h5
   npm install        # 首次
   npm run dev:h5     # devServer 端口 3000，hash 路由
   ```
4. 浏览器打开 `http://localhost:3000`（建议移动端视口 375×812）。
5. 生产构建：`npm run build:h5` → 输出 `dist-h5/`（可静态托管）。

## 登录（演示用）

H5 隐藏了微信登录，用手机号/密码或登录页底部「快速登录」样本账号：

- 客户：`13800000004` / `password123`
- 服务商：`13800000007` / `password123`
- 服务商履约：`13900000016`、综合服务：`13800000002`、管理员：`13800000001`

## 地图能力（高德地图替代微信原生）

| 小程序能力 | H5 实现 |
| --- | --- |
| `<Map>` 实时轨迹（订单进度页） | 高德 JS API（`src/components/LiveMap/index.h5.tsx`） |
| `Taro.chooseLocation` 选点 | 自建选点弹层 `LocationPickerHost`：可拖拽地图 + 关键词搜索 |
| `Taro.getLocation` | 高德 Geolocation / 浏览器定位 |
| `Taro.openLocation` | 跳转高德地图 URI |

未配置 `H5_AMAP_KEY` 时：地图降级为「关键词搜索选点」（走后端 POI 接口）；实时轨迹页显示占位提示。

## H5 适配要点（与小程序差异）

- H5 平台插件 `@tarojs/plugin-platform-h5`，输出目录 `dist-h5`，hash 路由。
- 自定义 TabBar：Taro 4.2 H5 不渲染 `custom:true` 的 TabBar，改用全局挂载的 `src/components/H5TabBar/index.h5.tsx`。
- 单位换算：源码混用 `px`(375 基准) 与 `rpx`(750 基准)。关闭 Taro 默认 pxtransform，改用 `config/postcss-rpx-dual.js` 分单位换算（`px→N/20rem`、`rpx→N/40rem`），与小程序端一致。
- 微信专有 API（`Taro.login`、`getMenuButtonBoundingClientRect`、`requestSubscribeMessage`）在 H5 已守卫/降级。
- 平台分支：`process.env.TARO_ENV === 'h5'` 与 `.h5.tsx`/`.h5.ts` 后缀文件（同名无后缀为 stub）。
