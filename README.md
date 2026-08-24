# webmirror-client

WebMirror 前端操作界面 —— 远端会话中转系统。Vite + React + TypeScript + MUI v5。

## 架构

```
本前端输入 prompt → POST /api/submit → 中转后端建任务
→ 浏览器插件写入已登录的远端会话页并抓取应答
→ 应答回传中转后端 → 本前端 SSE 实时展示
```

两条独立的 Go 进程，职责分清：

| 进程 | 位置 | 作用 | 是否本项目手写 |
|------|------|------|----------------|
| 中转后端 (webmirror 中转服务) | 外部项目 `webmirror/backend` | 任务队列 / SSE / 插件 ingest / 图片落盘 / 历史 | 否，属 webmirror 项目 |
| 桌面网关 (托盘 exe) | 本项目 `desktop/`（编译出 `webmirror-desktop.exe`） | embed 前端 SPA + 系统托盘 + 反代 `/api`、`/files` 到中转后端 | 是，本项目编译目标 |

> `desktop/` 就是 skill「go-desktop-gateway」所指的**托盘 exe 实体**：它不含业务逻辑，只把前端打进 exe、挂托盘、把请求反代给中转后端（默认 `http://localhost:8080`）。真正的中转逻辑在 webmirror 后端。

> 前端源码统一放在 `web/` 目录，与桌面网关 `desktop/` 分离，目录职责清晰。

## 本地运行（开发模式）

```bash
# 1. 先启动中转后端（见 webmirror/backend/API.md）
cd C:\Users\qing\Desktop\webmirror\backend
go run .

# 2. 再启动前端（在 web/ 目录下）
cd C:\Users\qing\Desktop\webmirror-client\web
npm install --registry=https://registry.npmmirror.com   # 国内镜像加速
npm run dev        # http://localhost:5173
```

dev 服务器已将 `/api` 和 `/files` 代理到 `http://localhost:8080`。

## 编译桌面 exe（Windows 单文件，无控制台窗口）

```bash
# 在 Windows 下双击 build.bat（或命令行运行）
build.bat
```

脚本做的事：从根目录 `logo.png` **自动生成全部图标**（`web/public/logo.png` 网页 favicon+顶栏、`desktop/icon.ico` 托盘+exe 文件图标）→ 在 `web/` 构建前端（vite build → web/dist）→ 拷贝进 `desktop/internal/static/dist` → 用 `rsrc` 把 `desktop/icon.ico` 编译成 `desktop/rsrc.syso`（嵌入 exe **文件图标**）→ `go build -ldflags="-H windowsgui -s -w"` 出 `webmirror-desktop.exe`。托盘图标由 exe 内嵌的同一份 `icon.ico` 提供。

运行 `webmirror-desktop.exe` 后：自动打开浏览器到 `http://localhost:5173`，托盘显示 WebMirror 图标（打开界面 / 退出）。**运行前需先启动中转后端于 :8080**。

如需更换 logo，**只需替换项目根目录的 `logo.png` 这一个文件**，然后重跑 `build.bat` 即可：脚本会自动调用 `desktop/gen_icon.py` 重新生成 `desktop/icon.ico` 并嵌入 exe，同时把 `logo.png` 同步到 `web/public/logo.png` 打包进网页。你无需手动维护 `web/public/logo.png` 或 `desktop/icon.ico`。

可选环境变量：`PORT`（网关监听端口，默认 5173）、`BACKEND_URL`（中转后端地址，默认 `http://localhost:8080`）。

## 客户端绑定与聊天历史边界

每个客户端实例只绑定一个远端项目。绑定值集中定义在 `web/src/config.ts`，默认是 `东东`；构建时可通过 `VITE_PROJECT` 覆盖。该值只用于满足 `/api/submit` 的 `project` 字段，不会在界面显示，也不能由用户切换。

当前后端 API 没有 `conversationId/chatId`，因此左侧“历史聊天”使用 `localStorage` 保存前端临时索引和本次客户端内消息。它不是后端事实来源，不能保证跨设备恢复，也不能精确导航回对应的远端原对话。完整历史恢复需要后端、SSE 和插件契约贯穿聊天 ID。

为避免没有聊天 ID 时误发到插件当前停留的其他对话，当前采用保守策略：主页首发和聊天区继续发送都提交 `newChat: true`。

## 功能清单

- [x] 原生式布局：Welcome 主页 + 历史聊天 Sidebar + 当前聊天区，窄屏 Drawer
- [x] 纯输入区：多行文本框 + 发送按钮（Enter 发送，Shift+Enter 换行）
- [x] 本地聊天索引：首条 prompt 生成标题，保存时间、摘要、消息数和状态
- [x] 发送流程：乐观更新 → SSE `pending/result/error/timeout` → 明确错误提示
- [x] 图片：点击放大/下载，`images[]` 空数组兼容
- [x] 桌面 exe：托盘 + 自动开浏览器 + 反代后端，单文件分发
- [x] 图标：网页、助手头像、托盘与 exe 文件图标统一由根目录 `logo.png` 生成

## 目录结构

```
web/                      前端源码（Vite + React + TS + MUI）
  index.html              SPA 入口
  package.json           依赖与脚本（dev / build / preview）
  vite.config.ts         dev 代理 /api、/files → :8080，base: './'
  tsconfig.json          类型检查配置
  src/                   业务代码
    api.ts               接口封装 + 图片 URL 拼接
    config.ts            唯一客户端绑定配置 + localStorage key
    types.ts             API 类型 + 前端临时 ChatRecord
    App.tsx              activeChatId / 本地历史 / 发送 / SSE 状态编排
    components/          Sidebar / Welcome / ConversationHeader / MessageList / MessageBubble / InputArea / ImageViewer / LightMarkdown
  node_modules/          依赖（gitignore）
  dist/                  构建产物（gitignore）

desktop/                 桌面网关（托盘 exe 实体，编译目标）
  main.go                gin 网关 + 反代 + 托盘
  go.mod / go.sum       网关依赖
  internal/static/       嵌入前端产物（dist，由 build 脚本拷贝）
  internal/browser/      跨平台打开浏览器
  gen_icon.py            生成桌面图标（多分辨率 BMP ICO：托盘 + exe 文件图标共用）
  rsrc.syso              编译期由 rsrc 从 icon.ico 生成，嵌入为 exe 文件图标（gitignore）

build.bat                 Windows 编译脚本（仅 Windows）
webmirror-desktop.exe     编译产物（gitignore）
README.md / HANDOFF.md   文档
```
