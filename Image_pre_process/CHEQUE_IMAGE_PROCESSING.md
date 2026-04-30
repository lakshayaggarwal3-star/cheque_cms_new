# Cheque Image Processing — Phone Photo to Scanner-Quality Output

## Goal

Take a phone photo of a cheque and produce two outputs that match real cheque scanner output:
- **Grayscale** — clean, even, matches `*_001CF.jpg` style
- **Black & White** — white background with black ink only, matches `*_001CF_1.jpg` style

---

## The Core Problem

A phone photo of a cheque has three types of pixel darkness:

| Region | Approx gray value | What we want in output |
|---|---|---|
| Paper (blank areas) | ~210 | White |
| Security background pattern (wavy lines) | ~185–200 | White (suppress it) |
| Ink — text, lines, handwriting, MICR | ~30–100 | Black / dark |

The security background pattern is printed in colored (cyan) ink that real cheque scanners suppress using **infrared scanning** — the pattern is IR-transparent, regular ink is IR-absorbing. We cannot replicate IR in software, but we can exploit the fact that the pattern is **only slightly darker than paper** while ink is **much darker**.

---

## Algorithm

### Step 1 — Grayscale

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
```

Convert to single-channel. We deliberately discard color here to avoid relying on color assumptions that change across different phone cameras, lighting conditions, or cheque brands.

---

### Step 2 — Large Gaussian Blur (Background Estimation)

```python
blur_bg = cv2.GaussianBlur(gray, (0, 0), sigmaX=80, sigmaY=80)
```

A Gaussian blur with sigma=80 averages over a radius of ~240 pixels. At this scale:
- Fine features (text strokes: 5–20px, security lines: 1–3px) are completely washed out
- What remains: the **slowly-varying lighting gradient** from the phone camera + average paper brightness

This blurred image is the **background estimate** — what the image would look like if all printed content were removed.

---

### Step 3 — High-Pass Filter + Offset (Key Step)

```python
OFFSET = 220
hp = np.clip(gray - blur_bg + OFFSET, 0, 255).astype(np.uint8)
```

`gray - blur_bg` is the difference between each pixel and its local background average:

| Pixel type | gray | blur_bg | diff | + OFFSET 220 | Final |
|---|---|---|---|---|---|
| Paper | ~210 | ~210 | ≈ 0 | +220 | **220 (white)** |
| Security pattern | ~190 | ~210 | ≈ −20 | +220 | **200 (near-white)** |
| Ink / text | ~50 | ~210 | ≈ −160 | +220 | **60 (dark)** |

**Why this works:** The security pattern is only ~20 gray levels darker than paper. After subtracting the background estimate, it falls just barely below paper and both map to near-white. Ink is ~160 levels darker than the background, so it remains dark regardless. No color information needed.

**Tuning OFFSET:** If output looks too dark overall, raise OFFSET (try 230, 240). If paper areas blow out to pure white too aggressively, lower it (try 210, 200).

---

### Step 4 — Unsharp Mask (Grayscale Output)

```python
blur_sharp = cv2.GaussianBlur(hp, (3, 3), 0)
scanner_gray = cv2.addWeighted(hp, 1.4, blur_sharp, -0.4, 0)
```

Formula: `output = original × 1.4 − blurred × 0.4`

This sharpens text stroke edges slightly so the result looks crisp like a real scanner grayscale output. The flat background areas are unaffected (blurring a uniform region produces the same uniform region).

---

### Step 5 — Otsu Threshold (B&W Output)

```python
_, scanner_bw = cv2.threshold(hp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
```

After the high-pass step, the pixel intensity histogram has two clear clusters:
- **200–240**: paper + security pattern (both near-white after step 3)
- **50–140**: all ink types (text, lines, MICR, handwriting)

Otsu's algorithm finds the valley between these two clusters automatically by maximizing inter-class variance. Pixels above threshold → 255 (white), below → 0 (black).

**Manual fallback** — if Otsu picks the wrong threshold (check the printed value), replace with:
```python
_, scanner_bw = cv2.threshold(hp, 150, 255, cv2.THRESH_BINARY)
# Try values: 130, 140, 150, 160, 170, 180
```
- **Pattern still visible as black** → lower the value
- **Text too thin or broken** → raise the value

---

## Why Previous Approaches Failed

### Version 1 — Local normalization: `(gray − mean) / (std + 10)`

`gray − mean` produces **negative values** wherever the paper pixel is brighter than the local mean (which is almost everywhere on a light cheque). After `NORM_MINMAX` these negative values get remapped and the image inverts — dark becomes light and light becomes dark.

---

### Version 2 — Divide by dilated background + CLAHE

The divide step correctly removed lighting variation. But then CLAHE (Contrast Limited Adaptive Histogram Equalization) was applied. CLAHE enhances **local contrast** — it looked at each tile, found the faint security pattern, and enhanced it to be more visible. The opposite of what we wanted. Adaptive threshold then treated the pattern as "dark" relative to local average → appeared as black in output.

---

### Version 3 — Saturation masking (threshold = 15)

Phone JPEG photos have **color noise on every pixel** from:
- JPEG 4:2:0 chroma subsampling (color compression artifacts)
- Camera sensor noise
- Warm ambient lighting making all neutrals appear slightly yellow

Even "neutral gray" paper pixels have saturation values of 20–40 in a typical phone photo. Threshold of 15 caught >90% of the image as "colored background" and erased it. The resulting near-blank white image caused Otsu to find a degenerate threshold, producing garbage B&W output.

---

## Limitations

- **Not identical to real IR scanner output.** IR scanning physically separates security print from ink at the hardware level. Software can only approximate this by exploiting the contrast difference.
- **Depends on lighting.** Heavily uneven phone lighting (strong shadows) may cause the blur background estimate to be inaccurate near edges. Use `OFFSET` tuning to compensate.
- **JPEG compression artifacts.** Heavily compressed JPEG input adds blocking noise that survives the high-pass filter. Use PNG or high-quality JPEG as input where possible.
- **Won't work if security pattern is very dark.** Some cheque designs have high-contrast security patterns that are as dark as actual text — the algorithm cannot separate them without color information.

---

## File Reference

| File | Description |
|---|---|
| `image_proce.py` | Main processing script |
| `Screenshot 2026-04-28 233304.png` | Input: phone photo of cheque |
| `output_images/1_grayscale_raw.jpg` | Raw grayscale (no processing) |
| `output_images/2_highpass.jpg` | After high-pass filter (background removed) |
| `output_images/3_scanner_gray.jpg` | Final grayscale output (scanner style) |
| `output_images/4_scanner_bw.jpg` | Final B&W output (scanner style) |
| `3853852604290002_001CF.jpg` | Reference: real scanner grayscale output |
| `3853852604290002_001CF_1.jpg` | Reference: real scanner B&W output |
