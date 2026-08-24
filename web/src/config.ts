/// <reference types="vite/client" />

/**
 * 当前客户端实例默认绑定的目标项目 id（地址栏 `g-p-xxx` 整段）。
 * 这是部署配置兜底值；正常运行时以「注册账号后 /api/bind-project 绑定的 projectId」为准。
 */
export const DEFAULT_PROJECT_ID =
  import.meta.env.VITE_PROJECT_ID?.trim() ||
  "g-p-6a89bad7609881918f4589bcce40de3f";

/**
 * 当前客户端实例绑定的目标项目名称（如「东东」），仅作展示/落库 project 字段用，
 * 不渲染到用户界面。路由键是 projectId，不是这个名字。
 */
export const DEFAULT_PROJECT =
  import.meta.env.VITE_PROJECT?.trim() || "东东";

/**
 * 前端临时聊天记录存储 key（localStorage）。
 * 现有后端无 chatId/conversationId 历史恢复能力，此存储仅是前端临时索引。
 */
export const CHAT_HISTORY_STORAGE_KEY = "webmirror.chat-records.v2";

/** 当前登录账号 userId 存储 key（注册/绑定后写入 localStorage） */
export const USER_STORAGE_KEY = "webmirror.user.v1";
