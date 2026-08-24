import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import {
  bindProject,
  fetchMe,
  loginAccount,
  logoutAccount,
  registerAccount,
  getBackendUrl,
  setBackendUrl,
  testBackendConnection,
} from "../api";
import { USER_STORAGE_KEY, LAST_USERNAME_KEY } from "../config";
import type { Account } from "../types";

interface Props {
  account: Account | null;
  onChange: (account: Account | null) => void;
}

type Mode = "login" | "register";

/**
 * 账号条：未登录时显示「登录/注册」入口；已登录显示用户名与已绑定的项目。
 * 完整账号系统：密码登录 + token 登录态 + 多端。
 */
export default function AccountBar({ account, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 后端地址配置
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backendUrl, setBackendUrlState] = useState(getBackendUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // 自动填充上次登录用户名
  useEffect(() => {
    if (open && mode === "login") {
      try {
        const lastUsername = localStorage.getItem(LAST_USERNAME_KEY);
        if (lastUsername && !username) {
          setUsername(lastUsername);
        }
      } catch {
        /* ignore */
      }
    }
  }, [open, mode, username]);

  const handleAuth = async () => {
    setErr(null);
    if (!username.trim()) {
      setErr("请填写用户名");
      return;
    }
    if (password.length < 6) {
      setErr("密码至少 6 位");
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await loginAccount(username.trim(), password)
          : await registerAccount(username.trim(), password);

      // 注册/登录后拉取完整账号信息（含已绑定项目）
      let boundProjectId = "";
      try {
        const me = await fetchMe();
        boundProjectId = me.projectId;
      } catch {
        /* fetchMe 失败不阻塞登录 */
      }

      // 注册时若填了项目 id，立即绑定
      if (mode === "register" && projectId.trim()) {
        try {
          const bind = await bindProject(projectId.trim());
          boundProjectId = bind.projectId;
        } catch {
          /* 绑定失败不阻塞 */
        }
      }

      const acc: Account = {
        userId: result.userId,
        username: result.username,
        projectId: boundProjectId,
        token: result.token,
      };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(acc));
      // 保存用户名用于下次自动填充（不保存密码）
      localStorage.setItem(LAST_USERNAME_KEY, username.trim());
      onChange(acc);
      setOpen(false);
      setPassword("");
      setProjectId("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testBackendConnection(backendUrl);
    setTestResult(result);
    setTesting(false);
  };

  const handleSaveBackendUrl = () => {
    setBackendUrl(backendUrl);
    setSettingsOpen(false);
  };

  const handleLogout = async () => {
    await logoutAccount();
    localStorage.removeItem(USER_STORAGE_KEY);
    onChange(null);
  };

  if (!account) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button variant="contained" size="small" onClick={() => { setMode("login"); setOpen(true); }}>
          登录 / 注册
        </Button>
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>{mode === "login" ? "登录" : "注册"}</DialogTitle>
          <DialogContent sx={{ width: 360, display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Select
              size="small"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              fullWidth
            >
              <MenuItem value="login">登录已有账号</MenuItem>
              <MenuItem value="register">注册新账号</MenuItem>
            </Select>
            {mode === "register" && (
              <Typography variant="body2" color="text.secondary">
                注册即登录。存量无密码账号用「注册」同名补设密码即可 claim。
              </Typography>
            )}
            <TextField
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              size="small"
              fullWidth
              autoFocus
            />
            <TextField
              label="密码"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw((v) => !v)} edge="end">
                      {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {mode === "register" && (
              <TextField
                label="项目 id（g-p-xxx，可稍后填）"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                size="small"
                fullWidth
                placeholder="g-p-6a89bad7609881918f4589bcce40de3f"
              />
            )}
            {err && <Typography color="error" variant="body2">{err}</Typography>}
          </DialogContent>
          <DialogActions>
            <Tooltip title="配置后端地址">
              <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleAuth} variant="contained" disabled={busy}>
              {busy ? "处理中…" : mode === "login" ? "登录" : "注册"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 后端地址设置对话框 */}
        <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
          <DialogTitle>后端配置</DialogTitle>
          <DialogContent sx={{ width: 400, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="后端地址"
              value={backendUrl}
              onChange={(e) => setBackendUrlState(e.target.value)}
              size="small"
              fullWidth
              placeholder="http://localhost:8080"
              helperText="WebMirror 后端服务地址"
              sx={{ mt: 1 }}
            />
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestConnection}
                disabled={testing || !backendUrl.trim()}
              >
                {testing ? "测试中…" : "测试连接"}
              </Button>
              {testResult && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {testResult.ok ? (
                    <>
                      <CheckCircleIcon color="success" fontSize="small" />
                      <Typography variant="body2" color="success.main">连接成功</Typography>
                    </>
                  ) : (
                    <>
                      <ErrorIcon color="error" fontSize="small" />
                      <Typography variant="body2" color="error.main">{testResult.error}</Typography>
                    </>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsOpen(false)}>取消</Button>
            <Button onClick={handleSaveBackendUrl} variant="contained">保存</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {account.username}
        {account.projectId ? ` · ${account.projectId}` : " · 未绑项目"}
      </Typography>
      <Button size="small" variant="outlined" onClick={() => setOpen(true)}>
        绑定项目
      </Button>
      <Tooltip title="登出">
        <IconButton size="small" onClick={handleLogout}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>绑定项目</DialogTitle>
        <DialogContent sx={{ width: 360, display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            填入项目地址栏的 id（g-p-xxx）。当前已绑：{account.projectId || "无"}
          </Typography>
          <TextField
            label="项目 id（g-p-xxx）"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            size="small"
            fullWidth
            placeholder="g-p-6a89bad7609881918f4589bcce40de3f"
          />
          {err && <Typography color="error" variant="body2">{err}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button
            onClick={async () => {
              setErr(null);
              if (!projectId.trim()) {
                setErr("请填写项目 id");
                return;
              }
              setBusy(true);
              try {
                const bind = await bindProject(projectId.trim());
                const acc: Account = { ...account, projectId: bind.projectId };
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(acc));
                onChange(acc);
                setOpen(false);
                setProjectId("");
              } catch (e) {
                setErr(e instanceof Error ? e.message : "绑定失败");
              } finally {
                setBusy(false);
              }
            }}
            variant="contained"
            disabled={busy}
          >
            {busy ? "绑定中…" : "绑定"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
