@echo off
chcp 65001 >nul
title 经营考核系统 · 数据备份
cd /d "%~dp0"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TS=%%i
set BAKDIR=备份\data-%TS%
mkdir "%BAKDIR%" >nul 2>nul

copy /y "server\data\*.json" "%BAKDIR%\" >nul 2>nul
if errorlevel 1 (
    echo 备份失败：server\data 下没有找到数据文件（系统可能还没录过数据）。
) else (
    echo 备份完成，保存位置：%BAKDIR%
    echo.
    dir /b "%BAKDIR%"
)
echo.
echo 提示：全部业务数据都在这几个 JSON 文件里，整个"备份"文件夹拷走即完整备份。
echo 恢复方法：把备份里的 json 文件复制回 server\data 目录，再启动系统即可。
echo.
pause
