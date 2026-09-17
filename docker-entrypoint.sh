#!/bin/sh
set -e

# 数据卷为空时播种内置城市库
if [ ! -f /app/data/cities.json ]; then
  mkdir -p /app/data
  cp /app/docker-seed/cities.json /app/data/cities.json
fi

exec node server.js
