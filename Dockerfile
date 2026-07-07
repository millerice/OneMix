# OneMix 统一镜像定义：Compose 通过 build.target 分别构建 api / web
# -----------------------------------------------------------------------------
# target: api — FastAPI + Uvicorn
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS api

WORKDIR /app

# 不在镜像构建阶段执行 apt-get：国内/受限网络常无法访问 deb.debian.org。
# Pillow 等对 Linux amd64 通常提供 manylinux 预编译 wheel。

# 根目录 requirements.txt 含 `-r backend/requirements.txt`，pip 解析前须已存在该路径
COPY requirements.txt /app/requirements.txt
COPY backend/requirements.txt /app/backend/requirements.txt

ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install --no-cache-dir -U pip \
    && pip install --no-cache-dir \
        --index-url "${PIP_INDEX_URL}" \
        --timeout 120 \
        --retries 10 \
        -r /app/requirements.txt

COPY backend/ /app/

ENV PYTHONUNBUFFERED=1
ENV ONEMIX_DATA_DIR=/data/onemix
ENV HOME=/data

EXPOSE 8767

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8767"]

# -----------------------------------------------------------------------------
# target: web — 本机/CI 已构建的 frontend/dist + Nginx（不在镜像内跑 npm）
# 构建前请执行：cd frontend && npm ci && npm run build
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS web

COPY frontend/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
