import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import type { ReactNode } from "react";
import type { ChatStatus } from "../types";

interface Props {
  title: string;
  status: ChatStatus;
  onMenu: () => void;
  /** 右侧插槽：账号条（注册/绑定项目） */
  actions?: ReactNode;
}

const statusMeta: Record<ChatStatus, { label: string; color: "success" | "warning" | "error" }> = {
  connected: { label: "已连接", color: "success" },
  pending: { label: "等待应答中…", color: "warning" },
  error: { label: "执行失败", color: "error" },
};

export default function ConversationHeader({ title, status, onMenu, actions }: Props) {
  const meta = statusMeta[status];

  return (
    <Box
      component="header"
      sx={{
        minHeight: 64,
        px: { xs: 1.5, sm: 2.5, md: 3 },
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Tooltip title="打开历史聊天">
        <IconButton
          onClick={onMenu}
          sx={{ display: { xs: "inline-flex", md: "none" } }}
          aria-label="打开历史聊天"
        >
          <MenuRoundedIcon />
        </IconButton>
      </Tooltip>
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          bgcolor: "rgba(16,163,127,0.1)",
          color: "primary.main",
          flexShrink: 0,
        }}
      >
        <ForumRoundedIcon sx={{ fontSize: 19 }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {title || "新聊天"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          聊天记录
        </Typography>
      </Box>
      <Chip
        size="small"
        label={meta.label}
        color={meta.color}
        variant="outlined"
        sx={{ display: { xs: "none", sm: "inline-flex" } }}
      />
      {actions}
    </Box>
  );
}
