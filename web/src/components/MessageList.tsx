import { useEffect, useRef } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import type { DisplayMessage } from "../types";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: DisplayMessage[];
  loading: boolean;
  onImageClick: (src: string) => void;
}

export default function MessageList({ messages, loading, onImageClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // 新消息时滚动到底部（首次加载用 auto 避免长列表平滑滚动卡顿）
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isFirstRender.current ? "auto" : "smooth",
      block: "end",
    });
    isFirstRender.current = false;
  }, [messages.length]);

  if (loading && messages.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          gap: 1,
        }}
      >
        <Typography variant="h5" color="text.secondary">
          该对话暂无消息
        </Typography>
        <Typography variant="body2" color="text.disabled">
          在下方输入消息，发送后将通过后端中转处理
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        py: 2,
        "&::-webkit-scrollbar": { width: 6 },
        "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(0,0,0,0.15)", borderRadius: 3 },
      }}
    >
      {messages.map((msg, i) => (
        <MessageBubble key={`${msg.id}-${i}`} message={msg} onImageClick={onImageClick} />
      ))}
      <div ref={bottomRef} />
    </Box>
  );
}
