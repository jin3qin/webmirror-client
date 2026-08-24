"""根据项目根目录的 logo.png 生成 desktop/icon.ico（纯标准库实现，零依赖）。

WebMirror 桌面图标生成器。多分辨率 BMP ICO，用于：
- 系统托盘图标（systray.SetIcon）
- exe 文件图标（经 rsrc 嵌入 rsrc.syso）

为什么不用 Pillow：本机/目标机器未必装了 Pillow，装包又慢又容易失败。
这里用标准库 zlib + struct 解码 PNG（支持 RGB / RGBA / 灰度 / 灰度+alpha），
再做区域均值下采样，最后手工拼 BMP ICO（32-bit BGRA DIB + AND 掩码），
对 Windows 系统托盘（NotifyIcon）兼容性最好、必显。

用法：
    python desktop/gen_icon.py

或直接运行 build.bat，脚本会自动调用本程序从 logo.png 重新生成 icon.ico。
"""
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "logo.png")
OUT = os.path.join(HERE, "icon.ico")


def load_png(path):
    """纯标准库解码 PNG，返回 (width, height, grid)，grid[y][x]=(r,g,b,a)。"""
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("不是合法的 PNG 文件：%s" % path)

    pos = 8
    width = height = bitdepth = colortype = None
    idat = bytearray()
    palette = None   # PLTE: list of (r,g,b)
    trns = None      # tRNS: list of alpha per palette index
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctype == b"IHDR":
            width, height, bitdepth, colortype = struct.unpack(">IIBB", chunk[:10])
        elif ctype == b"PLTE":
            palette = [(chunk[i], chunk[i + 1], chunk[i + 2])
                       for i in range(0, len(chunk) - (len(chunk) % 3), 3)]
        elif ctype == b"tRNS":
            trns = list(chunk)
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
        pos += 12 + length

    if bitdepth != 8:
        raise ValueError("仅支持 8-bit 通道深度的 PNG（当前 %s-bit）" % bitdepth)

    if colortype == 6:
        bpp = 4
    elif colortype == 2:
        bpp = 3
    elif colortype == 4:
        bpp = 2
    elif colortype == 3:
        bpp = 1  # 索引调色板
    elif colortype == 0:
        bpp = 1
    else:
        raise ValueError("不支持的 PNG 色彩类型 %s" % colortype)

    raw = zlib.decompress(bytes(idat))
    stride = width * bpp
    out = bytearray()
    prev = bytearray(stride)
    p = 0
    for _ in range(height):
        ftype = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if ftype == 1:  # Sub
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                line[i] = (line[i] + ((a + b) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                if pa <= pb and pa <= pc:
                    pred = a
                elif pb <= pc:
                    pred = b
                else:
                    pred = c
                line[i] = (line[i] + pred) & 0xFF
        out += line
        prev = line

    if colortype == 6:
        flat = [(out[i], out[i + 1], out[i + 2], out[i + 3])
                for i in range(0, len(out), 4)]
    elif colortype == 2:
        flat = [(out[i], out[i + 1], out[i + 2], 255)
                for i in range(0, len(out), 3)]
    elif colortype == 4:
        flat = [(out[i], out[i], out[i], out[i + 1])
                for i in range(0, len(out), 2)]
    elif colortype == 3:  # 调色板索引
        if palette is None:
            raise ValueError("调色板 PNG 缺少 PLTE 数据")
        trns_alpha = trns or []
        flat = []
        for idx in out:
            r, g, b = palette[idx]
            a = trns_alpha[idx] if idx < len(trns_alpha) else 255
            flat.append((r, g, b, a))
    else:  # grayscale
        flat = [(v, v, v, 255) for v in out]

    grid = [flat[y * width:(y + 1) * width] for y in range(height)]
    return width, height, grid


def crop_center_square(grid, w, h):
    """若非正方形，按短边居中裁剪为正方形。"""
    if w == h:
        return grid, w
    side = min(w, h)
    x0 = (w - side) // 2
    y0 = (h - side) // 2
    sq = [row[x0:x0 + side] for row in grid[y0:y0 + side]]
    return sq, side


def downscale(grid, side, s):
    """区域均值下采样 side×side → s×s（含 alpha）。"""
    out = []
    scale = side / s
    for dy in range(s):
        row = []
        for dx in range(s):
            x0, x1 = int(dx * scale), int((dx + 1) * scale)
            y0, y1 = int(dy * scale), int((dy + 1) * scale)
            if x1 == x0:
                x1 = x0 + 1
            if y1 == y0:
                y1 = y0 + 1
            r = g = b = a = 0
            n = 0
            for yy in range(y0, min(y1, side)):
                srcrow = grid[yy]
                for xx in range(x0, min(x1, side)):
                    R, G, B, A = srcrow[xx]
                    r += R; g += G; b += B; a += A
                    n += 1
            row.append((r // n, g // n, b // n, a // n))
        out.append(row)
    return out


def bmp_icon(s, px):
    """构造一张传统 BMP 图标（BITMAPINFOHEADER + XOR BGRA + AND 掩码）。"""
    bih = struct.pack(
        "<IiiHHIIiiII",
        40,    # biSize
        s,     # biWidth
        s * 2,  # biHeight（含 XOR + AND 掩码，故翻倍）
        1,     # biPlanes
        32,    # biBitCount
        0,     # biCompression = BI_RGB
        0,     # biSizeImage
        0, 0, 0, 0,  # x/y ppm, clr used, clr important
    )
    xor = bytearray()
    for y in range(s - 1, -1, -1):       # bottom-up
        for x in range(s):
            r, g, b, a = px[y][x]
            xor += bytes((b, g, r, a))    # BGRA
    row_bytes = ((s + 31) // 32) * 4
    and_mask = b"\x00" * (row_bytes * s)  # 全 0：透明由 alpha 通道决定
    return bih + xor + and_mask


def build_ico(sizes, px_maps):
    images = [bmp_icon(s, px) for s, px in zip(sizes, px_maps)]
    icondir = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = b""
    data = b""
    for s, img in zip(sizes, images):
        entries += struct.pack(
            "<BBBBHHII",
            s % 256, s % 256, 0, 0, 1, 32,
            len(img), offset,
        )
        data += img
        offset += len(img)
    return icondir + entries + data


def main():
    if not os.path.exists(SRC):
        raise SystemExit("[ERROR] 未找到 %s，请把 logo.png 放在项目根目录。" % SRC)

    w, h, grid = load_png(SRC)
    grid, side = crop_center_square(grid, w, h)

    # 先下采样到 256，再逐级下采样小尺寸（更快且平滑）
    base = downscale(grid, side, 256)
    sizes = [16, 24, 32, 48, 64, 128, 256]
    px_maps = {}
    cache = {256: base}
    for s in sizes:
        if s in cache:
            px_maps[s] = cache[s]
            continue
        src_s = max(k for k in cache if k > s)
        px_maps[s] = downscale(cache[src_s], src_s, s)
        cache[s] = px_maps[s]
    px_maps = [px_maps[s] for s in sizes]

    ico = build_ico(sizes, px_maps)
    with open(OUT, "wb") as f:
        f.write(ico)

    total = len(ico)
    print("wrote", OUT, total, "bytes; sizes", sizes, "(no external deps)")


if __name__ == "__main__":
    main()
