import { Box } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import LightMarkdown from "./LightMarkdown";
import type { Part } from "../types";
import { imageUrl } from "../api";

interface Props {
  parts: Part[];
  onImageClick: (src: string) => void;
}

/**
 * 按 parts 原序渲染助手应答：文本块用 LightMarkdown（表格/链接/代码），
 * 图片块在文字流中出现的位置就地内联，文件块渲染为下载卡片。
 * 这样还原原网页「文字穿插图片」的排版。
 */
export default function PartsRenderer({ parts, onImageClick }: Props) {
  return (
    <Box>
      {parts.map((p, i) => {
        if (p.type === "text") {
          return (
            <Box key={i} className="markdown-body" sx={{ mb: 0.5 }}>
              <LightMarkdown text={p.text || ""} />
            </Box>
          );
        }
        if (p.type === "image" && p.src) {
          const full = imageUrl(p.src);
          return (
            <Box
              key={i}
              component="img"
              src={full}
              alt={p.name || "图片"}
              onClick={() => onImageClick(full)}
              sx={{
                display: "block",
                maxWidth: "100%",
                maxHeight: 360,
                borderRadius: 1.5,
                cursor: "pointer",
                my: 1,
                border: "1px solid",
                borderColor: "divider",
                transition: "transform 0.15s",
                "&:hover": { transform: "scale(1.01)" },
              }}
            />
          );
        }
        if (p.type === "file" && p.src) {
          return (
            <Box
              key={i}
              component="a"
              href={imageUrl(p.src)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                my: 0.5,
                p: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                textDecoration: "none",
                color: "primary.main",
                fontSize: "0.85rem",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <InsertDriveFileIcon fontSize="small" />
              <span>{p.name || "下载文件"}</span>
            </Box>
          );
        }
        return null;
      })}
    </Box>
  );
}
