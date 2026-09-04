// ===== 后端 API 类型定义（对齐 backend/API.md v3：parts 图文穿插）=====

/** 结构化应答块（保留图文穿插顺序） */
export interface Part {
  type: "text" | "image" | "file";
  text?: string; // text
  src?: string; // image/file 的完整 URL（已落库）
  name?: string; // file 名
}

/** 历史消息（GET /api/messages 返回，最新在前） */
export interface Message {
  id: number;
  project: string;
  role: "user" | "assistant";
  text: string;
  images: string[];
  srcPage: string;
  createdAt: string;
  /** 原序 parts JSON（图文穿插），前端优先渲染；缺失时回退 text+images */
  parts?: string;
  /** 归属账号（后端 Phase 0 起返回） */
  userId?: string;
  /** 归属远端对话（/c/<id>，后端返回） */
  conversationId?: string;
}

/** 提交请求（userId 由后端从 token 解析，前端无需传） */
export interface SubmitReq {
  userId?: string;
  project: string;
  conversationId?: string;
  prompt: string;
  newChat: boolean;
}

/** 提交响应 */
export interface SubmitResp {
  taskId: string;
  /** v6：任务在队列中的位置（1 = 下一个被领取） */
  queuePosition: number;
}

/** v6 队列状态（GET /api/queue 返回） */
export interface QueueStatus {
  globalPending: number;
  maxQueueSize: number;
  userPending: number;
  maxUserPending: number;
  queuePosition: number;
}

/** SSE result 事件 data */
export interface SSEResult {
  taskId: string;
  userId: string;
  project: string;
  conversationId?: string;
  role: "assistant";
  text: string;
  images: string[];
  parts?: string;
  srcPage: string;
  createdAt: string;
}

/** SSE error 事件 data */
export interface SSEError {
  taskId: string;
  error: string;
}

/** SSE timeout 事件 data */
export interface SSETimeout {
  taskId: string;
}

/** 前端乐观更新的临时消息（负数 id 表示尚未从后端持久化） */
export interface OptimisticMessage {
  id: number;
  project: string;
  role: "user";
  text: string;
  images: string[];
  srcPage: string;
  createdAt: string;
  parts?: string;
  userId?: string;
  conversationId?: string;
  pending?: boolean;
}

export type DisplayMessage = Message | OptimisticMessage;

/**
 * 前端临时聊天索引。
 * conversationId 来自插件回写（/c/<id>），是续发导航键；
 * userId 是注册账号 id（= 前端 projectId），路由键。
 */
export interface ChatRecord {
  id: string;
  title: string;
  lastText: string;
  lastAt: string;
  messageCount: number;
  messages: DisplayMessage[];
  pending?: boolean;
  error?: string;
  /** 绑定到哪个远端对话（/c/<id>），续发导航键；首建为空，插件回写后填入 */
  conversationId?: string;
  /** 本聊天归属的账号 userId（= 前端 projectId） */
  userId?: string;
  /**
   * 该聊天是否已在远端建立过对话。
   * 缺失/false = 下一条消息仍需 newChat:true（在远端新建对话）；
   * true = 后续消息用 newChat:false 续发到同一对话。
   * 前端按「每条聊天只新建一次」驱动插件，避免每次发送都开新对话。
   */
  newChatDone?: boolean;
}

/** 账号信息（注册/绑定后从后端获取） */
export interface Account {
  userId: string;
  username: string;
  projectId: string;
  /** 登录态 token（仅 register/login 时后端返回；GET /api/me 不返回） */
  token?: string;
}

/** 服务端对话摘要（GET /api/conversations 返回，按 lastAt DESC） */
export interface ConversationSummary {
  conversationId: string;
  title: string;
  lastAt: string;
  messageCount: number;
}

export type ChatStatus = "connected" | "pending" | "error";
