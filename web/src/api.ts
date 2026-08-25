import type { Account, ConversationSummary, Message, SubmitReq, SubmitResp } from "./types";
import { BACKEND_URL_KEY } from "./config";

/** 获取当前服务器地址：优先读 localStorage，未配置时返回空字符串（走网关代理） */
export function getBackendUrl(): string {
  try {
    const saved = localStorage.getItem(BACKEND_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    /* ignore */
  }
  return ""; // 空字符串表示使用相对路径，由网关或 Vite proxy 转发
}

/** 设置服务器地址（登录弹窗保存时调用） */
export function setBackendUrl(url: string): void {
  try {
    localStorage.setItem(BACKEND_URL_KEY, url.trim());
  } catch {
    /* ignore */
  }
}

/** 同源请求：开发环境由 Vite proxy 转发，桌面 exe 由网关反代。 */
const API_BASE = "";

// ===================== 登录态 token 管理 =====================

const TOKEN_KEY = "webmirror.token";

/** 读取本地保存的登录 token（刷新页面后自动恢复登录态） */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** 带 Authorization header 的 fetch 封装（受保护端点用） */
function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const backendUrl = getBackendUrl();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // 如果是本地开发（vite proxy），使用空 API_BASE；否则使用配置的服务器地址
  const base = import.meta.env.DEV ? API_BASE : backendUrl;
  return fetch(`${base}${input}`, { ...init, headers }).then((res) => {
    if (res.status === 401) {
      // 登录态失效（被其它设备登录踢下线 / 会话过期）：清除本地 token 并广播，
      // 由 App.tsx 监听后强制回到登录界面并提示。
      clearToken();
      window.dispatchEvent(new CustomEvent("webmirror:unauthorized"));
    }
    return res;
  });
}

/** 拼接后端图片完整 URL */
export function imageUrl(rel: string): string {
  if (!rel) return "";
  if (/^https?:\/\//i.test(rel)) return rel;
  const backendUrl = getBackendUrl();
  const base = import.meta.env.DEV ? API_BASE : backendUrl;
  return base + (rel.startsWith("/") ? rel : `/${rel}`);
}

/** 通用的 fetch 封装：自动根据环境选择服务器地址 */
function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const backendUrl = getBackendUrl();
  const base = import.meta.env.DEV ? API_BASE : backendUrl;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${base}${input}`, { ...init, headers });
}

// ===================== 桌面端版本 / 更新 =====================

export interface VersionInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
  releaseUrl: string;
}

/** 拉取当前/最新版本信息（桌面 exe 网关提供；dev 环境无此端点会抛错，调用方需静默处理） */
export async function fetchVersion(): Promise<VersionInfo> {
  // /desktop/* 端点由网关提供，强制走相对路径，不受服务器地址配置影响
  const response = await fetch(`${API_BASE}/desktop/version`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as VersionInfo;
}

/** 触发桌面端自更新（下载新 exe 并替换重启）。成功时进程会重启，请求可能不返回。 */
export async function triggerUpdate(): Promise<{ ok: boolean; error?: string }> {
  // /desktop/* 端点由网关提供，强制走相对路径，不受服务器地址配置影响
  const response = await fetch(`${API_BASE}/desktop/update/do`, { method: "POST" });
  const data = (await response.json().catch(() => ({ ok: false }))) as {
    ok: boolean;
    error?: string;
  };
  return data;
}

/** 测试后端连接（调用 /api/health 端点） */
export async function testBackendConnection(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${url}/api/health`, { method: "GET" });
    if (!response.ok) {
      return { ok: false, error: `连接失败: HTTP ${response.status}` };
    }
    const data = await response.json();
    return { ok: data.ok === true, error: data.ok ? undefined : "后端响应异常" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "连接失败" };
  }
}

// ===================== 账号 / 登录态 =====================

/** 注册即登录：用户名+密码 → {userId, username, token}。存量账号同名会 claim（补设密码） */
export async function registerAccount(
  username: string,
  password: string,
): Promise<{ userId: string; username: string; token: string }> {
  const response = await apiFetch("/api/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `注册失败: ${response.status}`);
  }
  const result = await response.json();
  setToken(result.token);
  return result;
}

/** 登录：用户名+密码 → {userId, username, token}。多端各领独立 token */
export async function loginAccount(
  username: string,
  password: string,
): Promise<{ userId: string; username: string; token: string }> {
  const response = await apiFetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `登录失败: ${response.status}`);
  }
  const result = await response.json();
  setToken(result.token);
  return result;
}

/** 登出：吊销当前 token（单设备下线） */
export async function logoutAccount(): Promise<void> {
  try {
    await authFetch("/api/logout", { method: "POST" });
  } catch {
    /* 即使请求失败也清除本地 token */
  }
  clearToken();
}

/** 查询当前登录账号 + 已绑定项目（GET /api/me，受保护） */
export async function fetchMe(): Promise<Account> {
  const response = await authFetch("/api/me");
  if (!response.ok) {
    clearToken();
    throw new Error(`登录态失效: ${response.status}`);
  }
  const raw = await response.json();
  // 后端返回字段为 chatgptProjectId，前端类型统一为 projectId（保持后端契约不变）
  return { ...raw, projectId: raw.chatgptProjectId } as Account;
}

/** 绑定项目（userId 由 token 决定，不可伪造） */
export async function bindProject(
  projectId: string,
): Promise<{ ok: boolean; userId: string; projectId: string }> {
  const response = await authFetch("/api/bind-project", {
    method: "POST",
    // 后端契约字段名保持 chatgptProjectId 不变
    body: JSON.stringify({ chatgptProjectId: projectId }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `绑定项目失败: ${response.status}`);
  }
  const result = await response.json();
  return { ok: result.ok, userId: result.userId, projectId: result.chatgptProjectId };
}

// ===================== 对话 / 历史 =====================

/** 拉取当前账号的对话列表（服务端权威，按 lastAt DESC） */
export async function fetchConversations(): Promise<ConversationSummary[]> {
  const response = await authFetch("/api/conversations");
  if (!response.ok) throw new Error(`拉取对话列表失败: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("对话列表返回格式错误");
  return data as ConversationSummary[];
}

/** 拉取单个对话的完整消息（受保护，按 conversationId 精确过滤） */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const params = new URLSearchParams({ conversationId, limit: "200" });
  const response = await authFetch(`/api/messages?${params}`);
  if (!response.ok) throw new Error(`拉取消息失败: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("消息接口返回格式错误");
  return data as Message[];
}

/** 关联删除：删该用户指定对话的全部消息（受保护，conversationId 取 query）。前端侧栏删对话时调用。 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const params = new URLSearchParams({ conversationId });
  const response = await authFetch(`/api/conversations?${params}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`删除对话失败: ${response.status}`);
}

// ===================== 提交 / SSE =====================

/** 提交 prompt（userId 由 token 解析），返回 taskId */
export async function submitPrompt(request: SubmitReq): Promise<SubmitResp> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const backendUrl = getBackendUrl();
  const base = import.meta.env.DEV ? API_BASE : backendUrl;
  const response = await fetch(`${base}/api/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `提交失败: ${response.status}`);
  }
  return response.json() as Promise<SubmitResp>;
}

/** SSE 流连接（依赖同源/开发代理；EventSource 不支持自定义 header，taskId 本身即凭据） */
export function openStream(taskId: string): EventSource {
  const backendUrl = getBackendUrl();
  const base = import.meta.env.DEV ? API_BASE : backendUrl;
  return new EventSource(`${base}/api/stream/${encodeURIComponent(taskId)}`);
}
