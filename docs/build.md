# 构建脚本说明

## 小程序构建

真实手机手测必须让小程序请求手机可访问的后端地址，不要用 `127.0.0.1` 包。

```bash
cd mini-program

# 本机模拟器 / 微信开发者工具本地联调
npm run build:weapp

# 双手机 E2E / 真机调试，固定走 cpolar 穿透域名
npm run build:weapp:e2e

# 生产包。当前项目尚未固化正式生产域名，默认仍沿用现有 cpolar 配置。
# TODO: 正式域名确认后，用 MINI_PROGRAM_PROD_API_BASE 覆盖。
MINI_PROGRAM_PROD_API_BASE=https://your-prod-domain.example.com/api/v2 npm run build:weapp:prod
```

使用真机调试时，如果 Console 里仍看到 `http://127.0.0.1:8080/api/v2`，说明包不是用 `build:weapp:e2e` 构建的，需要重新构建并刷新开发者工具。
