# drone_v1 云端部署

`main` 分支推送后，GitHub Actions 会构建并部署 v1 到腾讯云 `/opt/drone_v1`。

## GitHub Secrets

仓库需要配置这些 secrets，不能提交到 git：

- `TENCENT_CLOUD_HOST`: `106.55.151.5`
- `TENCENT_CLOUD_USER`: `ubuntu`
- `TENCENT_CLOUD_SSH_KEY`: 可登录服务器的私钥内容

## 部署内容

- backend: 编译 Linux `server` 二进制，使用 `backend/Dockerfile.cloud` 重新构建 `drone_v1_api`
- H5: 构建 `web-h5/dist-h5` 并同步到 `/opt/drone_v1/web-h5`
- admin: 构建 `admin/dist` 并同步到 `/opt/drone_v1/admin`
- compose: 同步 `deploy/drone_v1/docker-compose.cloud.yml` 和 `deploy/drone_v1/Caddyfile`

服务器上的真实 `.env` 与 `backend/config.cloud.yaml` 由人工维护，不进入 git。
