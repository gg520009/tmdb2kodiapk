# Armbian TMDB2Kodi Bridge (与 Seerr/Jellyseerr 原生源码无缝融合)

本项目成功融合了 GitHub 官方开源的 [seerr-team/seerr](https://github.com/seerr-team/seerr) 前前端全套源代码，并无缝植入 Armbian 视频源动态抓取与电视端 Kodi POST 远程投屏控制引擎！

---

## 🌟 整合架构与新增核心能力

1. **原汁原味官方 Seerr 界面**：
   - 使用官方克隆的 TypeScript/Next.js 前端体系，提供工业级精致的视觉与媒体请求体验。

2. **多视频源动态解析与替换**：
   - 点击任何 Movie / TV 资源时，通过集成后端 `/api/v1/bridge/resolve` 自动将 TMDB ID 替换匹配 `https://www.cineby.at`、`https://www.fmovies.gd`、`https://www.cineplay.to` 等源媒体流。
   - 支持后端/前端随时对视频源网址进行动态增删改查。

3. **电视端 Kodi POST 远程推流播放**：
   - 包含 `/api/v1/bridge/kodi/play` POST 接口，直接向电视端 Kodi (端口 8080) 发送 JSON-RPC 指令控制播放。

---

## 📁 项目目录结构

```
c:\Users\lixiaogang\Desktop\tmdb2kodi\
├── seerr_src/                  # 克隆自 https://github.com/seerr-team/seerr 的完整源码
│   ├── server/routes/bridge.ts # [NEW] 植入的视频源抓取与 Kodi POST 控制 API 路由
│   ├── server/routes/index.ts  # 注册挂载 bridge 路由
│   └── ...
├── backend/                    # 轻量单板独立运行模式
└── README.md
```
