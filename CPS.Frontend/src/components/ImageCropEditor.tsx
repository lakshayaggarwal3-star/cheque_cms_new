// =============================================================================
// File        : ImageCropEditor.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Full image perspective editor with jscanify auto-detection
// Created     : 2026-04-20
// Updated     : 2026-04-28
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

declare const cv: any;

const tf = (window as any).tf;
const tflite = (window as any).tflite;
if (tflite) tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/');

const MODEL_SIZE = 640;

interface Point { x: number; y: number; }

interface ImageCropEditorProps {
  file: File;
  title: string;
  onClose: () => void;
  /** processed = grayscale TIFF; originalFile is the raw capture (cheque only) */
  onSave: (file: File, previewUrl: string, originalFile?: File) => void;
  mode?: 'desktop' | 'mobile';
  initialCropFull?: boolean;
  /** true for cheque: onSave also receives the untouched original capture */
  saveOriginal?: boolean;
  /** true for slips: skip grayscale/TIFF and save as high-quality JPG */
  isSlip?: boolean;
}

export function ImageCropEditor({ file, title, onClose, onSave, mode = 'desktop', saveOriginal = false, isSlip = false }: ImageCropEditorProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [containerRect, setContainerRect] = useState({ w: 0, h: 0, imgX: 0, imgY: 0, imgW: 0, imgH: 0 });
  
  // Normalised corners 0-1
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }
  ]);
  
  const [brightness, setBrightness] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<any>(null);

   const [detectRun, setDetectRun] = useState(false);
  const [detecting, setDetecting] = useState(false);

  // Model init
  useEffect(() => {
    const loadModel = async () => {
      if (!tflite) return;
      try {
        const fileName = 'yolo.tflite';
        const publicUrl = process.env.PUBLIC_URL || '';
        // Try multiple paths
        const paths = [
          `${publicUrl}/${fileName}`,
          `/ranger/${fileName}`,
          `/${fileName}`,
          `./${fileName}`,
          `${window.location.origin}/${fileName}`
        ];
        
        let m;
        for (let url of paths) {
          // Clean up double slashes if any
          url = url.replace(/\/+/g, '/');
          if (url.startsWith('http')) url = url.replace(':/', '://');

          try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            
            const buf = await resp.arrayBuffer();
            m = await tflite.loadTFLiteModel(buf);
            if (m) {
              break;
            }
          } catch (err) {
          }
        }
        
        if (!m) throw new Error('Could not load model from any source. Please ensure the file is in the public folder and restart your dev server.');
        
        setModel(m);
      } catch (e) {
        console.error('Failed to load YOLO model in editor', e);
      }
    };
    loadModel();
  }, [imgNatural.w]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Trigger detection when both image and model are ready
  useEffect(() => {
    if (!imgNatural.w || !model || detectRun) return;

    const runDetect = async () => {
      try {
        setDetecting(true);
        const img = new Image();
        img.src = imgUrl!;
        await img.decode();

        const w = img.naturalWidth, h = img.naturalHeight;
        const scale = Math.min(MODEL_SIZE / w, MODEL_SIZE / h);
        const padW = (MODEL_SIZE - w * scale) / 2;
        const padH = (MODEL_SIZE - h * scale) / 2;

        const input = tf.tidy(() => {
          const tfImg = tf.browser.fromPixels(img);
          const resized = tf.image.resizeBilinear(tfImg, [Math.round(h * scale), Math.round(w * scale)]);
          const normalized = tf.div(tf.cast(resized, 'float32'), 255.0);
          const padded = tf.pad(normalized, [
            [Math.floor(padH), MODEL_SIZE - Math.round(h * scale) - Math.floor(padH)],
            [Math.floor(padW), MODEL_SIZE - Math.round(w * scale) - Math.floor(padW)],
            [0, 0]
          ], 0.5);
          return padded.expandDims(0);
        });

        const preds = await model.predict(input);
        tf.dispose(input);


        const detTensor = Object.values(preds).find((t: any) => (t.shape || t.dims).length === 3) as any;
        if (detTensor) {
          const raw = detTensor.dataSync();
          const N = detTensor.shape[1];
          const C = detTensor.shape[2];
          
          let bestDet = null;
          let maxScore = 0;

          for (let i = 0; i < N; i++) {
            const score = raw[i * C + 4];
            const cls = Math.round(raw[i * C + 5]);
            

            const isDocumentClass = (cls === 73 || cls === 67 || cls === 65);
            
            // Check for Geometric Heuristics (is it a big centered object?)
            const centerX = (raw[i * C + 0] + raw[i * C + 2]) / 2;
            const centerY = (raw[i * C + 1] + raw[i * C + 3]) / 2;
            const width = Math.abs(raw[i * C + 2] - raw[i * C + 0]);
            const height = Math.abs(raw[i * C + 3] - raw[i * C + 1]);
            const area = (width * height) / (MODEL_SIZE * MODEL_SIZE);
            
            const isCentral = Math.abs(centerX - MODEL_SIZE/2) < 150 && Math.abs(centerY - MODEL_SIZE/2) < 150;
            const isLarge = area > 0.05; // > 5% of image area
            const isWide = (width / height) > 1.1; // Wider than tall (likely a cheque/book)

            // Snapping Logic
            let isCandidate = false;
            if (isDocumentClass && score > 0.1) {
              isCandidate = true;
            } else if (cls !== 0 && score > 0.2 && isCentral && isLarge && isWide) {
              // Heuristic: If not a person, and it's large/central/wide, it's likely our document
              isCandidate = true;
            }
            
            if (isCandidate) {
              // Priority: If we find a Book (73), we definitely want that. 
              // Otherwise, we take the highest score candidate.
              const isBetter = (cls === 73 && bestDet?.cls !== 73) || (score > maxScore);
              
              if (isBetter) {
                maxScore = score;
                let x1 = raw[i * C + 0], y1 = raw[i * C + 1], x2 = raw[i * C + 2], y2 = raw[i * C + 3];
                if (x1 <= 1 && x2 <= 1) {
                  x1 *= MODEL_SIZE; y1 *= MODEL_SIZE; x2 *= MODEL_SIZE; y2 *= MODEL_SIZE;
                }
                bestDet = { x1, y1, x2, y2, cls };
              }
            }
          }

          if (bestDet) {
            const nx1 = Math.max(0, Math.min(1, (bestDet.x1 - padW) / (scale * w)));
            const ny1 = Math.max(0, Math.min(1, (bestDet.y1 - padH) / (scale * h)));
            const nx2 = Math.max(0, Math.min(1, (bestDet.x2 - padW) / (scale * w)));
            const ny2 = Math.max(0, Math.min(1, (bestDet.y2 - padH) / (scale * h)));

            setCorners([
              { x: nx1, y: ny1 },
              { x: nx2, y: ny1 },
              { x: nx2, y: ny2 },
              { x: nx1, y: ny2 }
            ]);
          } else {
            // Fallback: If no document detected, default to a centered rectangle (70% width, 60% height)
            setCorners([
              { x: 0.15, y: 0.20 },
              { x: 0.85, y: 0.20 },
              { x: 0.85, y: 0.80 },
              { x: 0.15, y: 0.80 }
            ]);
          }
        } else {
          console.error('YOLO: Could not find detection tensor in model output.');
        }
        
        Object.values(preds).forEach((t: any) => t.dispose());

      } catch (e) {
        console.warn('Auto-detect failed', e);
      } finally {
        setDetecting(false);
        setDetectRun(true);
      }
    };

    runDetect();
  }, [imgNatural, imgUrl, detectRun, model]);

  const calcLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el || !imgNatural.w) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min(cw / imgNatural.w, ch / imgNatural.h);
    const imgW = imgNatural.w * scale;
    const imgH = imgNatural.h * scale;
    setContainerRect({ w: cw, h: ch, imgX: (cw - imgW) / 2, imgY: (ch - imgH) / 2, imgW, imgH });
  }, [imgNatural]);

  useEffect(() => {
    calcLayout();
    const obs = new ResizeObserver(calcLayout);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [calcLayout]);

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    const lx = clientX - r.left - containerRect.imgX;
    const ly = clientY - r.top - containerRect.imgY;
    return { x: lx / containerRect.imgW, y: ly / containerRect.imgH };
  }, [containerRect]);

  const onStart = (idx: number) => {
    setDragging(idx);
  };

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (dragging < 0) return;
    const pos = getCanvasPos(clientX, clientY);
    setCorners(prev => {
      const next = [...prev];
      next[dragging] = { 
        x: Math.max(0, Math.min(1, pos.x)), 
        y: Math.max(0, Math.min(1, pos.y)) 
      };
      return next;
    });
  }, [dragging, getCanvasPos]);

  const onEnd = () => setDragging(-1);

  useEffect(() => {
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const mu = () => onEnd();
    const tm = (e: TouchEvent) => { if (dragging >= 0) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } };
    const tu = () => onEnd();

    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', tu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', tu);
    };
  }, [onMove, dragging]);

  const handleReset = () => {
    setCorners([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }]);
    setBrightness(100); setGrayscale(0); setRotation(0);
  };

  const handleSave = async () => {
    if (!imgUrl) return;
    setSaving(true);
    let sp: any = null, dp: any = null, M: any = null, srcMat: any = null;
    let warpMat: any = null, grayMat: any = null, equalizedMat: any = null, finalMat: any = null;
    try {
      const img = await loadImg(imgUrl);
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.naturalWidth; srcCanvas.height = img.naturalHeight;
      srcCanvas.getContext('2d')!.drawImage(img, 0, 0);

      // ── Step 1: perspective warp ────────────────────────────────────────
      const pts = corners.map(p => ({ x: p.x * img.naturalWidth, y: p.y * img.naturalHeight }));
      const dw = Math.round(Math.max(
        Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y),
      ));
      const dh = Math.round(Math.max(
        Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y),
        Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y),
      ));
      sp = cv.matFromArray(4,1,cv.CV_32FC2,[pts[0].x,pts[0].y,pts[1].x,pts[1].y,pts[2].x,pts[2].y,pts[3].x,pts[3].y]);
      dp = cv.matFromArray(4,1,cv.CV_32FC2,[0,0,dw,0,dw,dh,0,dh]);
      M = cv.getPerspectiveTransform(sp, dp);
      srcMat = cv.imread(srcCanvas);
      warpMat = new cv.Mat();
      cv.warpPerspective(srcMat, warpMat, M, new cv.Size(dw, dh));

      // ── Step 2: encode final output ─────────────────────────────────────
      const baseName = file.name.replace(/\.[^.]+$/, '');
      
      if (isSlip) {
        // For slips: save as high-quality JPEG (Original Color)
        const canvas = document.createElement('canvas');
        cv.imshow(canvas, warpMat);
        canvas.toBlob((blob) => {
          if (blob) {
            const jpgFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
            const previewUrl = canvas.toDataURL('image/jpeg', 0.9);
            onSave(jpgFile, previewUrl);
          }
          setSaving(false);
        }, 'image/jpeg', 0.9);
        return; // Exit early as toBlob is async
      } else {
        // For cheques: Convert to Grayscale & Apply Adaptive Enhancement (CLAHE)
        grayMat = new cv.Mat();
        cv.cvtColor(warpMat, grayMat, cv.COLOR_RGBA2GRAY);

        // Apply CLAHE to fix uneven lighting and shadows
        equalizedMat = new cv.Mat();
        const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(grayMat, equalizedMat);
        clahe.delete();

        finalMat = equalizedMat;

        // Encode as uncompressed 8-bit grayscale TIFF
        const w = finalMat.cols, h = finalMat.rows;
        const step = finalMat.step[0] as number;
        const pixels = new Uint8Array(w * h);
        for (let row = 0; row < h; row++)
          for (let col = 0; col < w; col++)
            pixels[row * w + col] = finalMat.data[row * step + col];

        const tiffBuf  = encodeGrayscaleTIFF(pixels, w, h);
        const tiffBlob = new Blob([tiffBuf], { type: 'image/tiff' });
        const tiffFile = new File([tiffBlob], `${baseName}.tif`, { type: 'image/tiff' });

        // JPEG preview — browsers cannot render TIFF inline
        const previewCanvas = document.createElement('canvas');
        cv.imshow(previewCanvas, finalMat);
        const previewUrl = previewCanvas.toDataURL('image/jpeg', 0.88);

        // Original untouched capture — rename with _O suffix
        const ext = file.name.substring(file.name.lastIndexOf('.'));
        const originalRenamed = new File([file], `${baseName}_O${ext}`, { type: file.type });
        onSave(tiffFile, previewUrl, saveOriginal ? originalRenamed : undefined);
      }
    } catch (e) {
      console.error('ImageCropEditor save failed', e);
    } finally {
      [sp, dp, M, srcMat, warpMat, grayMat, equalizedMat].forEach(m => { try { m?.delete(); } catch (_) {} });
      if (finalMat && finalMat !== grayMat) { try { finalMat.delete(); } catch (_) {} }
      setSaving(false);
    }
  };

  const isTouch = mode === 'mobile';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      overscrollBehaviorX: 'none', // Disable swipe navigation
    }}>
      {/* -- Header -- */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', flexShrink: 0,
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={onClose} style={hdrBtn}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>
        <span style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 15 }}>{title}</span>
        <div style={{ width: 36 }} />
      </div>

      {/* -- Editor Area -- */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111', touchAction: 'none' }}>
        {imgUrl && (
          <img
            src={imgUrl}
            alt="edit"
            draggable={false}
            style={{
              position: 'absolute',
              left: containerRect.imgX, top: containerRect.imgY,
              width: containerRect.imgW, height: containerRect.imgH,
              objectFit: 'contain',
              filter: `brightness(${brightness}%) grayscale(${grayscale}%)`,
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
              pointerEvents: 'none', userSelect: 'none',
            }}
          />
        )}

        {/* Auto-detect Badge / Loading */}
        {detecting ? (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24',
            padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
            border: '1px solid rgba(251, 191, 36, 0.4)', zIndex: 5,
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, animation: 'spin 2s linear infinite' }}>sync</span>
            DETECTING...
          </div>
        ) : detectRun && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0, 229, 255, 0.2)', color: '#00e5ff',
            padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
            border: '1px solid rgba(0, 229, 255, 0.4)', zIndex: 5,
            backdropFilter: 'blur(4px)',
          }}>
            AUTO-DETECTED
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

        {/* Highlight Polygon */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <polygon
            points={corners.map(p => `${containerRect.imgX + p.x * containerRect.imgW},${containerRect.imgY + p.y * containerRect.imgH}`).join(' ')}
            fill="rgba(0, 229, 255, 0.15)"
            stroke="#00e5ff"
            strokeWidth="2"
          />
        </svg>

        {/* Handles */}
        {corners.map((p, i) => (
          <div
            key={i}
            onMouseDown={!isTouch ? () => onStart(i) : undefined}
            onTouchStart={isTouch ? () => onStart(i) : undefined}
            style={{
              position: 'absolute',
              left: containerRect.imgX + p.x * containerRect.imgW - 20,
              top: containerRect.imgY + p.y * containerRect.imgH - 20,
              width: 40, height: 40,
              borderRadius: '50%',
              background: dragging === i ? '#fbbf24' : '#00e5ff',
              border: '2px solid #fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'move', zIndex: 10, touchAction: 'none'
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: '#000' }}>{['TL', 'TR', 'BR', 'BL'][i]}</span>
          </div>
        ))}
      </div>

      {/* -- Controls -- */}
      <div style={{
        background: 'var(--bg-raised)', padding: '16px 16px 12px',
        borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSlip ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 8 }}>
          <Slider label="Brightness" value={brightness} min={50} max={160} step={5} unit="%" onChange={setBrightness} />
          {!isSlip && <Slider label="Grayscale"  value={grayscale}  min={0}  max={100} step={5} unit="%" onChange={setGrayscale}  />}
          <Slider label="Rotate"     value={rotation}   min={-180} max={180} step={1} unit="°" onChange={setRotation} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 4 }}>
          <button onClick={handleReset} style={outlineBtn}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
            Reset
          </button>
          <button onClick={onClose} style={outlineBtn}>
            Cancel
          </button>
          <button 
            onClick={() => {
              handleSave();
            }} 
            disabled={saving} 
            style={{
              ...primaryBtn,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Processing...' : 'Save & Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Encode an 8-bit grayscale pixel array as an uncompressed TIFF (little-endian, TIFF 6.0)
function encodeGrayscaleTIFF(pixels: Uint8Array, width: number, height: number): ArrayBuffer {
  // IFD entries: [tag, type (3=SHORT 4=LONG), count, value]
  const entries: [number, number, number, number][] = [
    [256, 4, 1, width],         // ImageWidth
    [257, 4, 1, height],        // ImageLength
    [258, 3, 1, 8],             // BitsPerSample = 8
    [259, 3, 1, 1],             // Compression = None
    [262, 3, 1, 1],             // PhotometricInterpretation = BlackIsZero
    [273, 4, 1, 0],             // StripOffsets — patched below
    [277, 3, 1, 1],             // SamplesPerPixel = 1
    [278, 4, 1, height],        // RowsPerStrip = all rows in one strip
    [279, 4, 1, pixels.length], // StripByteCounts
  ];

  const HEADER    = 8;
  const IFD_SIZE  = 2 + entries.length * 12 + 4; // count + entries + nextIFD
  const DATA_OFF  = HEADER + IFD_SIZE;
  entries[5][3]   = DATA_OFF; // fix StripOffsets

  const buf = new ArrayBuffer(DATA_OFF + pixels.length);
  const dv  = new DataView(buf);
  const LE  = true;

  dv.setUint16(0, 0x4949, LE); // 'II' little-endian
  dv.setUint16(2, 42,     LE); // TIFF magic
  dv.setUint32(4, HEADER, LE); // IFD offset

  let pos = HEADER;
  dv.setUint16(pos, entries.length, LE); pos += 2;

  for (const [tag, type, count, value] of entries) {
    dv.setUint16(pos,     tag,   LE);
    dv.setUint16(pos + 2, type,  LE);
    dv.setUint32(pos + 4, count, LE);
    // For SHORT (type 3) the value sits in the first 2 bytes of the 4-byte value field
    if (type === 3) { dv.setUint16(pos + 8, value, LE); dv.setUint16(pos + 10, 0, LE); }
    else            { dv.setUint32(pos + 8, value, LE); }
    pos += 12;
  }
  dv.setUint32(pos, 0, LE); // next IFD = none

  new Uint8Array(buf).set(pixels, DATA_OFF);
  return buf;
}


function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-subtle)', fontVariantNumeric:'tabular-nums' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width:'100%', accentColor:'var(--accent-500)', cursor:'pointer' }} />
    </div>
  );
}

async function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
}

const hdrBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8,
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#cbd5e1', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const outlineBtn: React.CSSProperties = {
  display:'flex', alignItems:'center', justifyContent:'center', gap:4,
  padding:'11px 4px', borderRadius:'var(--r-md)',
  background:'var(--bg-subtle)', border:'1px solid var(--border-strong)',
  color:'var(--fg)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
};

const primaryBtn: React.CSSProperties = {
  display:'flex', alignItems:'center', justifyContent:'center',
  padding:'11px 4px', borderRadius:'var(--r-md)',
  background:'var(--accent-500)', border:'1px solid var(--accent-600)',
  color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
  boxShadow: 'var(--shadow-sm)',
};

