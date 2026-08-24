import { useState, useMemo } from "react";
import { Box, Typography, ButtonBase } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonIcon from "@mui/icons-material/Person";
import LightMarkdown from "./LightMarkdown";
import PartsRenderer from "./PartsRenderer";
import type { DisplayMessage, Part } from "../types";
import { imageUrl } from "../api";

/** 后端 parts JSON → Part[]；解析失败或无有效块时返回空数组（走回退路径）。 */
function parseParts(raw?: string): Part[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p) => p && (p.type === "text" || p.type === "image" || p.type === "file"),
    ) as Part[];
  } catch {
    return [];
  }
}

interface Props {
  message: DisplayMessage;
  onImageClick: (src: string) => void;
}

export default function MessageBubble({ message, onImageClick }: Props) {
  const isUser = message.role === "user";
  const [expanded, setExpanded] = useState(false);

  // 优先使用后端 parts（保留图文穿插顺序）；解析失败或无 parts 时回退 text+images。
  const parts = useMemo(() => parseParts(message.parts), [message.parts]);
  const hasParts = !isUser && parts.length > 0;

  // 文本过长时折叠（仅针对非 parts 的纯文本回退路径）
  const MAX_PREVIEW = 500;
  const isLong = !hasParts && message.text.length > MAX_PREVIEW;
  const displayText = isLong && !expanded
    ? message.text.slice(0, MAX_PREVIEW) + "..."
    : message.text;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 2,
        px: { xs: 1, sm: 2 },
      }}
    >
      {/* 助手头像统一使用根 logo.png 经构建同步后的网页 logo。 */}
      {!isUser && (
        <Box
          component="img"
          src="/logo.png"
          alt="WebMirror"
          sx={{
            flexShrink: 0,
            width: 36,
            height: 36,
            objectFit: "contain",
            mr: 1.5,
            mt: 0.5,
          }}
        />
      )}

      <Box
        sx={{
          // 用户气泡保持限宽；助手消息平铺展开（仿原生无气泡），去掉限宽
          maxWidth: isUser ? { xs: "85%", sm: "72%", md: "60%" } : "100%",
        }}
      >
        {/* 气泡：仅用户侧；助手侧直接平铺（无圆角/背景/边框/阴影），仿原文展示 */}
        {isUser ? (
          <Box
            sx={{
              bgcolor: "primary.main",
              color: "white",
              borderRadius: 2,
              px: 2.5,
              py: 1.5,
            }}
          >
            <Typography
              sx={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: 1.6,
                fontSize: "0.95rem",
              }}
            >
              {message.text}
            </Typography>
          </Box>
        ) : (
          /* 助手平铺渲染：优先 parts（图文穿插），否则轻量 Markdown 回退 */
          <>
            {hasParts ? (
              <PartsRenderer parts={parts} onImageClick={onImageClick} />
            ) : (
              <Box className="markdown-body">
                <LightMarkdown text={displayText || "(空应答)"} />
              </Box>
            )}

            {/* 折叠/展开 */}
            {isLong && (
              <ButtonBase
                onClick={() => setExpanded(!expanded)}
                sx={{ display: "flex", alignItems: "center", mt: 0.5, fontSize: "0.8rem", color: "primary.main" }}
              >
                <ExpandMoreIcon
                  sx={{
                    transform: expanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    fontSize: 18,
                  }}
                />
                {expanded ? "收起" : "展开全部"}
              </ButtonBase>
            )}

            {/* 图片区（仅当无 parts 时回退：把独立 images 数组堆在下方） */}
            {message.images && message.images.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                {message.images.map((img, i) => (
                  <Box
                    key={i}
                    component="img"
                    src={imageUrl(img)}
                    alt={`图片 ${i + 1}`}
                    onClick={() => onImageClick(imageUrl(img))}
                    sx={{
                      maxWidth: 220,
                      maxHeight: 220,
                      borderRadius: 1.5,
                      cursor: "pointer",
                      objectFit: "cover",
                      border: "1px solid",
                      borderColor: "divider",
                      transition: "transform 0.15s",
                      "&:hover": { transform: "scale(1.03)" },
                    }}
                  />
                ))}
              </Box>
            )}
          </>
        )}

        {/* 时间戳 */}
        <Typography
          sx={{
            fontSize: "0.7rem",
            color: "text.disabled",
            mt: 0.3,
            textAlign: isUser ? "right" : "left",
          }}
        >
          {formatTime(message.createdAt)}
          {"pending" in message && message.pending && " · 等待应答中..."}
        </Typography>
      </Box>

      {/* 用户头像 */}
      {isUser && (
        <Box
          sx={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            bgcolor: "secondary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ml: 1.5,
            mt: 0.5,
          }}
        >
          <PersonIcon sx={{ color: "white", fontSize: 20 }} />
        </Box>
      )}
    </Box>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
