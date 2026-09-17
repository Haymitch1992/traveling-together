# 结伴出行

和伙伴一起，记录走过的城市。全栈 Web 应用：Node.js + Express + SQLite 后端，高德地图前端，支持多用户与游客模式。

## 快速开始

1. 安装依赖

   ```bash
   npm install
   ```

2. 填入高德 Key

   编辑 `config.json`，填入你在[高德开放平台](https://lbs.amap.com/)申请的 **Web端（JS API）** 密钥和安全密钥：

   ```json
   {
     "amapKey": "你的密钥",
     "amapSecurityCode": "你的安全密钥",
     "deepseekKey": "你的 DeepSeek Key（可选，用于 AI 生成行程）",
     "deepseekModel": "deepseek-chat"
   }
   ```

   DeepSeek Key 在 [DeepSeek 开放平台](https://platform.deepseek.com/)申请；不配置则 AI 生成行程功能不可用，其余功能不受影响。

3. 启动

   ```bash
   npm start
   ```

4. 浏览器访问 <http://localhost:3000>，自动跳转到登录页

## 登录模式

- **账号登录 / 注册**：登录页可自助注册新账号，注册需**邮箱验证码**验证（每个邮箱只能注册一个账号）；每个账号的旅行数据互相隔离
- **游客登录**：无需账号，点击进入后可浏览 **admin** 用户的旅行地图，只读，不能增删改

验证码邮件通过 163 邮箱 SMTP 发送，在 `config.json` 配置：

```json
{
  "smtpHost": "smtp.163.com",
  "smtpPort": 465,
  "smtpUser": "你的163邮箱地址",
  "smtpPass": "客户端授权码（163邮箱设置 → POP3/SMTP 开启后生成）",
  "smtpFrom": "你的163邮箱地址"
}
```

未配置 SMTP 时验证码会打印在服务器控制台（调试用）。

首次启动自动创建 admin 账号，默认密码 `admin123`（控制台会有提示，请登录后尽快到数据库中修改，或后续版本支持改密）。

## 功能

- 搜索全球 580+ 主要城市（含中国全部地级市），中英文均可
- 记录每座城市的到访次数、日期和备注
- 地图上城市圆点随次数变大、颜色加深，点击查看到访历史
- 右侧面板展示统计（城市数 / 总次数 / 国家数）和城市列表，支持编辑、删除、再记一次
- **发起旅行**：地图交互选择目的地，按出行方式自动计算单程距离（驾车/骑行/步行走高德路径规划，其他方式用直线距离）；记录出发时间、天数、预算、同行人
- **旅行项目**：补充花费并自动计算人均分摊与转账建议；按天填写具体行程；上传照片生成照片墙
- **AI 生成行程**：详情页一键调用 DeepSeek 按目的地/天数/出行方式生成分天行程，预览确认后采用
- 个人资料中设置固定出发城市，作为距离计算的起点
- 数据保存在本地 SQLite（`data/travel.db`），照片存于 `data/uploads/`，重启不丢失
- 密码使用 scrypt 哈希存储，登录态为 HttpOnly Cookie（7 天有效）

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/auth/register | 注册（成功自动登录） |
| POST | /api/auth/login | 账号登录 |
| POST | /api/auth/guest | 游客登录（浏览 admin 数据，只读） |
| POST | /api/auth/logout | 退出登录 |
| GET | /api/auth/me | 当前登录状态 |
| GET | /api/cities | 当前用户的城市列表（含次数与到访历史） |
| GET | /api/cities/search?q= | 搜索内置城市库 |
| POST | /api/cities | 添加城市并记一次到访（游客 403） |
| POST | /api/cities/:id/visits | 追加一次到访（游客 403） |
| PUT | /api/visits/:id | 编辑到访记录（游客 403） |
| DELETE | /api/visits/:id | 删除一次到访（游客 403） |
| DELETE | /api/cities/:id | 删除城市（游客 403） |
| GET | /api/stats | 当前用户统计信息 |
| GET/PUT | /api/profile | 个人资料 / 设置固定出发城市 |
| GET/POST | /api/trips | 旅行项目列表 / 发起旅行 |
| GET/PUT/DELETE | /api/trips/:id | 项目详情（含分摊）/ 修改 / 删除 |
| POST/DELETE | /api/trips/:id/members(/:mid) | 同行人管理 |
| POST/PUT/DELETE | /api/trips/:id/expenses(/:eid) | 花费记录 |
| POST/PUT/DELETE | /api/trips/:id/itinerary(/:iid) | 每日行程 |
| POST/DELETE | /api/trips/:id/photos(/:pid) | 照片上传（最多 9 张/次，≤10MB）/ 删除 |

## Docker 部署（腾讯云等云服务器）

1. 上传代码到服务器（git clone 或 scp），并把本地的 `config.json`（含各 Key）和 `data/travel.db`（已有数据，可选）一并放到项目目录

2. 构建并启动：

   ```bash
   docker compose up -d --build
   ```

3. 访问 `http://服务器IP:3000`

说明：

- **数据持久化**：`./data` 目录挂载进容器，数据库和照片都在宿主机上，重建容器不丢数据；`data/cities.json` 不存在时容器启动会自动播种
- **配置方式**：默认挂载 `config.json`（只读）；也可以改用环境变量（`AMAP_KEY`、`DEEPSEEK_KEY`、`SMTP_USER`、`SMTP_PASS` 等，见 docker-compose.yml 注释），环境变量优先级更高
- **端口**：腾讯云控制台的安全组需放行 3000 端口；生产环境建议前面套 Nginx + HTTPS
- 常用命令：`docker compose logs -f` 看日志、`docker compose restart` 重启、`docker compose down && docker compose up -d --build` 更新代码后重建
