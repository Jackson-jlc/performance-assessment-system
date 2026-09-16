@echo off
chcp 65001 >nul
title 经营考核系统 · 停止
cd /d "%~dp0server"

rem ---- 读取端口（默认 4000，以 .env 中 PORT 为准）----
set PORT=4000
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%a in (`findstr /b "PORT=" ".env"`) do if "%%a"=="PORT" set PORT=%%b
)

echo 正在停止端口 %PORT% 上的经营考核系统服务...
set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set FOUND=1
    taskkill /f /pid %%p >nul 2>nul
)
if "%FOUND%"=="1" (
    echo 已停止。数据已全部保存在本地 server\data 目录，不会丢失。
) else (
    echo 没有发现运行中的服务（可能本来就没启动）。
)
echo.
ping -n 4 127.0.0.1 >nul
exit /b 0
