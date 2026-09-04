import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Snackbar } from "@mui/material";
import Sidebar from "./components/Sidebar";
import Welcome from "./components/Welcome";
import ConversationHeader from "./components/ConversationHeader";
import MessageList from "./components/MessageList";
import InputArea from "./components/InputArea";
import ImageViewer from "./components/ImageViewer";
import AccountBar from "./components/AccountBar";
import UpdateBanner from "./components/UpdateBanner";
import { openStream, submitPrompt, fetchMe, fetchConversations, fetchMessages, deleteConversation, getToken, clearToken, fetchQueueStatus } from "./api";
import { DEFAULT_PROJECT, CHAT_HISTORY_STORAGE_KEY, USER_STORAGE_KEY } from "./config";
import type { Account, ChatRecord, ChatStatus, DisplayMessage, SSEResult, QueueStatus } from "./types";

/** 从 localStorage 读取上次登录账号（仅作即时渲染兜底，真正身份靠 token 校验） */
function loadUser(): Account | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Account;
    if (a && typeof a.userId === "string") return a;
    return null;
  } catch {
    return null;
  }
}

type Notice = {
  msg: string;
  severity: "error" | "info" | "warning";
};

export default function App() {
  const [chatRecords, setChatRecords] = useState<ChatRecord[]>(loadStoredChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sendingChatId, setSendingChatId] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [account, setAccount] = useState<Account | null>(loadUser);
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const optimisticIdRef = useRef(-1);

  useEffect(() => {
    persistChats(chatRecords);
  }, [chatRecords]);

  // 启动时校验 token：有 token 则 fetchMe 恢复登录态，失效则清除
  useEffect(() => {
    if (!getToken()) return;
    fetchMe()
      .then((me) => {
        const acc: Account = { ...me };
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(acc));
        setAccount(acc);
      })
      .catch(() => {
        clearToken();
        localStorage.removeItem(USER_STORAGE_KEY);
        setAccount(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听「被其它设备登录顶替 / 会话失效」事件：强制回到登录并提示
  useEffect(() => {
    const onUnauthorized = () => {
      clearToken();
      localStorage.removeItem(USER_STORAGE_KEY);
      setAccount(null);
      setChatRecords([]);
      setActiveChatId(null);
      setNotice({ msg: "登录已失效：可能在其它设备登录了同一账号（已被顶替），请重新登录", severity: "warning" });
    };
    window.addEventListener("webmirror:unauthorized", onUnauthorized);
    return () => window.removeEventListener("webmirror:unauthorized", onUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登录态变化时从服务端同步对话列表（服务端权威）；登出则清空
  useEffect(() => {
    if (!account || !getToken()) {
      // 登出：清空本地对话
      setChatRecords([]);
      setActiveChatId(null);
      return;
    }
    fetchConversations()
      .then((convs) => {
        const serverChats: ChatRecord[] = convs.map((c) => ({
          id: c.conversationId,
          title: c.title || "新聊天",
          lastText: "",
          lastAt: c.lastAt,
          messageCount: c.messageCount,
          messages: [],
          conversationId: c.conversationId,
          newChatDone: true,
          userId: account.userId,
        }));
        setChatRecords((current) => {
          // 保留本地未发送草稿（无 conversationId 的）；服务端已有的以服务端为准
          const drafts = current.filter((c) => !c.conversationId);
          return [...drafts, ...serverChats];
        });
      })
      .catch((e) => {
        console.warn("同步对话列表失败:", e);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.userId]);

  // v6 队列状态轮询：登录后每 5 秒刷新一次
  useEffect(() => {
    if (!account || !getToken()) {
      setQueueStatus(null);
      return;
    }

    const poll = () => {
      fetchQueueStatus()
        .then(setQueueStatus)
        .catch(() => {
          /* 静默失败 */
        });
    };

    poll(); // 立即拉一次
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [account?.userId]);

  const activeChat = useMemo(
    () => chatRecords.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chatRecords],
  );

  const updateChat = useCallback(
    (chatId: string, updater: (chat: ChatRecord) => ChatRecord) => {
      setChatRecords((current) =>
        current.map((chat) => (chat.id === chatId ? updater(chat) : chat)),
      );
    },
    [],
  );

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setMobileSidebarOpen(false);
  }, []);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setActiveChatId(chatId);
      setMobileSidebarOpen(false);
      // 按需加载：服务端对话（有 conversationId）且本地消息为空时，从后端拉完整历史
      const chat = chatRecords.find((c) => c.id === chatId);
      if (chat && chat.conversationId && chat.messages.length === 0) {
        // D：标记该对话历史加载中，MessageList 显示 loading 而非过早「暂无消息」
        setLoadingConvId(chatId);
        fetchMessages(chat.conversationId)
          .then((msgs) => {
            // 后端返回 DESC（最新在前），展示需 ASC（旧→新）
            const ordered = [...msgs].reverse().map((m) => m as DisplayMessage);
            updateChat(chatId, (c) => ({
              ...c,
              messages: ordered,
              messageCount: ordered.length,
              lastText: ordered.at(-1)?.text || c.lastText,
            }));
          })
          .catch((e) => {
            setNotice({ msg: `加载历史失败: ${e instanceof Error ? e.message : e}`, severity: "error" });
          })
          .finally(() => {
            setLoadingConvId((cur) => (cur === chatId ? null : cur));
          });
      }
    },
    [chatRecords, updateChat],
  );

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      const chat = chatRecords.find((c) => c.id === chatId);
      // 关联删除：服务端对话（有 conversationId）一并删后端消息，保证本地与服务端一致
      if (chat?.conversationId) {
        deleteConversation(chat.conversationId).catch((e) => {
          setNotice({
            msg: `服务端对话删除失败: ${e instanceof Error ? e.message : e}（本地已移除）`,
            severity: "warning",
          });
        });
      }
      setChatRecords((current) => current.filter((c) => c.id !== chatId));
      setActiveChatId((prev) => (prev === chatId ? null : prev));
    },
    [chatRecords],
  );

  // A：失败消息内联重试——重发同一条 prompt 到同一对话（有 conversationId 则续发，否则新建）。
  // 独立于 handleSend，复用 SSE 收结果逻辑但不动已测的发送主链路。
  const retryChat = useCallback(
    async (chatId: string) => {
      if (sendingChatId) return;
      if (!account || !getToken()) {
        setNotice({ msg: "尚未登录：请先在右上角登录", severity: "warning" });
        return;
      }
      const chat = chatRecords.find((c) => c.id === chatId);
      if (!chat) return;
      const prompt =
        [...chat.messages].reverse().find((m) => m.role === "user")?.text ?? chat.lastText;
      if (!prompt) return;

      // 标记最后一条 user 消息为 pending + 清 error
      const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
      updateChat(chatId, (c) => ({
        ...c,
        error: undefined,
        pending: true,
        messages: c.messages.map((m) => (m === lastUser ? { ...m, pending: true } : m)),
      }));
      setActiveChatId(chatId);
      setSendingChatId(chatId);

      let stream: EventSource | null = null;
      let settled = false;
      const complete = (updater: (c: ChatRecord) => ChatRecord) => {
        if (settled) return;
        settled = true;
        stream?.close();
        setSendingChatId((cur) => (cur === chatId ? null : cur));
        updateChat(chatId, updater);
      };
      const markFailed = (message: string) => {
        complete((c) => ({ ...c, pending: false, error: message }));
      };

      try {
        const needNewChat = !chat.newChatDone;
        const { taskId } = await submitPrompt({
          project: DEFAULT_PROJECT,
          conversationId: needNewChat ? undefined : chat.conversationId,
          prompt,
          newChat: needNewChat,
        });
        stream = openStream(taskId);
        stream.addEventListener("pending", () =>
          setNotice({ msg: "任务已提交，等待插件响应…", severity: "info" }),
        );
        stream.addEventListener("result", (event) => {
          try {
            const data = JSON.parse((event as MessageEvent<string>).data) as SSEResult;
            const assistantMessage: DisplayMessage = {
              id: Date.now(),
              project: data.project || DEFAULT_PROJECT,
              role: "assistant",
              text: data.text || "",
              images: Array.isArray(data.images) ? data.images : [],
              parts: data.parts,
              srcPage: data.srcPage || "",
              createdAt: data.createdAt || new Date().toISOString(),
              userId: data.userId,
              conversationId: data.conversationId,
            };
            complete((c) => {
              const messages = [...c.messages, assistantMessage];
              return {
                ...c,
                messages,
                lastText: assistantMessage.text || prompt,
                lastAt: assistantMessage.createdAt,
                messageCount: messages.length,
                pending: false,
                error: undefined,
                newChatDone: true,
                conversationId: c.conversationId || data.conversationId,
              };
            });
          } catch {
            markFailed("应答数据格式错误");
            setNotice({ msg: "应答数据格式错误", severity: "error" });
          }
        });
        stream.addEventListener("error", (event) => {
          const payload = (event as MessageEvent<string>).data;
          if (!payload) return;
          let errorMessage = "任务执行失败";
          try {
            const data = JSON.parse(payload) as { error?: string };
            if (data.error) errorMessage = data.error;
          } catch { /* ignore */ }
          markFailed(errorMessage);
          setNotice({ msg: errorMessage, severity: "error" });
        });
        stream.addEventListener("timeout", () => {
          const message = "等待应答超时，请确认远端页面已打开并登录。可尝试重新发送。";
          markFailed(message);
          setNotice({ msg: message, severity: "warning" });
        });
        stream.onerror = () => {
          if (settled) return;
          const message = "与后端的连接已断开，请确认中转后端已启动。";
          markFailed(message);
          setNotice({ msg: message, severity: "error" });
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : "未知错误";
        markFailed(`提交失败：${detail}。请确认中转后端已启动。`);
        setNotice({ msg: `提交失败：${detail}。请确认中转后端已启动。`, severity: "error" });
      }
    },
    [account, chatRecords, sendingChatId, updateChat, setNotice],
  );

  const handleSend = useCallback(
    async (prompt: string) => {
      if (sendingChatId) return;
      if (!account || !getToken()) {
        setNotice({ msg: "尚未登录：请先在右上角登录", severity: "warning" });
        return;
      }

      // v6 队列配额检查：实时查询，不依赖缓存
      try {
        const currentQueue = await fetchQueueStatus();
        if (currentQueue.globalPending >= currentQueue.maxQueueSize) {
          setNotice({
            msg: `队列已满（${currentQueue.globalPending}/${currentQueue.maxQueueSize}），请稍后再试`,
            severity: "error",
          });
          return;
        }
        if (currentQueue.userPending >= currentQueue.maxUserPending) {
          setNotice({
            msg: "您已有任务在排队或执行中，请等待完成后再提交",
            severity: "warning",
          });
          return;
        }
      } catch (e) {
        // 查询失败时不阻止提交，让后端再次检查
        console.warn("队列状态查询失败，继续提交", e);
      }

      const now = new Date().toISOString();
      const optimisticId = optimisticIdRef.current--;
      const userMessage: DisplayMessage = {
        id: optimisticId,
        project: DEFAULT_PROJECT,
        role: "user",
        text: prompt,
        images: [],
        srcPage: "",
        createdAt: now,
        userId: account?.userId,
        pending: true,
      };

      let chatId = activeChatId;
      if (!chatId) {
        chatId = createChatId();
        const chat: ChatRecord = {
          id: chatId,
          title: createTitle(prompt),
          lastText: prompt,
          lastAt: now,
          messageCount: 1,
          messages: [userMessage],
          pending: true,
          userId: account?.userId,
        };
        setChatRecords((current) => [chat, ...current]);
        setActiveChatId(chatId);
      } else {
        updateChat(chatId, (chat) => {
          const messages = [...chat.messages, userMessage];
          return {
            ...chat,
            messages,
            lastText: prompt,
            lastAt: now,
            messageCount: messages.length,
            pending: true,
            error: undefined,
          };
        });
      }

      setSendingChatId(chatId);
      let stream: EventSource | null = null;
      let settled = false;

      const complete = (updater: (chat: ChatRecord) => ChatRecord) => {
        if (settled) return;
        settled = true;
        stream?.close();
        setSendingChatId((current) => (current === chatId ? null : current));
        updateChat(chatId, updater);
      };

      const markFailed = (message: string) => {
        complete((chat) => {
          const messages = chat.messages.map((item) =>
            item.id === optimisticId && "pending" in item
              ? { ...item, pending: false }
              : item,
          );
          return {
            ...chat,
            messages,
            messageCount: messages.length,
            pending: false,
            error: message,
          };
        });
      };

      try {
        /*
         * 每条聊天只新建一次远端对话：首条消息 newChat:true（在远端新建对话），
         * 之后的消息 newChat:false（续发到同一对话，复用插件 runCapture 续发分支）。
         * 这样避免「每次发送都开一个新对话」。
         * 续发携带 conversationId，插件会导航纠正到该对话（即使远端页面切走也会自动跳回）。
         */
        const targetChat = activeChatId
          ? chatRecords.find((c) => c.id === activeChatId) ?? null
          : null;
        const needNewChat = !targetChat || !targetChat.newChatDone;

        const { taskId } = await submitPrompt({
          project: DEFAULT_PROJECT,
          conversationId: needNewChat ? undefined : targetChat?.conversationId,
          prompt,
          newChat: needNewChat,
        });

        stream = openStream(taskId);

        stream.addEventListener("pending", (event) => {
          try {
            const data = JSON.parse((event as MessageEvent<string>).data) as { queuePosition?: number };
            if (data.queuePosition && data.queuePosition > 0) {
              setNotice({
                msg: `任务已提交，前面还有 ${data.queuePosition - 1} 人在排队…`,
                severity: "info",
              });
            } else {
              setNotice({ msg: "任务已提交，等待插件响应…", severity: "info" });
            }
          } catch {
            setNotice({ msg: "任务已提交，等待插件响应…", severity: "info" });
          }
        });

        stream.addEventListener("result", (event) => {
          try {
            const data = JSON.parse((event as MessageEvent<string>).data) as SSEResult;
            const assistantMessage: DisplayMessage = {
              id: Date.now(),
              project: data.project || DEFAULT_PROJECT,
              role: "assistant",
              text: data.text || "",
              images: Array.isArray(data.images) ? data.images : [],
              parts: data.parts,
              srcPage: data.srcPage || "",
              createdAt: data.createdAt || new Date().toISOString(),
              userId: data.userId,
              conversationId: data.conversationId,
            };

            complete((chat) => {
              const completedUserMessages = chat.messages.map((item) =>
                item.id === optimisticId && "pending" in item
                  ? { ...item, pending: false }
                  : item,
              );
              const messages = [...completedUserMessages, assistantMessage];
              return {
                ...chat,
                messages,
                lastText: assistantMessage.text || prompt,
                lastAt: assistantMessage.createdAt,
                messageCount: messages.length,
                pending: false,
                error: undefined,
                newChatDone: true,
                // 续发/新建对话的 conversationId 由插件回写（SSE result 携带），前端持久化绑定
                conversationId: chat.conversationId || data.conversationId,
              };
            });
          } catch {
            markFailed("应答数据格式错误");
            setNotice({ msg: "应答数据格式错误", severity: "error" });
          }
        });

        stream.addEventListener("error", (event) => {
          const payload = (event as MessageEvent<string>).data;
          if (!payload) return;

          let errorMessage = "任务执行失败";
          try {
            const data = JSON.parse(payload) as { error?: string };
            if (data.error) errorMessage = data.error;
          } catch {
            errorMessage = "任务执行失败";
          }

          markFailed(errorMessage);
          setNotice({ msg: errorMessage, severity: "error" });
        });

        stream.addEventListener("timeout", () => {
          const message = "等待应答超时，请确认远端页面已打开并登录。可尝试重新发送。";
          markFailed(message);
          setNotice({ msg: message, severity: "warning" });
        });

        stream.onerror = () => {
          if (settled) return;
          const message = "与后端的连接已断开，请确认中转后端已启动。";
          markFailed(message);
          setNotice({ msg: message, severity: "error" });
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : "未知错误";
        const message = `提交失败：${detail}。请确认中转后端已启动。`;
        markFailed(message);
        setNotice({ msg: message, severity: "error" });
      }
    },
    [account, activeChatId, chatRecords, sendingChatId, updateChat],
  );

  const status: ChatStatus = activeChat?.pending
    ? "pending"
    : activeChat?.error
      ? "error"
      : "connected";

  return (
    <Box sx={{ display: "flex", height: "100vh", minHeight: 0, bgcolor: "background.default" }}>
      <Sidebar
        chats={chatRecords}
        activeChatId={activeChatId}
        open={mobileSidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setMobileSidebarOpen(false)}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        onSelect={handleSelectChat}
        onNew={handleNewChat}
        onDelete={handleDeleteChat}
      />

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <UpdateBanner />
        {!activeChat ? (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
            <Welcome
              onSend={handleSend}
              onMenu={() => setMobileSidebarOpen(true)}
              sending={Boolean(sendingChatId)}
              globalQueueFull={queueStatus ? queueStatus.globalPending >= queueStatus.maxQueueSize : false}
              userQuotaFull={queueStatus ? queueStatus.userPending >= queueStatus.maxUserPending : false}
              queuePosition={queueStatus?.queuePosition || 0}
              actions={<AccountBar account={account} onChange={setAccount} />}
            />
          </Box>
        ) : (
          <>
            <ConversationHeader
              title={activeChat.title}
              status={status}
              onMenu={() => setMobileSidebarOpen(true)}
              actions={<AccountBar account={account} onChange={setAccount} />}
            />
            {activeChat.error && (
              <Alert
                severity="error"
                variant="filled"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    disabled={Boolean(sendingChatId)}
                    onClick={() => retryChat(activeChat.id)}
                  >
                    重试
                  </Button>
                }
                sx={{ borderRadius: 0 }}
              >
                {activeChat.error}
              </Alert>
            )}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <MessageList
                messages={activeChat.messages}
                loading={loadingConvId === activeChat.id}
                onImageClick={setViewerImage}
              />
            </Box>
            <InputArea
              onSend={handleSend}
              sending={Boolean(sendingChatId)}
              globalQueueFull={queueStatus ? queueStatus.globalPending >= queueStatus.maxQueueSize : false}
              userQuotaFull={queueStatus ? queueStatus.userPending >= queueStatus.maxUserPending : false}
              queuePosition={queueStatus?.queuePosition || 0}
            />
          </>
        )}
      </Box>

      <ImageViewer src={viewerImage} onClose={() => setViewerImage(null)} />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {notice ? (
          <Alert
            onClose={() => setNotice(null)}
            severity={notice.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {notice.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

function createChatId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (!compact) return "新聊天";
  return compact.length > 30 ? `${compact.slice(0, 30)}…` : compact;
}

function loadStoredChats(): ChatRecord[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isStoredChat)
      .slice(0, 50)
      .map((chat) => {
        const messages = chat.messages.filter(isStoredMessage).slice(-200);
        return {
          id: chat.id,
          title: chat.title || "新聊天",
          lastText: chat.lastText || messages.at(-1)?.text || "",
          lastAt: chat.lastAt || messages.at(-1)?.createdAt || new Date().toISOString(),
          messageCount: messages.length,
          messages,
          pending: false,
          error: chat.error,
          // 刷新后必须保留对话绑定：conversationId 是续发导航键，
          // newChatDone 决定下一条消息是新建还是续发，丢失会导致重复开新对话。
          conversationId: chat.conversationId,
          newChatDone: chat.newChatDone,
          userId: chat.userId,
        };
      });
  } catch (error) {
    console.warn("读取本地聊天记录失败:", error);
    return [];
  }
}

function persistChats(chats: ChatRecord[]): void {
  try {
    const snapshot = chats.slice(0, 50).map((chat) => ({
      ...chat,
      pending: false,
      messages: chat.messages.slice(-200).map((message) =>
        "pending" in message ? { ...message, pending: false } : message,
      ),
    }));
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("保存本地聊天记录失败:", error);
  }
}

function isStoredChat(value: unknown): value is ChatRecord {
  if (!value || typeof value !== "object") return false;
  const chat = value as Partial<ChatRecord>;
  return (
    typeof chat.id === "string" &&
    typeof chat.title === "string" &&
    typeof chat.lastText === "string" &&
    typeof chat.lastAt === "string" &&
    Array.isArray(chat.messages)
  );
}

function isStoredMessage(value: unknown): value is DisplayMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<DisplayMessage>;
  return (
    typeof message.id === "number" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string" &&
    Array.isArray(message.images) &&
    typeof message.createdAt === "string"
  );
}
