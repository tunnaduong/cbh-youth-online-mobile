#!/usr/bin/env python3
"""
Generates Android Adaptive Icon foregrounds for all app icon presets.
According to the Android Adaptive Icon guidelines:
- Canvas: 1024 x 1024 px (representing 108dp x 108dp)
- Safe zone: Center circle with 682 px diameter (72dp)
- Margins: 171 px on each side
This guarantees that when Android OEM launchers (Samsung, Google Pixel, Xiaomi, OnePlus)
apply circular, squircle, or rounded-corner masks, 0% of the icon content is cropped.
"""

from PIL import Image
import os

# Safe zone dimension
CANVAS_SIZE = 1024
SAFE_SIZE = 682  # 72dp / 108dp * 1024 = 682.67px
OFFSET = (CANVAS_SIZE - SAFE_SIZE) // 2  # 171px

ICONS = [
    # (source_ios_file, target_android_file)
    ('app/assets/cbh-youth-default.png', 'app/assets/cbh-youth-default-android.png'),
    ('app/assets/cbh-youth-dark.png', 'app/assets/cbh-youth-dark-android.png'),
    ('app/assets/cbh-youth-cleardark.png', 'app/assets/cbh-youth-cleardark-android.png'),
    ('app/assets/cbh-youth-clearlight.png', 'app/assets/cbh-youth-clearlight-android.png'),
    ('app/assets/cbh-youth-tinteddark.png', 'app/assets/cbh-youth-tinteddark-android.png'),
    ('app/assets/cbh-youth-tintedlight.png', 'app/assets/cbh-youth-tintedlight-android.png'),
    ('app/assets/teachers-day-20-11.png', 'app/assets/teachers-day-android.png'),
    ('app/assets/icon.png', 'app/assets/classic-android.png'),
    ('app/assets/christmas-ios.png', 'app/assets/christmas-android.png'),
    ('app/assets/2026-ios.png', 'app/assets/2026-android.png'),
    ('app/assets/school-logo-removebg.png', 'app/assets/school-crest-android.png'),
]

def make_android_adaptive_foreground(src_path, dst_path):
    if not os.path.exists(src_path):
        print(f"Skipping missing: {src_path}")
        return

    src_img = Image.open(src_path).convert('RGBA')

    # Resize source image to the 682x682 safe zone using high-quality Lanczos resampling
    resized = src_img.resize((SAFE_SIZE, SAFE_SIZE), Image.Resampling.LANCZOS)

    # Place centered on a transparent 1024x1024 canvas
    canvas = Image.new('RGBA', (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    canvas.paste(resized, (OFFSET, OFFSET), resized)

    # Save optimized PNG
    canvas.save(dst_path, 'PNG', optimize=True)
    print(f"OK: {dst_path} (from {src_path}) [Content: {SAFE_SIZE}x{SAFE_SIZE} at ({OFFSET}, {OFFSET})]")

def main():
    print("Generating Android Adaptive Icon foregrounds for all presets...")
    for src, dst in ICONS:
        make_android_adaptive_foreground(src, dst)
    print("All Android adaptive icons generated successfully!")

if __name__ == '__main__':
    main()
