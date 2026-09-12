#!/usr/bin/env python3
"""Generate clay-toned launcher icons (pure PNG writer, no dependencies).

Run from repo root:  python3 mobile_app/tool/generate_icons.py
Writes mipmap-*/ic_launcher.png at all Android densities.
"""
from __future__ import annotations

import os
import struct
import zlib


def png_bytes(width: int, height: int, rows: list) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw = b"".join(b"\x00" + bytes(row) for row in rows)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def make_icon(size: int, base=(121, 85, 72), radius_frac: float = 0.22) -> bytes:
    inner = tuple(min(255, int(c * 1.18)) for c in base)
    r = int(size * radius_frac)
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            inside = True
            if dx < r and dy < r:
                ddx = r - dx - 1
                ddy = r - dy - 1
                inside = (ddx * ddx + ddy * ddy) <= r * r
            if not inside:
                row.extend((0, 0, 0, 0))
            else:
                m = int(size * 0.26)
                big = size - m
                if m <= x < big and m <= y < big:
                    row.extend((*inner, 255))
                else:
                    row.extend((*base, 255))
        rows.append(row)
    return png_bytes(size, size, rows)


def main() -> None:
    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    root = os.path.join(os.path.dirname(__file__), "..", "android", "app", "src", "main", "res")
    for name, s in sizes.items():
        d = os.path.normpath(os.path.join(root, f"mipmap-{name}"))
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "ic_launcher.png"), "wb") as f:
            f.write(make_icon(s))
        print(f"{d}/ic_launcher.png ({s}px) written")


if __name__ == "__main__":
    main()
