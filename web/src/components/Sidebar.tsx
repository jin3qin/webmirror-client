import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import MenuIcon from "@mui/icons-material/Menu";
import type { ChatRecord } from "../types";
import { fetchVersion } from "../api";

interface Props {
  chats: ChatRecord[];
  activeChatId: string | null;
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggle: () => void;
  onSelect: (chatId: string) => void;
  onNew: () => void;
  onDelete: (chatId: string) => void;
}

const DRAWER_WIDTH = 264;

export default function Sidebar({
  chats,
  activeChatId,
  open,
  collapsed,
  onClose,
  onToggle,
  onSelect,
  onNew,
  onDelete,
}: Props) {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    fetchVersion()
      .then((info) => setVersion(info.current))
      .catch(() => {
        /* 开发环境下无此端点，静默忽略 */
      });
  }, []);

  const sortedChats = [...chats].sort(
    (left, right) => (Date.parse(right.lastAt) || 0) - (Date.parse(left.lastAt) || 0),
  );

  const content = (
    <Box
      role="navigation"
      aria-label="历史聊天"
      sx={{
        width: DRAWER_WIDTH,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#f7f7f8",
      }}
    >
      <Box sx={{ px: 1.75, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 42 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="WebMirror logo"
            sx={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
          />
          <Typography sx={{ fontWeight: 750, letterSpacing: "-0.02em", flex: 1 }}>
            WebMirror
          </Typography>
          <Tooltip title={collapsed ? "展开侧栏" : "收起侧栏"}>
            <IconButton
              size="small"
              onClick={onToggle}
            >
              {collapsed ? <MenuIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ px: 1.25, pb: 1.25 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onNew}
          disabled={activeChatId === null}
          sx={{
            justifyContent: "flex-start",
            px: 1.5,
            py: 1,
            borderColor: "rgba(0,0,0,0.16)",
            color: "text.primary",
            bgcolor: "background.paper",
            "&:hover": {
              bgcolor: "rgba(16,163,127,0.06)",
              borderColor: "primary.main",
            },
          }}
        >
          新聊天
        </Button>
      </Box>

      <Divider />

      <List dense sx={{ px: 1, pt: 1, overflowY: "auto", flex: 1 }}>
        <Typography
          variant="overline"
          sx={{ px: 1.25, color: "text.secondary", fontWeight: 700, letterSpacing: "0.08em" }}
        >
          历史聊天
        </Typography>

        {sortedChats.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ px: 1.25, py: 2, color: "text.disabled", lineHeight: 1.6 }}
          >
            暂无聊天记录
          </Typography>
        ) : (
          sortedChats.map((chat) => {
            const selected = activeChatId === chat.id;
            return (
              <ListItemButton
                key={chat.id}
                selected={selected}
                onClick={() => {
                  onSelect(chat.id);
                  onClose();
                }}
                sx={itemSx}
              >
                <ChatBubbleOutlineRoundedIcon
                  sx={{
                    fontSize: 18,
                    mr: 1.1,
                    color: selected ? "primary.main" : "text.secondary",
                  }}
                />
                <ListItemText
                  primary={chat.title || "新聊天"}
                  secondary={`${formatTime(chat.lastAt)} · ${preview(chat.lastText)}`}
                  primaryTypographyProps={{
                    noWrap: true,
                    fontSize: "0.88rem",
                    fontWeight: selected ? 650 : 500,
                  }}
                  secondaryTypographyProps={{
                    noWrap: true,
                    fontSize: "0.72rem",
                    color: chat.error ? "error.main" : "text.secondary",
                  }}
                />
                <Chip
                  size="small"
                  label={chat.messageCount}
                  color={chat.pending ? "warning" : "default"}
                  sx={{
                    ml: 0.5,
                    mr: 0.25,
                    height: 21,
                    minWidth: 21,
                    fontSize: "0.68rem",
                    bgcolor: selected ? "rgba(16,163,127,0.14)" : undefined,
                  }}
                />
                <IconButton
                  aria-label="删除聊天"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(chat.id);
                  }}
                  sx={{
                    opacity: 0,
                    pointerEvents: "none",
                    ml: "auto",
                    p: 0.5,
                    color: "text.disabled",
                    transition: "opacity 0.15s",
                    "&:hover": { color: "error.main", bgcolor: "rgba(229,57,53,0.1)" },
                    [`&.Mui-focusVisible`]: { opacity: 1, pointerEvents: "auto" },
                    "@media (hover: hover)": {
                      ".MuiListItemButton-root:hover &": {
                        opacity: 1,
                        pointerEvents: "auto",
                      },
                    },
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            );
          })
        )}
      </List>

      <Box sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="caption" color="text.disabled">
          WebMirror 工作台
        </Typography>
        {version && (
          <Typography variant="caption" color="text.disabled">
            {version}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {/* 桌面端侧边栏 */}
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          flexShrink: 0,
          width: collapsed ? 60 : DRAWER_WIDTH,
          transition: "width 0.2s ease-in-out",
          overflow: "hidden",
          bgcolor: "#f7f7f8",
          borderRight: "1px solid",
          borderColor: "divider",
        }}
      >
        {collapsed ? (
          /* 收起状态：显示细条 */
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 2,
              px: 1,
              gap: 2,
            }}
          >
            {/* Logo + hover 展开图标 */}
            <Tooltip title="展开侧栏" placement="right">
              <Box
                onClick={onToggle}
                sx={{
                  position: "relative",
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  borderRadius: 1,
                  "&:hover .logo-img": { opacity: 0 },
                  "&:hover .expand-icon": { opacity: 1 },
                }}
              >
                <Box
                  className="logo-img"
                  component="img"
                  src="/logo.png"
                  alt="WebMirror logo"
                  sx={{
                    width: 28,
                    height: 28,
                    objectFit: "contain",
                    transition: "opacity 0.15s",
                    opacity: 1,
                  }}
                />
                <MenuIcon
                  className="expand-icon"
                  sx={{
                    position: "absolute",
                    fontSize: 24,
                    opacity: 0,
                    transition: "opacity 0.15s",
                    color: "primary.main",
                  }}
                />
              </Box>
            </Tooltip>

            {/* 新聊天按钮 */}
            <Tooltip title="新聊天" placement="right">
              <IconButton
                onClick={onNew}
                disabled={activeChatId === null}
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  "&:hover": {
                    bgcolor: "rgba(16,163,127,0.06)",
                    borderColor: "primary.main",
                  },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          /* 展开状态：完整侧边栏 */
          content
        )}
      </Box>

      {/* 移动端抽屉式侧边栏 */}
      <Drawer
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" } }}
        PaperProps={{ sx: { width: DRAWER_WIDTH } }}
      >
        {content}
      </Drawer>
    </>
  );
}

const itemSx = {
  borderRadius: 1.5,
  mb: 0.35,
  px: 1.25,
  py: 0.85,
  alignItems: "center",
  "&.Mui-selected": {
    bgcolor: "rgba(16,163,127,0.12)",
    "&:hover": { bgcolor: "rgba(16,163,127,0.17)" },
  },
};

function preview(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "暂无摘要";
  return compact.length > 22 ? `${compact.slice(0, 22)}…` : compact;
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";

  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}
