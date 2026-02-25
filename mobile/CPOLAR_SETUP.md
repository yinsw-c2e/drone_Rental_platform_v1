# cpolar 配置说明

## 当前状态
✅ cpolar 客户端已安装
✅ 后端服务运行在 8080 端口
✅ .env 配置文件已创建

## 下一步操作

### 1. 在 cpolar 界面创建隧道
打开 cpolar 客户端，创建以下隧道：

**隧道名称**: wurenji-backend
**协议**: http
**本地地址**: 8080
**域名类型**: 随机域名（免费）或自定义（VIP）
**地区**: China VIP（如果是VIP用户）

### 2. 启动隧道
点击"启动"按钮，cpolar 会给你一个公网地址，例如：
```
http://abc123.cpolar.cn
```

### 3. 修改 .env 文件
将 `mobile/.env` 文件中的地址替换为实际地址：
```env
API_BASE_URL=http://abc123.cpolar.cn/api/v1
WS_BASE_URL=ws://abc123.cpolar.cn/ws
```

### 4. 测试连接
在浏览器访问：http://你的cpolar地址/api/v1/ping
如果看到返回数据，说明配置成功！

### 5. 编译 Android APK
```bash
cd d:\codes\wurenji\mobile\android
gradlew assembleRelease
```

APK 位置：`android\app\build\outputs\apk\release\app-release.apk`

### 6. 发送给测试用户
将 APK 发送给测试用户，或上传到蒲公英平台：
https://www.pgyer.com/

## 注意事项
⚠️ 使用 cpolar 时，你的电脑需要保持开机状态
⚠️ 免费版有流量限制（2GB/月），建议升级 VIP（10元/月不限流量）
⚠️ 每次重启 cpolar，随机域名会改变（VIP可固定）

## 成本
- cpolar 免费版：¥0/月（2GB流量）
- cpolar VIP：¥10/月（不限流量，固定域名）
- 蒲公英分发：免费

总成本：¥0-10/月
