# ========================================
# 无人机租赁平台 Android APK 自动打包脚本
# ========================================

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  无人机租赁平台 APK 自动打包工具" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 设置错误处理
$ErrorActionPreference = "Stop"

# 1. 检查 JDK
Write-Host "[1/6] 检查 JDK 环境..." -ForegroundColor Yellow

$javaPath = $null
$javaPaths = @(
    "$env:JAVA_HOME\bin\java.exe",
    "$env:LOCALAPPDATA\Android\Sdk\jdk\*\bin\java.exe",
    "C:\Program Files\Java\*\bin\java.exe",
    "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"
)

foreach ($path in $javaPaths) {
    $found = Get-ChildItem -Path $path -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $javaPath = $found.FullName
        break
    }
}

if ($javaPath) {
    $javaDir = Split-Path (Split-Path $javaPath -Parent) -Parent
    $env:JAVA_HOME = $javaDir
    Write-Host "✓ 找到 JDK: $javaDir" -ForegroundColor Green
} else {
    Write-Host "✗ 未找到 JDK" -ForegroundColor Red
    Write-Host ""
    Write-Host "请选择以下选项:" -ForegroundColor Yellow
    Write-Host "1. 下载并安装 JDK 17 (推荐)" -ForegroundColor White
    Write-Host "   下载地址: https://adoptium.net/temurin/releases/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 如果已安装 Android Studio，请手动设置 JAVA_HOME" -ForegroundColor White
    Write-Host "   示例: `$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# 2. 检查后端服务
Write-Host ""
Write-Host "[2/6] 检查后端服务..." -ForegroundColor Yellow

$backendRunning = netstat -ano | Select-String ":8080.*LISTENING"
if ($backendRunning) {
    Write-Host "✓ 后端服务正在运行 (端口 8080)" -ForegroundColor Green
} else {
    Write-Host "⚠ 后端服务未运行，请先启动后端服务" -ForegroundColor Yellow
    Write-Host "  启动命令: cd ..\backend; go run cmd/server/main.go" -ForegroundColor Gray
    $continue = Read-Host "是否继续打包? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# 3. 检查 cpolar 隧道
Write-Host ""
Write-Host "[3/6] 检查 cpolar 配置..." -ForegroundColor Yellow

$envFile = ".env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match 'API_BASE_URL=https://') {
        Write-Host "✓ cpolar 配置已更新" -ForegroundColor Green
        $lines = $envContent -split '\r?\n'
        $apiLine = $lines | Where-Object { $_ -match '^API_BASE_URL=' } | Select-Object -First 1
        if ($apiLine) {
            Write-Host "  API 地址: $apiLine" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠ 请确保 cpolar 隧道已启动并更新了 .env 文件" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ 未找到 .env 配置文件" -ForegroundColor Yellow
}

# 4. 清理旧文件
Write-Host ""
Write-Host "[4/6] 清理旧的构建文件..." -ForegroundColor Yellow

Push-Location android
if (Test-Path ".\app\build\outputs\apk") {
    Remove-Item ".\app\build\outputs\apk\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ 清理完成" -ForegroundColor Green
} else {
    Write-Host "✓ 无需清理" -ForegroundColor Green
}

# 5. 开始编译
Write-Host ""
Write-Host "[5/6] 开始编译 Debug APK..." -ForegroundColor Yellow
Write-Host "    (这可能需要 3-10 分钟，首次编译会下载依赖)" -ForegroundColor Gray
Write-Host ""

# 执行 Gradle 编译
.\gradlew.bat assembleDebug --console=plain 2>&1 | ForEach-Object {
    if ($_ -match "BUILD SUCCESSFUL" -or $_ -match "BUILD FAILED" -or $_ -match "FAILURE" -or $_ -match "Task.*executed") {
        Write-Host $_ -ForegroundColor Cyan
    }
}

Pop-Location

# 6. 检查结果
Write-Host ""
Write-Host "[6/6] 检查编译结果..." -ForegroundColor Yellow

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $apkInfo = Get-Item $apkPath
    $sizeMB = [math]::Round($apkInfo.Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "  ✓ APK 编译成功!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK 信息:" -ForegroundColor Cyan
    Write-Host "  文件路径: $($apkInfo.FullName)" -ForegroundColor White
    Write-Host "  文件大小: $sizeMB MB" -ForegroundColor White
    Write-Host "  创建时间: $($apkInfo.LastWriteTime)" -ForegroundColor White
    Write-Host ""
    Write-Host "下一步操作:" -ForegroundColor Yellow
    Write-Host "  1. 将 APK 发送给测试用户 (微信/QQ/邮件)" -ForegroundColor White
    Write-Host "  2. 或上传到蒲公英平台: https://www.pgyer.com/" -ForegroundColor White
    Write-Host ""
    Write-Host "测试前确认:" -ForegroundColor Yellow
    Write-Host "  ✓ 后端服务正在运行" -ForegroundColor White
    Write-Host "  ✓ cpolar 隧道已启动" -ForegroundColor White
    Write-Host "  ✓ 你的电脑保持开机状态" -ForegroundColor White
    Write-Host ""
    
    # 询问是否打开文件夹
    $openFolder = Read-Host "是否打开 APK 所在文件夹? (y/n)"
    if ($openFolder -eq "y") {
        Start-Process explorer.exe "/select,$($apkInfo.FullName)"
    }
    
} else {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "  ✗ APK 编译失败" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查上方的错误信息" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "常见问题:" -ForegroundColor Yellow
    Write-Host "  1. JDK 版本问题 - 需要 JDK 11 或 17" -ForegroundColor White
    Write-Host "  2. 网络问题 - Gradle 下载依赖失败" -ForegroundColor White
    Write-Host "  3. 磁盘空间不足 - 需要至少 2GB 空间" -ForegroundColor White
    Write-Host ""
    Write-Host "如需帮助，请将错误信息发送给开发者" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
