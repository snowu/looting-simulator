"""
Pixel painter for the game's character-grid art (see docs/ART.md).

Draw with shapes, get back rows of palette characters to paste into
src/art/*.ts, and preview them as a PNG without touching the game:

    import sys; sys.path.insert(0, 'scripts')
    from pixel_painter import G, preview, vnoise

    g = G(32, 32)                                  # '.' = transparent
    g.ellipse(16, 20, 10, 8, 'b', lambda dx, dy: 'c' if dy < -0.4 else 'b')
    g.line(4, 28, 12, 20, 'w')
    g.outline()                                    # 'k' ring round everything
    print(g.dump())                                # rows for the .ts file
    preview('/tmp/x.png', [(g.rows(), {'b': '#5e4a3c', 'c': '#7e6654',
                                       'w': '#f0e8d8', 'k': '#140e0c'})])

Pure Python, no dependencies. A painted grid is a starting point: every
sprite in the repo was hand-tuned after painting.
"""


class G:
    def __init__(self, w, h, rows=None):
        self.w, self.h = w, h
        self.p = [list(r) for r in rows] if rows else [['.'] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = c

    def get(self, x, y):
        return self.p[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def line(self, x0, y0, x1, y1, c, t=1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            for ox in range(t):
                for oy in range(t):
                    self.set(x0 + ox, y0 + oy, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def poly(self, pts, c, t=1):
        for a, b in zip(pts, pts[1:]):
            self.line(*a, *b, c, t)

    def ellipse(self, cx, cy, rx, ry, c, shade=None):
        """Filled ellipse; shade(dx, dy) -> char overrides c per pixel (dx, dy normalised)."""
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    self.set(x, y, shade(dx, dy) if shade else c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def outline(self, k='k', diag=False):
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.p[y][x] != '.':
                    continue
                nb = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (-1, 1), (1, -1), (-1, -1)] if diag else [])
                if any(self.get(x + a, y + b) not in '.' + k for a, b in nb):
                    add.append((x, y))
        for x, y in add:
            self.p[y][x] = k

    def mirror_left(self):
        """Copy the left half onto the right half, mirrored."""
        for y in range(self.h):
            for x in range(self.w // 2):
                self.p[y][self.w - 1 - x] = self.p[y][x]

    def rows(self):
        return [''.join(r) for r in self.p]

    def dump(self, indent='  '):
        return '\n'.join(indent + r for r in self.rows())


def _hex(c):
    c = c.lstrip('#')
    if len(c) in (3, 4):
        c = ''.join(ch * 2 for ch in c)
    r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    a = int(c[6:8], 16) if len(c) == 8 else 255
    return r, g, b, a


def preview(path, frames, zoom=8, bg=(17, 15, 21), gap=4):
    """frames: list of (rows, palette). Writes one PNG with the frames side by side."""
    import struct, zlib
    hs = max(len(r) for r, _ in frames)
    W = sum(len(r[0]) for r, _ in frames) * zoom + gap * zoom * (len(frames) + 1)
    H = hs * zoom + 2 * gap * zoom
    img = [[bg for _ in range(W)] for _ in range(H)]
    ox = gap * zoom
    for rws, pal in frames:
        for y, row in enumerate(rws):
            for x, ch in enumerate(row):
                if ch == '.':
                    continue
                r, g, b, a = _hex(pal[ch])
                col = tuple(int(c * a / 255 + bgc * (1 - a / 255)) for c, bgc in zip((r, g, b), bg)) if a < 250 else (r, g, b)
                for yy in range(zoom):
                    for xx in range(zoom):
                        img[gap * zoom + y * zoom + yy][ox + x * zoom + xx] = col
        ox += len(rws[0]) * zoom + gap * zoom
    raw = b''.join(b'\x00' + bytes(v for px in row for v in px) for row in img)
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def vnoise(seed, w, h, cell):
    """Smooth value noise that tiles over a w×h texture (cell must divide w and h)."""
    import random
    rnd = random.Random(seed)
    gw, gh = w // cell + 1, h // cell + 1
    grid = [[rnd.random() for _ in range(gw)] for _ in range(gh)]
    def at(x, y):
        gx, gy = x / cell, y / cell
        x0, y0 = int(gx) % (gw - 1), int(gy) % (gh - 1)
        x1, y1 = (x0 + 1) % (gw - 1), (y0 + 1) % (gh - 1)
        fx, fy = gx - int(gx), gy - int(gy)
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        top = grid[y0][x0] * (1 - fx) + grid[y0][x1] * fx
        bot = grid[y1][x0] * (1 - fx) + grid[y1][x1] * fx
        return top * (1 - fy) + bot * fy
    return at
