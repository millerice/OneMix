# OneMix Docker 部署说明（单文档汇总）

本文档汇总 Docker 部署架构、数据卷、环境变量与运维要点。可执行配置位于仓库根目录；Nginx 站点配置位于 `nginx/` 目录。

---

## 1. 架构

| 服务 | 说明 |
|------|------|
| **api** | FastAPI + Uvicorn，`0.0.0.0:8767`（与前端开发时代理端口一致） |
| **web** | Nginx 托管前端 `dist`，并将 `/api/`、`/health` 反向代理到 **api** |

前端使用相对路径请求（如 `/api/settings`），生产环境通过 **同源 + Nginx 反代** 即可，无需改前端构建参数。

---

## 2. 涉及文件

| 文件 | 作用 |
|------|------|
| [docker-compose.yml](docker-compose.yml) | 编排 `api` + `web`、卷、端口；`build.target` 指向 `Dockerfile` 中对应阶段 |
| [Dockerfile](Dockerfile) | 统一多阶段：`target: api` 后端，`target: web` 复制本地 `frontend/dist` + Nginx |
| [nginx/nginx.conf](nginx/nginx.conf) | Nginx 反代与大文件上传限制 |
| [.dockerignore](.dockerignore) | 减小构建上下文 |
| [.env.docker.example](.env.docker.example) | 环境变量示例（复制为 `.env` 可选） |

**前端不在 Docker 内编译**：构建 `web` 镜像前，必须在仓库内已存在 `frontend/dist`（见下文「快速启动」）。

---

## 3. 快速启动

1. 构建前端静态资源（在仓库根目录执行）：

```bash
cd frontend && npm ci && npm run build && cd ..
```

2. 构建并启动容器：

```powershell
docker compose up --build -d
```

默认浏览器访问：**http://localhost:5173**（宿主机 `5173` 映射到容器内 Nginx 的 `5173`）。

- 修改宿主机端口：环境变量 `ONEMIX_WEB_PORT`（见 `.env.docker.example`），或在 `docker-compose.yml` 中改 `ports`。
- 若缺少 `frontend/dist`，`docker compose build web` 会失败；请先完成步骤 1。

`frontend/dist` 一般在 `.gitignore` 中；CI 流水线建议顺序：**安装依赖 → `npm run build` → `docker compose build`**。

---

## 4. 数据与缓存（卷）

| 数据 | 说明 |
|------|------|
| **SQLite / 设置** | 环境变量 `ONEMIX_DATA_DIR` 默认挂载为 `/data/onemix`，对应 Compose 卷 `onemix_data` |
| **任务缓存目录** | 代码使用 `Path.home() / ".cache" / "OneMix" / "jobs"`；Compose 中设置 `HOME=/data` 并挂载 `onemix_cache` 到 `/data/.cache` |

注意：任务进度主要在内存；卷用于持久化数据库与部分导出结果，详见 [README.md](README.md) FAQ。

---

## 5. 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `DASHSCOPE_API_KEY` | DashScope 路线 |
| `ARK_API_KEY` | `doubao_seedream_5` 等需 ARK Key 时必填 |
| `ONEMIX_WEB_PORT` | 宿主机访问前端的端口，默认 `5173` |
| `PIP_INDEX_URL` | 构建 **api** 镜像时 pip 使用的索引，默认清华镜像；海外可改为 `https://pypi.org/simple` |

勿将真实 Key 写入镜像；使用 `.env` 或编排平台的 Secret。

---

## 6. 安全与协议

- 公网部署请自行增加鉴权、HTTPS（外层 Caddy / Traefik / 云 LB 等）。
- 项目许可证为非商用，部署与分发须遵守 [LICENSE](LICENSE)。

---

## 7. 常见问题

**端口与 README 不一致？**  
开发脚本 `backend/run_server.py` 使用 `8767`；Docker 内 **api** 固定为 **8767**。README 中若仍写 `8765`，以实际运行端口为准。

**`pip install` 报找不到 `backend/requirements.txt`？**  
根目录 `requirements.txt` 会 `-r` 引用后端文件；镜像构建时已先复制该文件再执行 `pip install`，若仍报错请确认本地存在 `backend/requirements.txt` 并已提交。

**`No matching distribution found for requests` 且 `(from versions: none)`？**  
多为访问 **PyPI 官方源 `pypi.org` 不稳定**（超时、半包）。处理：构建 **api** 时默认使用国内镜像（见 `docker-compose.yml` 的 `PIP_INDEX_URL` 与根目录 `Dockerfile` 的 `api` 阶段）；仍失败时可换阿里云等镜像，或加大出网带宽后再 `docker compose build --no-cache api`。

**构建 web 报错找不到 `frontend/dist`？**  
请先执行 `cd frontend && npm ci && npm run build`，再 `docker compose build web`。  
若**磁盘上已有 `frontend/dist`** 仍报 `not found`，请看构建日志里的 **`transferring context` 大小**：若只有几百～几千字节，说明 **`dist` 未进入构建上下文**，几乎总是 **`.dockerignore` 写错**（例如写了裸 `dist`，会匹配任意目录下的 `dist`，把 `frontend/dist` 一并排除）。请对照仓库根目录最新 `.dockerignore`（只应忽略 `/dist/` 表示仓库根下的 `dist`，并保留末尾的 `!frontend/dist/`），在服务器上 `git pull` 或手动修正后重试。  
若 `frontend/dist` 为**指向上下文外的符号链接**，也会导致 COPY 失败，请用 `ls -la frontend/dist` 检查。

**构建阶段 `apt-get` 连不上 deb.debian.org？**  
当前 **api** 镜像已去掉构建时 `apt-get`；若你自行加回，请配置 Debian 镜像或代理。

**仅想查看 compose 全文？**  
请直接打开根目录 [docker-compose.yml](docker-compose.yml)。
