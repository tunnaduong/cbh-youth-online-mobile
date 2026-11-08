#!/usr/bin/env python3
"""
Generates the official 20/11 Vietnamese Teachers' Day icon for CBH Youth Online.
Uses the authentic CYO branding base from cbh-youth-default.png,
adding modern human-designed books and a 20/11 badge.
"""

import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

def create_gradient_linear(size, p1, p2, color1, color2):
    """Creates a 2D linear gradient RGBA image."""
    w, h = size
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1
    dist_sq = dx * dx + dy * dy
    if dist_sq == 0:
        dist_sq = 1

    r1, g1, b1, a1 = color1
    r2, g2, b2, a2 = color2

    # Vectorized gradient calculation
    y_coords, x_coords = np.mgrid[0:h, 0:w]
    proj = ((x_coords - x1) * dx + (y_coords - y1) * dy) / dist_sq
    t = np.clip(proj, 0.0, 1.0)

    arr = np.empty((h, w, 4), dtype=np.uint8)
    arr[:, :, 0] = np.uint8(r1 + t * (r2 - r1))
    arr[:, :, 1] = np.uint8(g1 + t * (g1 - g1) if g1 == g2 else g1 + t * (g2 - g1))
    arr[:, :, 2] = np.uint8(b1 + t * (b2 - b1))
    arr[:, :, 3] = np.uint8(a1 + t * (a2 - a1))

    return Image.fromarray(arr)

def draw_modern_book(draw, cx, cy, w, h, scale=2):
    """
    Draws a sleek, modern open book with golden-trimmed pages and bookmark ribbon.
    All coordinates in 2x scaled space.
    """
    # Book spine center
    spine_x = cx
    spine_y = cy
    book_w = w
    book_h = h

    # 1. Shadow underneath the book
    shadow_layer = Image.new('RGBA', (1024 * scale, 1024 * scale), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    sdraw.ellipse(
        [spine_x - book_w * 0.52, spine_y + book_h * 0.35, spine_x + book_w * 0.52, spine_y + book_h * 0.70],
        fill=(15, 35, 25, 60)
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(16 * scale))

    # 2. Hardcover Base (under the pages)
    cover_color = (24, 75, 48, 255) # Deep forest emerald
    cover_pts_left = [
        (spine_x - 10 * scale, spine_y + book_h * 0.42),
        (spine_x - book_w * 0.48, spine_y + book_h * 0.32),
        (spine_x - book_w * 0.47, spine_y - book_h * 0.28),
        (spine_x - 10 * scale, spine_y - book_h * 0.18),
    ]
    cover_pts_right = [
        (spine_x + 10 * scale, spine_y + book_h * 0.42),
        (spine_x + book_w * 0.48, spine_y + book_h * 0.32),
        (spine_x + book_w * 0.47, spine_y - book_h * 0.28),
        (spine_x + 10 * scale, spine_y - book_h * 0.18),
    ]

    # Gold edge rim on cover
    gold_edge = (212, 175, 55, 255)

    return shadow_layer

def generate_icons():
    SCALE = 3 # 3x supersampling for razor sharp vectors & fonts
    CANVAS_W = 1024 * SCALE
    CANVAS_H = 1024 * SCALE

    # Load base image
    base_img = Image.open('app/assets/cbh-youth-default.png').convert('RGBA')
    # Scale base up to CANVAS_W x CANVAS_H with high quality Lanczos
    base_scaled = base_img.resize((CANVAS_W, CANVAS_H), Image.Resampling.LANCZOS)

    # Separate overlay layer for new human-designed decorations
    overlay = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # ----------------------------------------------------
    # 1. MODERN OPEN BOOK AT THE BOTTOM (Supporting the mascot)
    # ----------------------------------------------------
    book_cx = int(512 * SCALE)
    book_cy = int(875 * SCALE)
    book_half_w = int(320 * SCALE)
    book_half_h = int(75 * SCALE)

    # Book shadow
    shadow_img = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_img)
    sdraw.ellipse(
        [book_cx - int(340 * SCALE), book_cy + int(20 * SCALE),
         book_cx + int(340 * SCALE), book_cy + int(85 * SCALE)],
        fill=(10, 30, 20, 75)
    )
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(18 * SCALE))
    overlay = Image.alpha_composite(overlay, shadow_img)
    draw = ImageDraw.Draw(overlay)

    # Hardcover base (deep emerald with gold outline)
    cover_left = [
        (book_cx - int(8 * SCALE), book_cy + int(45 * SCALE)),
        (book_cx - book_half_w - int(12 * SCALE), book_cy + int(28 * SCALE)),
        (book_cx - book_half_w - int(8 * SCALE), book_cy - book_half_h + int(10 * SCALE)),
        (book_cx - int(8 * SCALE), book_cy - int(30 * SCALE)),
    ]
    cover_right = [
        (book_cx + int(8 * SCALE), book_cy + int(45 * SCALE)),
        (book_cx + book_half_w + int(12 * SCALE), book_cy + int(28 * SCALE)),
        (book_cx + book_half_w + int(8 * SCALE), book_cy - book_half_h + int(10 * SCALE)),
        (book_cx + int(8 * SCALE), book_cy - int(30 * SCALE)),
    ]

    # Draw covers
    draw.polygon(cover_left, fill=(22, 65, 42, 255), outline=(218, 165, 32, 230), width=int(3 * SCALE))
    draw.polygon(cover_right, fill=(22, 65, 42, 255), outline=(218, 165, 32, 230), width=int(3 * SCALE))

    # Pages block (left page stack)
    page_pts_l = [
        (book_cx - int(4 * SCALE), book_cy + int(32 * SCALE)),
        (book_cx - book_half_w, book_cy + int(18 * SCALE)),
        (book_cx - book_half_w + int(2 * SCALE), book_cy - book_half_h + int(16 * SCALE)),
        (book_cx - int(4 * SCALE), book_cy - int(24 * SCALE)),
    ]
    # Pages block (right page stack)
    page_pts_r = [
        (book_cx + int(4 * SCALE), book_cy + int(32 * SCALE)),
        (book_cx + book_half_w, book_cy + int(18 * SCALE)),
        (book_cx + book_half_w - int(2 * SCALE), book_cy - book_half_h + int(16 * SCALE)),
        (book_cx + int(4 * SCALE), book_cy - int(24 * SCALE)),
    ]

    # Draw crisp ivory white pages with subtle gold gilded top edge
    draw.polygon(page_pts_l, fill=(255, 253, 248, 255), outline=(230, 210, 150, 200), width=int(2 * SCALE))
    draw.polygon(page_pts_r, fill=(255, 253, 248, 255), outline=(230, 210, 150, 200), width=int(2 * SCALE))

    # Gentle curved top page highlights
    draw.line([
        (book_cx - int(4 * SCALE), book_cy - int(24 * SCALE)),
        (book_cx - int(160 * SCALE), book_cy - int(38 * SCALE)),
        (book_cx - book_half_w + int(2 * SCALE), book_cy - book_half_h + int(16 * SCALE))
    ], fill=(255, 255, 255, 255), width=int(3 * SCALE))

    draw.line([
        (book_cx + int(4 * SCALE), book_cy - int(24 * SCALE)),
        (book_cx + int(160 * SCALE), book_cy - int(38 * SCALE)),
        (book_cx + book_half_w - int(2 * SCALE), book_cy - book_half_h + int(16 * SCALE))
    ], fill=(255, 255, 255, 255), width=int(3 * SCALE))

    # Fine modern text lines on left page (representing knowledge / poems)
    for i in range(4):
        ly = book_cy - int((10 - i * 11) * SCALE)
        lx1 = book_cx - int(260 * SCALE)
        lx2 = book_cx - int(60 * SCALE)
        draw.rounded_rectangle([lx1, ly, lx2, ly + int(2.5 * SCALE)], radius=int(1.5 * SCALE), fill=(180, 195, 185, 160))

    # Fine modern text lines on right page
    for i in range(4):
        ly = book_cy - int((10 - i * 11) * SCALE)
        lx1 = book_cx + int(60 * SCALE)
        lx2 = book_cx + int(260 * SCALE)
        draw.rounded_rectangle([lx1, ly, lx2, ly + int(2.5 * SCALE)], radius=int(1.5 * SCALE), fill=(180, 195, 185, 160))

    # Silk Bookmark Ribbon draped in the center (Crimson red #E11D48)
    ribbon_pts = [
        (book_cx - int(10 * SCALE), book_cy - int(22 * SCALE)),
        (book_cx + int(10 * SCALE), book_cy - int(22 * SCALE)),
        (book_cx + int(14 * SCALE), book_cy + int(56 * SCALE)),
        (book_cx, book_cy + int(46 * SCALE)), # V-cut in ribbon
        (book_cx - int(14 * SCALE), book_cy + int(56 * SCALE)),
    ]
    draw.polygon(ribbon_pts, fill=(225, 29, 72, 255), outline=(190, 18, 60, 255), width=int(1.5 * SCALE))

    # ----------------------------------------------------
    # 2. MODERN GOLDEN FOUNTAIN PEN resting diagonally
    # ----------------------------------------------------
    pen_start_x = book_cx - int(180 * SCALE)
    pen_start_y = book_cy + int(25 * SCALE)
    pen_end_x = book_cx + int(220 * SCALE)
    pen_end_y = book_cy - int(55 * SCALE)

    # Pen shadow
    pen_shadow = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    ps_draw = ImageDraw.Draw(pen_shadow)
    ps_draw.line([
        (pen_start_x + int(4 * SCALE), pen_start_y + int(8 * SCALE)),
        (pen_end_x + int(4 * SCALE), pen_end_y + int(8 * SCALE))
    ], fill=(20, 40, 30, 90), width=int(14 * SCALE))
    pen_shadow = pen_shadow.filter(ImageFilter.GaussianBlur(6 * SCALE))
    overlay = Image.alpha_composite(overlay, pen_shadow)
    draw = ImageDraw.Draw(overlay)

    # Pen body (luxurious metallic gold with gloss highlight)
    draw.line([(pen_start_x, pen_start_y), (pen_end_x, pen_end_y)], fill=(202, 138, 4, 255), width=int(12 * SCALE))
    draw.line([(pen_start_x, pen_start_y), (pen_end_x, pen_end_y)], fill=(250, 204, 21, 255), width=int(7 * SCALE))
    draw.line([(pen_start_x, pen_start_y), (pen_end_x, pen_end_y)], fill=(254, 240, 138, 255), width=int(2 * SCALE))

    # Pen Nib (pointed nib at pen_end)
    nib_pts = [
        (pen_end_x - int(8 * SCALE), pen_end_y - int(4 * SCALE)),
        (pen_end_x + int(18 * SCALE), pen_end_y - int(8 * SCALE)),
        (pen_end_x - int(4 * SCALE), pen_end_y + int(8 * SCALE)),
    ]
    draw.polygon(nib_pts, fill=(245, 158, 11, 255), outline=(180, 83, 9, 255), width=int(1.5 * SCALE))

    # ----------------------------------------------------
    # 3. MODERN SLEEK '20/11' BADGE IN TOP RIGHT
    # ----------------------------------------------------
    badge_cx = int(775 * SCALE)
    badge_cy = int(195 * SCALE)
    badge_r = int(95 * SCALE)

    # Badge drop shadow
    b_shadow = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    bs_draw = ImageDraw.Draw(b_shadow)
    bs_draw.ellipse(
        [badge_cx - badge_r - int(4 * SCALE), badge_cy - badge_r + int(10 * SCALE),
         badge_cx + badge_r + int(4 * SCALE), badge_cy + badge_r + int(24 * SCALE)],
        fill=(10, 35, 20, 80)
    )
    b_shadow = b_shadow.filter(ImageFilter.GaussianBlur(16 * SCALE))
    overlay = Image.alpha_composite(overlay, b_shadow)
    draw = ImageDraw.Draw(overlay)

    # Two modern ribbon tails under the badge
    ribbon_l = [
        (badge_cx - int(35 * SCALE), badge_cy + int(70 * SCALE)),
        (badge_cx - int(55 * SCALE), badge_cy + int(140 * SCALE)),
        (badge_cx - int(25 * SCALE), badge_cy + int(122 * SCALE)),
        (badge_cx - int(5 * SCALE), badge_cy + int(136 * SCALE)),
        (badge_cx - int(10 * SCALE), badge_cy + int(75 * SCALE)),
    ]
    ribbon_r = [
        (badge_cx + int(10 * SCALE), badge_cy + int(75 * SCALE)),
        (badge_cx + int(5 * SCALE), badge_cy + int(136 * SCALE)),
        (badge_cx + int(25 * SCALE), badge_cy + int(122 * SCALE)),
        (badge_cx + int(55 * SCALE), badge_cy + int(140 * SCALE)),
        (badge_cx + int(35 * SCALE), badge_cy + int(70 * SCALE)),
    ]
    draw.polygon(ribbon_l, fill=(225, 29, 72, 255), outline=(180, 15, 50, 255), width=int(2 * SCALE))
    draw.polygon(ribbon_r, fill=(225, 29, 72, 255), outline=(180, 15, 50, 255), width=int(2 * SCALE))

    # Outer Gold Rim of the badge
    draw.ellipse(
        [badge_cx - badge_r, badge_cy - badge_r,
         badge_cx + badge_r, badge_cy + badge_r],
        fill=(245, 158, 11, 255), outline=(217, 119, 6, 255), width=int(3 * SCALE)
    )

    # Inner Gold Rim
    inner_gold_r = int(badge_r - 6 * SCALE)
    draw.ellipse(
        [badge_cx - inner_gold_r, badge_cy - inner_gold_r,
         badge_cx + inner_gold_r, badge_cy + inner_gold_r],
        fill=(251, 191, 36, 255)
    )

    # White enamel center disc
    disc_r = int(badge_r - 14 * SCALE)
    draw.ellipse(
        [badge_cx - disc_r, badge_cy - disc_r,
         badge_cx + disc_r, badge_cy + disc_r],
        fill=(255, 255, 255, 255), outline=(254, 240, 138, 255), width=int(2 * SCALE)
    )

    # Render "20/11" with Lexend_600SemiBold
    font_size = int(68 * SCALE)
    font = ImageFont.truetype('app/assets/fonts/name/Lexend_600SemiBold.ttf', font_size)
    text = "20/11"
    t_bbox = font.getbbox(text)
    tw = t_bbox[2] - t_bbox[0]
    th = t_bbox[3] - t_bbox[1]
    tx = badge_cx - tw // 2
    ty = badge_cy - th // 2 - int(4 * SCALE)

    # Crisp crimson-rose text
    draw.text((tx, ty), text, font=font, fill=(190, 18, 60, 255))

    # Subtle modern star at the bottom of badge
    star_y = badge_cy + int(46 * SCALE)
    star_size = int(10 * SCALE)
    draw.regular_polygon((badge_cx, star_y, star_size), 5, rotation=0, fill=(245, 158, 11, 255))

    # ----------------------------------------------------
    # COMPOSITE TOGETHER
    # ----------------------------------------------------
    final_ios = Image.alpha_composite(base_scaled, overlay)

    # Downscale smoothly to 1024x1024
    ios_1024 = final_ios.resize((1024, 1024), Image.Resampling.LANCZOS)

    # Apply squircle alpha mask from original cbh-youth-default.png
    orig_alpha = base_img.split()[3]
    ios_1024.putalpha(orig_alpha)

    # Save iOS Icon
    ios_1024.save('app/assets/teachers-day-20-11.png', 'PNG', optimize=True)
    print("SUCCESS: Generated app/assets/teachers-day-20-11.png")

    # ----------------------------------------------------
    # ANDROID ADAPTIVE VARIANT
    # ----------------------------------------------------
    and_mask = Image.open('app/assets/christmas-android.png').convert('RGBA').split()[3]

    # Create light background (#F4FBF7)
    and_bg = Image.new('RGBA', (1024, 1024), (244, 251, 247, 255))

    # Scale artwork to 92% to fit Android safe zone
    and_content = final_ios.resize((940, 940), Image.Resampling.LANCZOS)
    and_bg.paste(and_content, (42, 42), and_content)
    and_bg.putalpha(and_mask)

    # Save Android Icon
    and_bg.save('app/assets/teachers-day-android.png', 'PNG', optimize=True)
    print("SUCCESS: Generated app/assets/teachers-day-android.png")

if __name__ == "__main__":
    generate_icons()
