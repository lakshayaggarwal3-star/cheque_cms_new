Here is the technical specification for the files you need to generate programmatically.
1. Front Grayscale Image (JPEG) 
This is used for visual verification of the signature and details.
File Container: JPG / JFIF
Color Space: 8-bit Grayscale (No RGB color profiles).
Resolution (DPI): 100 DPI exactly.
Mobile Note: You must downsample the high-res camera image. If the cheque is physically 8 inches wide, the image width must be 8 * 100 = 800 pixels.
Compression: JPEG Baseline.
Quality Factor: Set to 75-85 (Standard). Do not go lower, or artifacts will ruin the MICR code readability.
Contrast: There is no "contrast" header. You must apply a histogram equalization or gamma correction before saving if the camera image is dull. The text must be distinct from the background. 
2. Front & Back Black/White Images (TIFF)
These are used for automated processing and archival. They must be strictly bi-tonal (1-bit).
File Container: TIFF (Revision 6.0)
Compression: CCITT Group 4 (Fax standard). This is mandatory; uncompressed or LZW TIFFs are often rejected.
Color Depth: 1-bit Bi-tonal (Black & White).
Resolution (DPI): 200 DPI exactly.
Mobile Note: Higher resolution than the grayscale. Width should be approx 1600 pixels for a standard cheque.
Photometric Interpretation (Tag 262): WhiteIsZero (0).
Critical: If you set this wrong (BlackIsZero), the cheque will look like a negative (black page, white text) in the banking system.
Fill Order (Tag 266): MSB-to-LSB (Most Significant Bit first).
Strip/Tile: Prefer "Single Strip" (StripOffsets) over Tiled data for compatibility. 
3. The "Mobile to CTS" Conversion Pipeline
Since you are writing code to replace the Ranger Scanner logic, you cannot just "save as" these formats. You must implement this processing pipeline:
Capture & Crop:
Capture the raw image (likely 3000+ px wide).
Detect Edges: You must crop strictly to the cheque edges. No background (table/hand) can be visible.
De-skew: Mathematically rotate the image so the MICR band is perfectly horizontal (0 degrees skew). NPCI software is very sensitive to skew.
Resampling (The Math):
Calculate the scaling factor.
Target Width (Gray) = Physical Width (inches) * 100
Target Width (BW) = Physical Width (inches) * 200
Use a high-quality resampling filter (like Lanczos or Bicubic) to scale down to these exact pixel dimensions.
Binarization (For TIFF only):
You cannot just convert to black and white; you need a Thresholding Algorithm.
Do not use simple fixed thresholding (e.g., "pixel > 127 is white"). Mobile lighting is uneven.
Use Adaptive Thresholding (like Otsu’s Method or Sauvola). This calculates the threshold locally for every region of the cheque, ensuring the text is black even if a shadow falls across the paper. 
Summary Spec Sheet for Developers
Parameter 	Front Grayscale	Front/Back B&W
Format	JPG (JFIF)	TIFF (Multi-page or Single)
Compression	JPEG (Quality ~80)	CCITT Group 4 (G4)
Pixel Depth	8-bit (0-255)	1-bit (0 or 1)
Resolution	100 DPI	200 DPI
Metadata	X/Y Resolution tags = 100	X/Y Resolution tags = 200
Photometric	N/A	WhiteIsZero (0)
Expected Size	~15KB - 40KB	~8KB - 15KB
Developer Warning: Ensure your JPEG/TIFF headers explicitly write the DPI metadata (XResolution and YResolution tags). If these are missing (or say 72 DPI, which is default for screens), the banking software might calculate the cheque size as "huge" (like a poster) and reject it for invalid dimensions.


