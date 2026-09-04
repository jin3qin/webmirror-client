import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, TextField } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";

interface Props {
  onSend: (prompt: string) => void;
  sending: boolean;
  compact?: boolean;
  /** 全局队列已满 */
  globalQueueFull?: boolean;
  /** 用户配额已满（有任务在跑） */
  userQuotaFull?: boolean;
  /** 排队位置 */
  queuePosition?: number;
}

export default function InputArea({ onSend, sending, compact = false, globalQueueFull, userQuotaFull, queuePosition }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (compact) inputRef.current?.focus();
  }, [compact]);

  // 任一队列满都禁止提交
  const disabled = globalQueueFull || userQuotaFull;

  const handleSend = () => {
    const prompt = text.trim();
    if (!prompt || sending || disabled) return;
    onSend(prompt);
    setText("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // 队列状态提示文本：区分全局满和用户满
  const queueHint = globalQueueFull
    ? "系统繁忙，请稍后再试"
    : userQuotaFull
    ? "您有任务正在执行，请等待完成"
    : queuePosition && queuePosition > 0
    ? `前面还有 ${queuePosition - 1} 人在排队…`
    : "";

  return (
    <Box
      sx={{
        borderTop: compact ? "none" : "1px solid",
        borderColor: "divider",
        bgcolor: compact ? "transparent" : "background.paper",
        px: { xs: 1.5, sm: compact ? 0 : 3 },
        py: compact ? 0 : 1.75,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
        border: "1px solid",
        borderColor: text ? "primary.main" : "rgba(0,0,0,0.15)",
        borderRadius: 3,
        bgcolor: compact ? "transparent" : "background.paper",
        px: 1.25,
        py: 1,
        boxShadow: compact
          ? "0 4px 16px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "border-color 0.2s, box-shadow 0.2s",
          "&:focus-within": {
            borderColor: "primary.main",
            boxShadow: "0 0 0 3px rgba(16,163,127,0.12)",
          },
        }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          minRows={compact ? 2 : 1}
          maxRows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? queueHint : "输入消息…"}
          disabled={sending || disabled}
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{
            px: 0.5,
            "& .MuiInputBase-input": { fontSize: "0.95rem", lineHeight: 1.55 },
          }}
        />
        <Button
          aria-label="发送消息"
          variant="contained"
          disabled={!text.trim() || sending || disabled}
          onClick={handleSend}
          sx={{ minWidth: 40, width: 40, height: 40, p: 0, borderRadius: 2, flexShrink: 0 }}
        >
          {sending ? (
            <CircularProgress size={19} color="inherit" />
          ) : (
            <SendRoundedIcon sx={{ fontSize: 19 }} />
          )}
        </Button>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", mt: 0.75 }}>
        <Box component="span" sx={{ fontSize: "0.68rem", color: queueHint ? "warning.main" : "text.disabled" }}>
          {queueHint || "Enter 发送 · Shift+Enter 换行"}
        </Box>
      </Box>
    </Box>
  );
}
