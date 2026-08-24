# webmirror-client

远端会话中转前端，Vite + React + TypeScript + MUI。

## 功能

- 聊天式界面，主页 + 历史聊天侧栏
- 输入框发送消息，SSE 实时流式应答
- 支持图片放大/下载
- 桌面 exe，托盘图标，单文件分发
- 自定义 logo，一键替换

## 运行

**开发：**
```bash
cd web && npm install && npm run dev
```

**编译桌面版：**
```bash
build.bat
```

产物：`webmirror-desktop.exe`

## 更换 Logo

替换根目录 `logo.png`，重跑 `build.bat`，网页、托盘、exe 图标全部自动更新。

