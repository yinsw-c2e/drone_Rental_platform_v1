# 构建脚本说明

## 小程序构建

真实手机手测必须让小程序请求手机可访问的后端地址，不要用 `127.0.0.1` 包。

```bash
cd mini-program

# 本机模拟器 / 微信开发者工具本地联调
npm run build:weapp

# 双手机 E2E / 真机调试，固定走 cpolar 穿透域名
npm run build:weapp:e2e

# 云端测试包。默认指向 v1 独立域名；如需临时覆盖，用 MINI_PROGRAM_CLOUD_API_BASE 指定。
npm run build:weapp:cloud

# 生产包。默认指向 v1 独立域名；上线前需完成 HTTPS 与微信 request 合法域名配置。
MINI_PROGRAM_PROD_API_BASE=https://swvictory.top/api/v2 npm run build:weapp:prod
```

使用真机调试时，如果 Console 里仍看到 `http://127.0.0.1:8080/api/v2`，说明包不是用对应的 E2E/云端构建命令构建的，需要重新构建并刷新开发者工具。
