# Docker 部署与重启极速进度脚本
$Host.UI.RawUI.WindowTitle = "Seerr Bridge Deploy Progress"

function Write-Step($stepNum, $totalSteps, $message) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "  [$stepNum/$totalSteps] $message" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Cyan
}

Clear-Host
Write-Host "🚀 开始 Docker 容器服务编译与重启流程..." -ForegroundColor Yellow

# 步骤 1: 检查目录
Write-Step 1 4 "正在检查工作目录与配置..."
$workDir = "c:\Users\lixiaogang\Desktop\tmdb2kodi\seerr_src"
Set-Location $workDir
Write-Host "✔ 当前工作目录: $workDir" -ForegroundColor Gray

# 步骤 2: 重新打包构建
Write-Step 2 4 "正在执行 Docker Compose 增量编译打包..."
Write-Host "⏱ 提示: 正在拉起 Docker BuildKit，大部分依赖将直接命中缓存..." -ForegroundColor Gray
docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建过程中发生错误，请检查 Docker 日志！" -ForegroundColor Red
    exit 1
}

# 步骤 3: 检查容器运行状态
Write-Step 3 4 "正在验证容器运行状态..."
Start-Sleep -Seconds 3
$containerStatus = docker ps --filter "name=seerr-bridge" --format "{{.Names}}: {{.Status}}"
Write-Host "✔ 容器当前状态: $containerStatus" -ForegroundColor Yellow

# 步骤 4: API 健康检查探针
Write-Step 4 4 "正在发起 HTTP 探针验证 API 可用性 (http://localhost:5055/api/v1/status)..."
$maxRetries = 10
$retryCount = 0
$success = $false

while ($retryCount -lt $maxRetries) {
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:5055/api/v1/status" -TimeoutSec 3 -ErrorAction Stop
        if ($res.version -or $res.commitTag) {
            $success = $true
            break
        }
    } catch {
        $retryCount++
        Write-Host "⏳ 等待服务完全启动并监听端口 ($retryCount/$maxRetries)..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 2
    }
}

if ($success) {
    Write-Host ""
    Write-Host "🎉==================================================" -ForegroundColor Green
    Write-Host "  ✅ 全量部署与重启成功！服务已就绪！" -ForegroundColor Green
    Write-Host "  🌐 访问地址: http://localhost:5055" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Green
} else {
    Write-Host "⚠️ 服务就绪超时，请稍后在浏览器中手动刷新 http://localhost:5055" -ForegroundColor Yellow
}
