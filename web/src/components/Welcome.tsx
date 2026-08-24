import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import type { ReactNode } from "react";
import InputArea from "./InputArea";

interface Props {
  onSend: (prompt: string) => void;
  onMenu: () => void;
  sending: boolean;
  /** 右上角插槽：账号条（注册/绑定项目） */
  actions?: ReactNode;
}

export default function Welcome({ onSend, onMenu, sending, actions }: Props) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 1.5, sm: 3 },
        pb: { xs: 2, md: 8 },
        background:
          "radial-gradient(circle at 50% 34%, rgba(16,163,127,0.07), transparent 32%)",
      }}
    >
      <Tooltip title="打开历史聊天">
        <IconButton
          onClick={onMenu}
          aria-label="打开历史聊天"
          sx={{
            display: { xs: "inline-flex", md: "none" },
            position: "absolute",
            top: 12,
            left: 12,
          }}
        >
          <MenuRoundedIcon />
        </IconButton>
      </Tooltip>

      {actions && (
        <Box
          sx={{
            position: "absolute",
            top: 12,
            right: 16,
            zIndex: 1,
          }}
        >
          {actions}
        </Box>
      )}

      <Box
        component="img"
        src="/logo.png"
        alt="WebMirror"
        sx={{ width: 64, height: 64, objectFit: "contain", mb: 2.25 }}
      />
      <Typography
        variant="h4"
        sx={{ fontWeight: 750, letterSpacing: "-0.03em", textAlign: "center" }}
      >
        有什么可以帮你？
      </Typography>
      <Typography sx={{ mt: 1, mb: 3.5, color: "text.secondary", textAlign: "center" }}>
        WebMirror 将你的请求交由远端会话处理
      </Typography>
      <Box sx={{ width: "100%", maxWidth: 720 }}>
        <InputArea onSend={onSend} sending={sending} compact />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 2 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: "primary.main" }} />
        <Typography variant="body2" color="text.disabled">
          输入第一条消息即可开始新的聊天
        </Typography>
      </Box>
    </Box>
  );
}
