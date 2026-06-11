#!/usr/bin/env python3
"""
extract-jar.py — Unpack a J2ME JAR into a web-playable game scaffold.

Usage:
    python3 tools/extract-jar.py path/to/game.jar [output_dir]

What it does:
    1. Unzips the JAR
    2. Copies spritesheets / icons to assets/
    3. Decodes level files (if present) into JS data
    4. Generates a minimal game skeleton
"""

import os, sys, json, struct, shutil, tempfile
from pathlib import Path

def parse_levels(levels_dir):
    levels = {}
    if not os.path.isdir(levels_dir):
        return levels
    for fname in sorted(os.listdir(levels_dir)):
        fpath = os.path.join(levels_dir, fname)
        try:
            with open(fpath, 'rb') as f:
                data = f.read()
            if len(data) < 8:
                continue
            sx, sy, grav, W, V, ao, cols, rows = data[:8]
            map_size = rows * cols
            tilemap = list(data[8:8 + map_size])
            B = data[8 + map_size] if len(data) > 8 + map_size else 0
            offset = 8 + map_size + 1
            segments = []
            for i in range(B):
                if offset + 8 <= len(data):
                    segments.append(list(data[offset:offset + 8]))
                    offset += 8
            key = fname.split('.')[-1].lstrip('0') or '0'
            levels[key] = {"sx":sx,"sy":sy,"g":grav,"W":W,"V":V,
                          "ao":ao,"c":cols,"r":rows,"t":tilemap,"seg":segments}
        except Exception as e:
            print(f"  [warn] {fname}: {e}")
    return levels

def find_sprites(extract_dir):
    icons = os.path.join(extract_dir, 'icons')
    if not os.path.isdir(icons):
        return None
    best, best_size = None, 0
    for f in os.listdir(icons):
        if f.endswith('.png'):
            path = os.path.join(icons, f)
            size = os.path.getsize(path)
            if 500 < size < 10000 and size > best_size:
                with open(path, 'rb') as fh:
                    fh.seek(16)
                    w = struct.unpack('>I', fh.read(4))[0]
                    h = struct.unpack('>I', fh.read(4))[0]
                if w <= 128 and h <= 128 and w % 12 == 0:
                    best, best_size = path, size
    return best

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    jar_path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(os.path.basename(jar_path))[0]
    if not os.path.exists(jar_path):
        print(f"Error: {jar_path} not found")
        sys.exit(1)
    print(f"Extracting {jar_path} -> {out_dir}/")
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        shutil.unpack_archive(jar_path, tmp, 'zip')
        sprites = find_sprites(tmp)
        if sprites:
            assets = os.path.join(out_dir, 'assets')
            os.makedirs(assets, exist_ok=True)
            shutil.copy(sprites, os.path.join(assets, 'sprites.png'))
            print("  -> assets/sprites.png")
        splash = os.path.join(tmp, 'icons', 'bouncesplash.png')
        if os.path.exists(splash):
            os.makedirs(os.path.join(out_dir, 'assets'), exist_ok=True)
            shutil.copy(splash, os.path.join(out_dir, 'assets', 'splash.png'))
            print("  -> assets/splash.png")
        levels_dir = os.path.join(tmp, 'levels')
        levels = parse_levels(levels_dir)
        if levels:
            lj = json.dumps(levels, separators=(',', ':'))
            js = ("/** Auto-generated level data */\n"
                  "var Bounce = window.Bounce || {};\n"
                  f"Bounce.LEVEL_DATA = {lj};\n")
            os.makedirs(os.path.join(out_dir, 'js'), exist_ok=True)
            with open(os.path.join(out_dir, 'js', 'leveldata.js'), 'w') as f:
                f.write(js)
            print(f"  -> js/leveldata.js ({len(levels)} levels)")
        sounds = os.path.join(tmp, 'sounds')
        if os.path.isdir(sounds):
            assets = os.path.join(out_dir, 'assets')
            os.makedirs(assets, exist_ok=True)
            for sf in os.listdir(sounds):
                shutil.copy(os.path.join(sounds, sf), os.path.join(assets, sf))
            print("  -> assets/*.ott (sounds)")
    print(f"\nDone! Scaffold at {out_dir}/")

if __name__ == '__main__':
    main()
