@echo off
chcp 65001 >nul
title 启动带调试端口的 Chrome（用于抓B站）

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set PROFILE=%LOCALAPPDATA%\Google\Chrome\User Data

echo ============================================
echo  启动 Chrome（带远程调试端口 9222）
echo  配置目录：%PROFILE%
echo ============================================
echo.

tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | find /I "chrome.exe" >nul
if %ERRORLEVEL%==0 (
    echo [!] Chrome 已在运行。
    echo     调试端口需要在 Chrome "完全关闭" 后启动才会生效。
    echo     建议：全部关掉 Chrome 后重新运行本脚本。
    echo.
    choice /C YN /M "是否仍要继续尝试"
    if errorlevel 2 goto :end
)

start "" %CHROME% --remote-debugging-port=9222 --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check "https://www.bilibili.com/"

echo.
echo 已启动。等待 5 秒后检查端口...
timeout /t 5 /nobreak >nul

powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 5; Write-Host '[OK] CDP 可用:' $r.Browser -ForegroundColor Green } catch { Write-Host '[X] CDP 不可用，请确认 Chrome 已全部关闭后重试' -ForegroundColor Red }"

echo.
echo 接下来：
echo   1. 在这个窗口登录 B站
echo   2. 不要关闭这个 Chrome 窗口
echo   3. 回到对话里说"登录好了"
echo.
pause

:end
