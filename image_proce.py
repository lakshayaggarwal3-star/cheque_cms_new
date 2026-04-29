import cv2
import numpy as np
import os

# ====== CONFIG ======
INPUT_PATH = r"3853852604290001_001CF_O.jpg"
OUTPUT_DIR = "output_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)

img = cv2.imread(INPUT_PATH)
if img is None:
    print("Error: Image not found")
    exit()

h, w = img.shape[:2]
print(f"Image: {w}x{h}")

# ── STEP 1: GRAYSCALE → FLOAT ────────────────────────────────────────────────
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

# ── STEP 2: BACKGROUND ESTIMATION ───────────────────────────────────────────
# Gaussian blur sigma=80 washes out all fine features (text, security pattern).
# Only the slow lighting gradient + average paper brightness remains.
blur_bg = cv2.GaussianBlur(gray, (0, 0), sigmaX=80, sigmaY=80)

# ── STEP 3: HIGH-PASS + OFFSET ───────────────────────────────────────────────
# paper:          diff ≈  0   + 220 → 220  (light)
# security print: diff ≈ -15  + 220 → 205  (near-white, suppressed)
# ink / text:     diff ≈ -160 + 220 →  60  (dark)
hp = np.clip(gray - blur_bg + 220, 0, 255).astype(np.uint8)

# ── STEP 4: UNSHARP MASK ─────────────────────────────────────────────────────
blur_sharp   = cv2.GaussianBlur(hp, (3, 3), 0)
scanner_gray = cv2.addWeighted(hp, 1.4, blur_sharp, -0.4, 0)

# ── STEP 5: B&W / OTSU (visual test only — TypeScript saves grayscale TIFF) ──
otsu_val, scanner_bw = cv2.threshold(hp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
print(f"Otsu threshold: {otsu_val:.0f}")

# ── SAVE ─────────────────────────────────────────────────────────────────────
cv2.imwrite(os.path.join(OUTPUT_DIR, "1_grayscale_raw.jpg"), gray.astype(np.uint8))
cv2.imwrite(os.path.join(OUTPUT_DIR, "2_highpass.jpg"),      hp)
cv2.imwrite(os.path.join(OUTPUT_DIR, "3_scanner_gray.jpg"),  scanner_gray)
cv2.imwrite(os.path.join(OUTPUT_DIR, "4_scanner_bw.jpg"),    scanner_bw)

cv2.imshow("Original",          img)
cv2.imshow("High-pass",         hp)
cv2.imshow("Scanner Grayscale", scanner_gray)
cv2.imshow("Scanner B&W",       scanner_bw)

print("Done.")
cv2.waitKey(0)
cv2.destroyAllWindows()
