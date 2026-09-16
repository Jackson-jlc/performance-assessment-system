@echo off
chcp 65001 >nul
title 经营考核系统 · 调试模式（关闭本窗口即停止服务）
cd /d "%~dp0server"
echo.
echo  正在前台启动经营考核系统，运行日志实时显示在本窗口。
echo  首次启动会打印【初始管理员账号密码】，请立即记录。
echo  关闭本窗口 = 停止服务。
echo  ----------------------------------------------------------------
node server.js
echo.
echo  服务已退出。
pause
