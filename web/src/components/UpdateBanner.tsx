import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { fetchVersion, triggerUpdate } from "../api";

/**
 * 桌面端更新提示横幅：
 * - 挂载时向网关 /api/version 询问版本；
 * - 若 updateAvailable，顶部显示「发现新版本 vX（当前 vY），是否更新？」+ 立即更新/稍后；
 * - 点「立即更新」调用 /api/update/do 触发 exe 自替换重启（开发环境无该端点，静默忽略）。
 */
export default function UpdateBanner() {
  const [info, setInfo] = useState<{ latest: string; current: string; releaseUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVersion()
      .then((v) => {
        if (v.updateAvailable) {
          setInfo({ latest: v.latest, current: v.current, releaseUrl: v.releaseUrl });
        }
      })
      .catch(() => {
        /* 开发环境（vite proxy 指向 :8080 后端，无此端点）静默忽略 */
      });
  }, []);

  if (!info || dismissed) return null;

  const handleUpdate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await triggerUpdate();
      if (!res.ok) {
        // 自动替换失败：引导用户去发布页手动下载
        if (info.releaseUrl) window.open(info.releaseUrl, "_blank");
        setError(res.error || "自动更新失败，请手动下载");
        setBusy(false);
      }
      // 成功则进程重启，请求不返回，保持 loading 态即可
    } catch {
      setError("更新请求失败，请稍后重试");
      setBusy(false);
    }
  };

  return (
    <Alert
      severity="info"
      variant="filled"
      sx={{ borderRadius: 0 }}
      action={
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {busy ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <>
              <Button color="inherit" size="small" variant="outlined" onClick={handleUpdate}>
                立即更新
              </Button>
              <Button color="inherit" size="small" onClick={() => setDismissed(true)}>
                稍后
              </Button>
            </>
          )}
        </Box>
      }
    >
      {error
        ? error
        : busy
          ? `正在更新到 ${info.latest}，应用即将重启…`
          : `发现新版本 ${info.latest}（当前 ${info.current}），是否更新？`}
    </Alert>
  );
}
