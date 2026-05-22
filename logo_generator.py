"""
Logo Generator Ultimate - 本地字体版
================================================================
"""

import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# ── 1. 环境与依赖准备 ────────────────────────────────────────────────────────
def _install(pkg):
    print(f"📦 正在安装依赖: {pkg}...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q", "--break-system-packages"])

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    _install("Pillow")
    from PIL import Image, ImageDraw, ImageFont

# ── 2. 核心配置与参数 ────────────────────────────────────────────────────────

OUTPUT_DIR = "logo_assets"
TEXT_CONTENT = "moondown"

# 直接使用你本地的绝对路径
FONT_PATH = "./Quicksand-SemiBold.ttf"

# 颜色主题定义 (RGB格式)
THEMES = {
    "light": {
        "name": "LightMode",
        "moon": (17, 24, 39),      # 深邃黑灰 (适合亮色背景)
        "bar":  (29, 78, 216),     # 深一点的蓝色 (Deep Blue)
        "text": (17, 24, 39),
        "bg":   (247, 247, 245),   # 浅色主题底色
        "bg_svg": "transparent"
    },
    "dark": {
        "name": "DarkMode",
        "moon": (249, 250, 251),   # 极白 (适合暗色背景)
        "bar":  (56, 189, 248),    # 浅天蓝 (Light Sky Blue)
        "text": (249, 250, 251),
        "bg":   (29, 29, 27),      # 深色主题底色
        "bg_svg": "transparent"
    }
}

DESKTOP_PLATE_SCALE = 0.82
DESKTOP_CONTENT_SCALE = 0.9
DESKTOP_PLATE_Y_OFFSET = 0.01

WINDOWS_TILE_SIZES = {
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "StoreLogo.png": 50,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
}

# 导出尺寸矩阵
EXPORT_TARGETS = {
    "Web_Favicon": (32, 32),
    "Web_TouchIcon": (180, 180),
    "Android_Launcher": (192, 192),
    "PC_Windows_ICO": (256, 256),
    "Android_PlayStore": (512, 512),
    "macOS_Icon": (512, 512),
    "iOS_AppStore": (1024, 1024),
    "Social_Share_Cover": (1200, 630) 
}

# 图形核心几何参数
BASE_SIZE = 400
CX, CY = 200, 188
R_MAIN = 120
CUT_ANGLE_DEG, CUT_DIST, R_CUT = 45, 110, 75
TIP_R = 5
BAR_WIDTH, BAR_HEIGHT, BAR_MARGIN = 84, 10, 28

# ── 3. 几何引擎 (绘制高精度 Master Image) ──────────────────────────────────
def get_fillet_polygons(cx, cy, r, cut_cx, cut_cy, r_cut, tip_r, d_centers, ux, uy):
    R1, R2 = r - tip_r, r_cut + tip_r
    a_f = (R1**2 - R2**2 + d_centers**2) / (2 * d_centers)
    h_f = math.sqrt(max(0, R1**2 - a_f**2))
    px_f, py_f = cx + a_f * ux, cy + a_f * uy
    cf1_x, cf1_y = px_f - h_f * uy, py_f + h_f * ux
    cf2_x, cf2_y = px_f + h_f * uy, py_f - h_f * ux

    def _poly(cf_x, cf_y):
        um_x, um_y = (cf_x - cx) / R1, (cf_y - cy) / R1
        uc_x, uc_y = (cut_cx - cf_x) / R2, (cut_cy - cf_y) / R2
        return [
            (cf_x, cf_y),
            (cf_x + um_x * tip_r * 5, cf_y + um_y * tip_r * 5),
            (cf_x + (um_x+uc_x) * tip_r * 5, cf_y + (um_y+uc_y) * tip_r * 5),
            (cf_x + uc_x * tip_r * 5, cf_y + uc_y * tip_r * 5)
        ], (cf_x, cf_y)
    
    poly1, c1 = _poly(cf1_x, cf1_y)
    poly2, c2 = _poly(cf2_x, cf2_y)
    return poly1, c1, poly2, c2

def generate_master_icon(theme_colors, oversample=4):
    S = BASE_SIZE * oversample
    def s(v): return v * oversample

    mcx, mcy, mr = s(CX), s(CY), s(R_MAIN)
    cut_a = math.radians(CUT_ANGLE_DEG)
    cut_cx = mcx + s(CUT_DIST) * math.cos(cut_a)
    cut_cy = mcy - s(CUT_DIST) * math.sin(cut_a)
    r_cut_s = s(R_CUT)
    tip_r_s = s(TIP_R)

    d = math.hypot(cut_cx - mcx, cut_cy - mcy)
    ux, uy = (cut_cx - mcx) / d, (cut_cy - mcy) / d
    poly1, c1, poly2, c2 = get_fillet_polygons(mcx, mcy, mr, cut_cx, cut_cy, r_cut_s, tip_r_s, d, ux, uy)

    mask = Image.new("L", (S, S), 0)
    dm = ImageDraw.Draw(mask)
    dm.ellipse([mcx-mr, mcy-mr, mcx+mr, mcy+mr], fill=255)
    dm.ellipse([cut_cx-r_cut_s, cut_cy-r_cut_s, cut_cx+r_cut_s, cut_cy+r_cut_s], fill=0)
    dm.polygon(poly1, fill=0); dm.polygon(poly2, fill=0)
    dm.ellipse([c1[0]-tip_r_s, c1[1]-tip_r_s, c1[0]+tip_r_s, c1[1]+tip_r_s], fill=255)
    dm.ellipse([c2[0]-tip_r_s, c2[1]-tip_r_s, c2[0]+tip_r_s, c2[1]+tip_r_s], fill=255)

    canvas = Image.new("RGBA", (S, S), (0,0,0,0))
    moon_layer = Image.new("RGBA", (S, S), (*theme_colors['moon'], 255))
    canvas.paste(moon_layer, mask=mask)

    dc = ImageDraw.Draw(canvas)
    bw, bh = s(BAR_WIDTH), s(BAR_HEIGHT)
    bx, by = mcx - bw // 2, mcy + mr + s(BAR_MARGIN)
    dc.rounded_rectangle([bx, by, bx+bw, by+bh], radius=bh//2, fill=(*theme_colors['bar'], 255))
    
    return canvas 

def generate_master_full(master_icon, theme_colors):
    ICON_SIZE = master_icon.height
    GAP = int(ICON_SIZE * 0.1)
    FONT_SIZE = int(ICON_SIZE * 0.55)

    # 检查本地字体文件是否存在
    if not os.path.exists(FONT_PATH):
        print(f"❌ 错误: 找不到字体文件 {FONT_PATH}")
        sys.exit(1)

    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
    dummy_img = Image.new("RGBA", (1, 1))
    dummy_draw = ImageDraw.Draw(dummy_img)
    bbox = dummy_draw.textbbox((0, 0), TEXT_CONTENT, font=font)
    text_w = bbox[2] - bbox[0]

    canvas_w = ICON_SIZE + GAP + text_w + int(ICON_SIZE * 0.2)
    canvas = Image.new("RGBA", (canvas_w, ICON_SIZE), (0,0,0,0))

    canvas.paste(master_icon, (0, 0))

    # 利用 bbox 中点做精确垂直居中：让可视内容中心对齐 ICON_SIZE/2
    text_y = ICON_SIZE // 2 - (bbox[1] + bbox[3]) // 2
    dc = ImageDraw.Draw(canvas)
    dc.text((ICON_SIZE + GAP, text_y), TEXT_CONTENT, font=font, fill=(*theme_colors['text'], 255))

    return canvas

# ── 4. SVG 生成逻辑 ──────────────────────────────────────────────────────────
def generate_svg(theme_colors, layout="icon", with_bg=False):
    c_moon = "#{:02x}{:02x}{:02x}".format(*theme_colors['moon'])
    c_bar  = "#{:02x}{:02x}{:02x}".format(*theme_colors['bar'])
    c_text = "#{:02x}{:02x}{:02x}".format(*theme_colors['text'])
    c_bg   = "#{:02x}{:02x}{:02x}".format(*theme_colors['bg'])

    cut_a = math.radians(CUT_ANGLE_DEG)
    cut_cx = CX + CUT_DIST * math.cos(cut_a)
    cut_cy = CY - CUT_DIST * math.sin(cut_a)
    d = math.hypot(cut_cx - CX, cut_cy - CY)
    ux, uy = (cut_cx - CX) / d, (cut_cy - CY) / d
    p1, c1, p2, c2 = get_fillet_polygons(CX, CY, R_MAIN, cut_cx, cut_cy, R_CUT, TIP_R, d, ux, uy)

    def fmt(poly): return " ".join([f"{x:.2f},{y:.2f}" for x, y in poly])

    # 注意：这里将 CSS 中的字体权重改为了 600，以匹配你的 SemiBold
    svg_defs = f"""<defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@600&amp;display=swap');</style>
    <mask id="moon_mask">
      <circle cx="{CX}" cy="{CY}" r="{R_MAIN}" fill="white"/>
      <circle cx="{cut_cx:.2f}" cy="{cut_cy:.2f}" r="{R_CUT}" fill="black"/>
      <polygon points="{fmt(p1)}" fill="black"/><polygon points="{fmt(p2)}" fill="black"/>
      <circle cx="{c1[0]:.2f}" cy="{c1[1]:.2f}" r="{TIP_R}" fill="white"/>
      <circle cx="{c2[0]:.2f}" cy="{c2[1]:.2f}" r="{TIP_R}" fill="white"/>
    </mask>
  </defs>"""

    svg_icon_group = f"""<g id="logo_icon">
    <circle cx="{CX}" cy="{CY}" r="{R_MAIN}" fill="{c_moon}" mask="url(#moon_mask)"/>
    <rect x="{CX - BAR_WIDTH/2}" y="{CY + R_MAIN + BAR_MARGIN}" width="{BAR_WIDTH}" height="{BAR_HEIGHT}" rx="{BAR_HEIGHT/2}" fill="{c_bar}"/>
  </g>"""

    if layout == "icon":
        bg_rect = f'<rect width="100%" height="100%" fill="{c_bg}"/>' if with_bg else ""
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BASE_SIZE} {BASE_SIZE}">
  {svg_defs}
  {bg_rect}
  {svg_icon_group}
</svg>"""
    else:
        TEXT_SIZE = int(BASE_SIZE * 0.55)
        VB_W = int(BASE_SIZE * 3.5)
        bg_rect = f'<rect width="100%" height="100%" fill="{c_bg}"/>' if with_bg else ""

        # 用 Pillow 量出该字号的可见 bbox，把 baseline 推算到画布垂直中心
        _font_m = ImageFont.truetype(FONT_PATH, TEXT_SIZE)
        _bbox_m = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), TEXT_CONTENT, font=_font_m)
        _ascent, _ = _font_m.getmetrics()
        baseline_y = (BASE_SIZE - _bbox_m[1] - _bbox_m[3]) / 2 + _ascent

        # svg 中的字重也相应改为 600
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_W} {BASE_SIZE}">
  {svg_defs}
  {bg_rect}
  {svg_icon_group}
  <text x="{BASE_SIZE + 40}" y="{baseline_y:.2f}" font-family="'Quicksand', sans-serif" font-weight="600" font-size="{TEXT_SIZE}" fill="{c_text}">{TEXT_CONTENT}</text>
</svg>"""

# ── 5. 平台图标输出 ──────────────────────────────────────────────────────────
PLATFORM_DIR = Path("assets/platform")
TAURI_ICON_DIR = Path("src-tauri/icons")

def _icon_with_bg(master_icon, size, bg):
    scaled = master_icon.resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (*bg, 255))
    canvas.paste(scaled, (0, 0), scaled)
    return canvas

def _desktop_icon_with_bg(master_icon, size, bg):
    oversample = 4
    canvas_size = size * oversample
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    plate_size = int(canvas_size * DESKTOP_PLATE_SCALE)
    plate_x = (canvas_size - plate_size) // 2
    plate_y = int((canvas_size - plate_size) // 2 + canvas_size * DESKTOP_PLATE_Y_OFFSET)
    plate_y = max(0, min(canvas_size - plate_size, plate_y))

    mask = Image.new("L", (canvas_size, canvas_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        [plate_x, plate_y, plate_x + plate_size - 1, plate_y + plate_size - 1],
        radius=int(plate_size * 0.225),
        fill=255,
    )

    tile = Image.new("RGBA", (canvas_size, canvas_size), (*bg, 255))
    tile.putalpha(mask)
    canvas.alpha_composite(tile)

    logo_size = int(plate_size * DESKTOP_CONTENT_SCALE)
    logo = master_icon.resize((logo_size, logo_size), Image.LANCZOS)
    offset = (plate_x + (plate_size - logo_size) // 2, plate_y + (plate_size - logo_size) // 2)
    canvas.alpha_composite(logo, offset)

    return canvas.resize((size, size), Image.LANCZOS)

def _transparent_icon(master_icon, size):
    return master_icon.resize((size, size), Image.LANCZOS)

def _save_ico(master_icon, output_path, bg):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    icon = _desktop_icon_with_bg(master_icon, 256, bg)
    icon.save(output_path, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

def _save_icns(master_icon, output_path, bg):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "Moondown.iconset"
        iconset.mkdir()
        for filename, size in [
            ("icon_16x16.png", 16),
            ("icon_16x16@2x.png", 32),
            ("icon_32x32.png", 32),
            ("icon_32x32@2x.png", 64),
            ("icon_128x128.png", 128),
            ("icon_128x128@2x.png", 256),
            ("icon_256x256.png", 256),
            ("icon_256x256@2x.png", 512),
            ("icon_512x512.png", 512),
            ("icon_512x512@2x.png", 1024),
        ]:
            _desktop_icon_with_bg(master_icon, size, bg).save(iconset / filename)

        if shutil.which("iconutil"):
            subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(output_path)], check=True)
        else:
            _desktop_icon_with_bg(master_icon, 1024, bg).save(output_path, format="ICNS")

def _save_platform_assets(master_icon, master_full, bg):
    for directory in [
        PLATFORM_DIR / "web",
        PLATFORM_DIR / "windows",
        PLATFORM_DIR / "linux",
        PLATFORM_DIR / "macos",
    ]:
        directory.mkdir(parents=True, exist_ok=True)

    _icon_with_bg(master_icon, 32, bg).save(PLATFORM_DIR / "web/favicon-32.png")
    _icon_with_bg(master_icon, 180, bg).save(PLATFORM_DIR / "web/apple-touch-icon.png")
    _icon_with_bg(master_icon, 512, bg).save(PLATFORM_DIR / "web/icon-512.png")
    _desktop_icon_with_bg(master_icon, 512, bg).save(PLATFORM_DIR / "linux/icon.png")
    _desktop_icon_with_bg(master_icon, 1024, bg).save(PLATFORM_DIR / "macos/icon.png")
    _save_ico(master_icon, PLATFORM_DIR / "windows/icon.ico", bg)
    _save_icns(master_icon, PLATFORM_DIR / "macos/icon.icns", bg)

    Path("assets").mkdir(exist_ok=True)
    _transparent_icon(master_icon, 256).save("assets/logo.png")

    cover = Image.new("RGBA", (1200, 630), (*bg, 255))
    ratio = master_full.width / master_full.height
    target_w = min(980, int(440 * ratio))
    target_h = int(target_w / ratio)
    scaled_full = master_full.resize((target_w, target_h), Image.LANCZOS)
    cover.paste(scaled_full, ((1200 - target_w) // 2, (630 - target_h) // 2), scaled_full)
    cover.save("assets/logo_char.png")

    if TAURI_ICON_DIR.exists():
        _desktop_icon_with_bg(master_icon, 32, bg).save(TAURI_ICON_DIR / "32x32.png")
        _desktop_icon_with_bg(master_icon, 64, bg).save(TAURI_ICON_DIR / "64x64.png")
        _desktop_icon_with_bg(master_icon, 128, bg).save(TAURI_ICON_DIR / "128x128.png")
        _desktop_icon_with_bg(master_icon, 256, bg).save(TAURI_ICON_DIR / "128x128@2x.png")
        _desktop_icon_with_bg(master_icon, 512, bg).save(TAURI_ICON_DIR / "icon.png")
        for filename, size in WINDOWS_TILE_SIZES.items():
            _desktop_icon_with_bg(master_icon, size, bg).save(TAURI_ICON_DIR / filename)
        _save_ico(master_icon, TAURI_ICON_DIR / "icon.ico", bg)
        _save_icns(master_icon, TAURI_ICON_DIR / "icon.icns", bg)

# ── 6. 工厂流水线启动 ────────────────────────────────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)
print(f"🏭 开始全矩阵构建工作流，输出目录: {OUTPUT_DIR}")

for theme_key, theme in THEMES.items():
    print(f"\n✨ 正在处理主题: {theme['name']}")

    master_icon_img = generate_master_icon(theme, oversample=8)
    master_full_img = generate_master_full(master_icon_img, theme)
    bg_rgba = (*theme['bg'], 255)

    with open(os.path.join(OUTPUT_DIR, f"logo_icon_{theme['name']}.svg"), "w") as f:
        f.write(generate_svg(theme, layout="icon"))
    with open(os.path.join(OUTPUT_DIR, f"logo_full_{theme['name']}.svg"), "w") as f:
        f.write(generate_svg(theme, layout="full"))
    with open(os.path.join(OUTPUT_DIR, f"logo_icon_{theme['name']}_bg.svg"), "w") as f:
        f.write(generate_svg(theme, layout="icon", with_bg=True))
    with open(os.path.join(OUTPUT_DIR, f"logo_full_{theme['name']}_bg.svg"), "w") as f:
        f.write(generate_svg(theme, layout="full", with_bg=True))

    for target_name, dims in EXPORT_TARGETS.items():
        w, h = dims

        if w != h:
            icon_canvas = Image.new("RGBA", (w, h), (0,0,0,0))
            icon_canvas_bg = Image.new("RGBA", (w, h), bg_rgba)
            icon_size_adj = int(h * 0.6)
            scaled_icon = master_icon_img.resize((icon_size_adj, icon_size_adj), Image.LANCZOS)
            offset = ((w - icon_size_adj)//2, (h - icon_size_adj)//2)
            icon_canvas.paste(scaled_icon, offset)
            icon_canvas_bg.paste(scaled_icon, offset, scaled_icon)
            icon_canvas.save(os.path.join(OUTPUT_DIR, f"icon_{theme['name']}_{target_name}_{w}x{h}.png"))
            icon_canvas_bg.save(os.path.join(OUTPUT_DIR, f"icon_{theme['name']}_bg_{target_name}_{w}x{h}.png"))
        else:
            scaled_icon = master_icon_img.resize((w, h), Image.LANCZOS)
            scaled_icon.save(os.path.join(OUTPUT_DIR, f"icon_{theme['name']}_{target_name}_{w}x{w}.png"))
            icon_canvas_bg = Image.new("RGBA", (w, h), bg_rgba)
            icon_canvas_bg.paste(scaled_icon, (0, 0), scaled_icon)
            icon_canvas_bg.save(os.path.join(OUTPUT_DIR, f"icon_{theme['name']}_bg_{target_name}_{w}x{w}.png"))

        full_ratio = master_full_img.width / master_full_img.height
        scale_factor = min(w / master_full_img.width, h / master_full_img.height) * 0.8
        target_fw = int(master_full_img.width * scale_factor)
        target_fh = int(master_full_img.height * scale_factor)

        scaled_full = master_full_img.resize((target_fw, target_fh), Image.LANCZOS)
        full_canvas = Image.new("RGBA", (w, h), (0,0,0,0))
        full_canvas_bg = Image.new("RGBA", (w, h), bg_rgba)
        offset_f = ((w - target_fw)//2, (h - target_fh)//2)
        full_canvas.paste(scaled_full, offset_f)
        full_canvas_bg.paste(scaled_full, offset_f, scaled_full)
        full_canvas.save(os.path.join(OUTPUT_DIR, f"full_{theme['name']}_{target_name}_{w}x{h}.png"))
        full_canvas_bg.save(os.path.join(OUTPUT_DIR, f"full_{theme['name']}_bg_{target_name}_{w}x{h}.png"))

light_icon = generate_master_icon(THEMES["light"], oversample=8)
light_full = generate_master_full(light_icon, THEMES["light"])
_save_platform_assets(light_icon, light_full, THEMES["light"]["bg"])

print("\n✅ 所有任务完成！所有尺寸的 PNG 和 SVG 均已保存在 logo_assets 目录中。")
