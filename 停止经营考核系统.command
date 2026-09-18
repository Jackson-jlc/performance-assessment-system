#!/bin/bash
#============================================================
# 钻井经营考核系统 · macOS 停止脚本
# 双击本文件即可停止后台运行的服务。
# （Windows 下请用 停止经营考核系统.bat）
#============================================================
set -u

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
DIR="$BASE_DIR/server"

# ---- 读取端口（默认 4000，以 server/.env 中 PORT 为准）----
PORT=4000
if [ -f "$DIR/.env" ]; then
  ENV_PORT="$(grep -E '^PORT=' "$DIR/.env" | tail -1 | cut -d= -f2 | tr -d ' \r')"
  [ -n "${ENV_PORT:-}" ] && PORT="$ENV_PORT"
fi

echo "正在停止端口 $PORT 上的经营考核系统服务..."
PIDS="$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)"
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill 2>/dev/null
  sleep 2
  PIDS="$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)"
  [ -n "$PIDS" ] && echo "$PIDS" | xargs kill -9 2>/dev/null
  echo "已停止。数据已全部保存在本地 server/data 目录，不会丢失。"
else
  echo "没有发现运行中的服务（可能本来就没启动）。"
fi
sleep 3
exit 0
