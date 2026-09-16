@echo off
chcp 65001 >nul
title 经营考核系统 · 运行日志
if exist "%~dp0logs\server.log" (
    notepad "%~dp0logs\server.log"
) else (
    echo 还没有日志文件（系统从未启动过）。
    echo 请先双击"启动经营考核系统.vbs"。
    echo.
    pause
)
