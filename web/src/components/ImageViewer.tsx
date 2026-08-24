import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Link,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";

interface Props {
  src: string | null;
  onClose: () => void;
}

export default function ImageViewer({ src, onClose }: Props) {
  // 从 URL 提取文件名
  const fileName = src ? src.split("/").pop() || "image" : "";

  return (
    <Dialog
      open={!!src}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        "& .MuiDialog-paper": {
          bgcolor: "rgba(0,0,0,0.05)",
          boxShadow: "none",
          overflow: "hidden",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 2,
          py: 1,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {fileName}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {src && (
            <IconButton
              component={Link}
              href={src}
              download={fileName}
              size="small"
              sx={{ color: "text.secondary" }}
            >
              <DownloadIcon />
            </IconButton>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      <DialogContent
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 0,
          overflow: "auto",
        }}
      >
        {src && (
          <Box
            component="img"
            src={src}
            alt={fileName}
            sx={{
              maxWidth: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
