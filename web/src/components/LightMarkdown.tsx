import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

/**
 * 轻量 Markdown 渲染（零依赖）：
 * 覆盖远端应答中最常见的语法 —— 代码块 / 行内代码 / 加粗 / 标题 / 列表 / 表格 / 链接。
 * 超出范围的内容退化为纯文本，保证不丢信息。
 */
export default function LightMarkdown({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  return (
    <Box
      sx={{
        "& p": { my: 0.5, lineHeight: 1.7, fontSize: "0.95rem" },
        "& pre": {
          bgcolor: "#f5f5f5",
          borderRadius: 1,
          p: 1.5,
          overflowX: "auto",
          fontSize: "0.85rem",
          my: 1,
        },
        "& code": {
          fontFamily: "Consolas, Menlo, monospace",
          fontSize: "0.85em",
        },
        "& p code, & li code": {
          bgcolor: "#f5f5f5",
          px: 0.5,
          borderRadius: 0.5,
        },
        "& table": {
          borderCollapse: "collapse",
          my: 1,
          width: "max-content",
          maxWidth: "100%",
          "& th, & td": {
            border: "1px solid #ddd",
            px: 1,
            py: 0.5,
            fontSize: "0.88rem",
          },
          "& th": { bgcolor: "#fafafa", fontWeight: 600 },
        },
        "& .md-table-wrap": {
          overflowX: "auto",
          my: 1,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
        },
        "& a": { color: "primary.main", wordBreak: "break-word" },
        "& h1, & h2, & h3, & h4": { fontWeight: 700, mt: 1.5, mb: 0.5 },
        "& h1": { fontSize: "1.2rem" },
        "& h2": { fontSize: "1.1rem" },
        "& h3": { fontSize: "1.02rem" },
        "& h4": { fontSize: "0.98rem" },
        "& ul, & ol": { pl: 3, my: 0.5 },
        "& li": { lineHeight: 1.7 },
        "& hr": { border: "none", borderTop: "1px solid #eee", my: 1.5 },
        wordBreak: "break-word",
      }}
    >
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </Box>
  );
}

// ==================== 块级解析 ====================

type Block =
  | { type: "code"; lang: string; code: string }
  | { type: "table"; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

function splitBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i];

    // 代码块 ```lang ... ```
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```\s*/, "").trim();
      const buf: string[] = [];
      i++;
      while (i < n && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过闭合 ```
      blocks.push({ type: "code", lang, code: buf.join("\n") });
      continue;
    }

    // 表格：表头行含 | + 下一行是分隔行。
    // 分隔行格式不固定：远端可能生成 "| --- | --- |"（以 | 起头）或
    // "--- | --- | ---"（以 - 起头）。统一判据：含 |、含 -、且整体只由 | : - = 空格组成。
    const isTableSep = (s: string) => {
      const t = s.trim();
      return t.includes("|") && /-/.test(t) && /^[\s|:\-=]+$/.test(t);
    };
    if (line.trim().includes("|") && i + 1 < n && isTableSep(lines[i + 1])) {
      const rows: string[][] = [];
      rows.push(splitTableRow(line));
      i += 2; // 跳过表头和分隔行
      while (i < n && lines[i].trim().includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", rows });
      continue;
    }

    // 标题
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }

    // 分隔线
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 引用
    if (line.trim().startsWith(">")) {
      blocks.push({ type: "quote", text: line.trim().replace(/^>\s?/, "") });
      i++;
      continue;
    }

    // 列表（有序/无序），聚合连续项
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < n) {
        const t = lines[i].trim();
        if (ordered ? /^\d+[.)]\s+/.test(t) : /^[-*+]\s+/.test(t)) {
          items.push(t.replace(ordered ? /^\d+[.)]\s+/ : /^[-*+]\s+/, ""));
          i++;
        } else if (/^\s+\S/.test(lines[i]) && items.length > 0) {
          // 续行
          items[items.length - 1] += " " + lines[i].trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // 空行跳过
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 普通段落（聚合到下一个空行/块级语法）
    const buf: string[] = [line];
    i++;
    while (
      i < n &&
      lines[i].trim() !== "" &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*\|/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: buf.join("\n") });
  }
  return blocks;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

// ==================== 行内解析 ====================

function Inline({ text }: { text: string }) {
  const parts = parseInline(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "code")
          return <code key={i}>{p.text}</code>;
        if (p.type === "bold")
          return <strong key={i}>{p.text}</strong>;
        if (p.type === "italic")
          return <em key={i}>{p.text}</em>;
        if (p.type === "link")
          return (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
              {p.text}
            </a>
          );
        return <React.Fragment key={i}>{p.text}</React.Fragment>;
      })}
    </>
  );
}

type InlinePart =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "link"; text: string; url: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const regex =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))|(__[^_]+__)|(_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1]) parts.push({ type: "code", text: m[1].slice(1, -1) });
    else if (m[2]) parts.push({ type: "bold", text: m[2].slice(2, -2) });
    else if (m[3]) parts.push({ type: "italic", text: m[3].slice(1, -1) });
    else if (m[4]) {
      const inner = m[4];
      const url = /\]\(([^)]+)\)$/.exec(inner)!;
      parts.push({ type: "link", text: inner.slice(1, inner.indexOf("]")), url: url[1] });
    } else if (m[5]) parts.push({ type: "bold", text: m[5].slice(2, -2) });
    else if (m[6]) parts.push({ type: "italic", text: m[6].slice(1, -1) });
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

// ==================== 块渲染 ====================

function Block({ block }: { block: Block }) {
  switch (block.type) {
    case "code":
      return <CodeBlock code={block.code || " "} />;
    case "table":
      return (
        <div className="md-table-wrap">
          <table>
            <thead>
              <tr>
                {block.rows[0].map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.slice(1).map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci}>
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return block.ordered ? (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <Box sx={{ borderLeft: "3px solid #ddd", pl: 1.5, my: 0.5, color: "text.secondary" }}>
          <Inline text={block.text} />
        </Box>
      );
    case "heading": {
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag>
          <Inline text={block.text} />
        </Tag>
      );
    }
    case "hr":
      return <hr />;
    default:
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
  }
}

// 代码块：右上角复制按钮（贴近原生体验）
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };
  return (
    <Box sx={{ position: "relative", my: 1 }}>
      <Tooltip title={copied ? "已复制" : "复制"}>
        <IconButton
          size="small"
          onClick={copy}
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            bgcolor: "rgba(255,255,255,0.8)",
            "&:hover": { bgcolor: "rgba(255,255,255,1)" },
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <pre>{code}</pre>
    </Box>
  );
}
