// =============================================================================
// File        : RREditModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : RR (Return Reason)
// Description : Full-screen image editor — bbox zoom, rotate, grayscale/BW with
//               same OpenCV pipeline as ImageCropEditor; values stored in EXIF.
// Created     : 2026-04-28
// =============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import exifr from 'exifr';
import { Icon } from '../../components/scan';
import { getImageUrl } from '../../utils/imageUtils';

declare const cv: any;

interface Point { x: number; y: number; }

interface ImageMeta {
  bbox: Point[];
  grayIntensity: number;  // gamma brightness (default 220; 220=neutral γ=1.42, higher=brighter)
}

interface Props {
  imageBaseName: string;
  onClose: () => void;
  onSave: (frontJpg: File, frontTiff: File, backJpg: File, backTiff: File, frontMeta: ImageMeta, backMeta: ImageMeta) => void;
}

const DEFAULT_META: ImageMeta = { bbox: [
  { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 },
], grayIntensity: 220 };

// Standard CTS-2010 cheque aspect ratio: 216 mm × 94 mm
const CHEQUE_W_MM = 216, CHEQUE_H_MM = 94;

type ViewMode = 'crop' | 'gray' | 'bw';

// ─────────────────────────────────────────────────────────────────────────────
// Metadata helpers
// ─────────────────────────────────────────────────────────────────────────────
function parseMeta(raw: any): Partial<ImageMeta> | null {
  if (!raw) return null;
  let str = raw instanceof Uint8Array || ArrayBuffer.isView(raw)
    ? new TextDecoder().decode(raw as Uint8Array)
    : typeof raw === 'string' ? raw : String(raw);
  const clean = str.replace(/\0/g, '').trim();
  try {
    const objStart = clean.indexOf('{');
    if (objStart !== -1) {
      const obj = JSON.parse(clean.slice(objStart, clean.lastIndexOf('}') + 1));
      if (Array.isArray(obj.bbox)) return obj as Partial<ImageMeta>;
    }
    // Legacy: bare array
    const s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s !== -1 && e > s) return { bbox: JSON.parse(clean.slice(s, e + 1)) };
  } catch (_) { /* ignore */ }
  return null;
}

function buildMeta(meta: ImageMeta): string {
  return JSON.stringify({ bbox: meta.bbox, grayIntensity: meta.grayIntensity });
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenCV pipeline — gray: warp→resize→grayscale→gamma; bw: same + Otsu
// ─────────────────────────────────────────────────────────────────────────────
async function processImage(imageUrl: string, meta: ImageMeta, rotation: number, mode: ViewMode = 'gray'): Promise<{ jpgBlob: Blob; tiffBlob: Blob }> {
  if (typeof cv === 'undefined' || !cv.Mat) throw new Error('OpenCV not ready');

  const fetchedBlob = await fetch(imageUrl, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`Image fetch failed: ${r.status} ${imageUrl}`);
    return r.blob();
  });
  const blobUrl = URL.createObjectURL(fetchedBlob);

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = (e) => rej(new Error(`Image load failed: ${imageUrl} ${e}`));
    i.src = blobUrl;
  });

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width  = img.naturalWidth;
  srcCanvas.height = img.naturalHeight;
  const ctx = srcCanvas.getContext('2d')!;

  if (rotation !== 0) {
    ctx.save();
    ctx.translate(img.naturalWidth / 2, img.naturalHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  } else {
    ctx.drawImage(img, 0, 0);
  }

  let sp: any, dp: any, M: any, srcMat: any, warpMat: any;
  let grayScaleMat: any, grayMat: any, finalMat: any;

  const cleanup = () => {
    URL.revokeObjectURL(blobUrl);
    [sp, dp, M, srcMat, warpMat, grayScaleMat, grayMat, finalMat]
      .forEach(m => { try { m?.delete(); } catch (_) {} });
  };

  try {
    const pts = meta.bbox.map(p => ({ x: p.x * img.naturalWidth, y: p.y * img.naturalHeight }));

    const topW  = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const botW  = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
    const leftH = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
    const rightH= Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);
    const measW = Math.max(topW, botW);
    const measH = Math.max(leftH, rightH);

    const chequeAspect = CHEQUE_W_MM / CHEQUE_H_MM;
    let dw: number, dh: number;
    if (measW / measH > chequeAspect) {
      dw = Math.round(measW); dh = Math.round(dw / chequeAspect);
    } else {
      dh = Math.round(measH); dw = Math.round(dh * chequeAspect);
    }

    sp = cv.matFromArray(4, 1, cv.CV_32FC2, [
      pts[0].x, pts[0].y, pts[1].x, pts[1].y,
      pts[2].x, pts[2].y, pts[3].x, pts[3].y,
    ]);
    dp = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, dw, 0, dw, dh, 0, dh]);
    M = cv.getPerspectiveTransform(sp, dp);
    srcMat  = cv.imread(srcCanvas);
    warpMat = new cv.Mat();
    cv.warpPerspective(srcMat, warpMat, M, new cv.Size(dw, dh));

    // ── Gray pipeline ──────────────────────────────────────────────────────
    const GRAY_W = 800;   // 100 DPI × 8"
    const BW_W   = 1600;  // 200 DPI × 8"

    grayScaleMat = new cv.Mat();
    const grayScaleH = Math.round(dh * (GRAY_W / dw));
    cv.resize(warpMat, grayScaleMat, new cv.Size(GRAY_W, grayScaleH), 0, 0, cv.INTER_LANCZOS4);

    grayMat = new cv.Mat();
    cv.cvtColor(grayScaleMat, grayMat, cv.COLOR_RGBA2GRAY);
    grayScaleMat.delete(); grayScaleMat = null;

    // Gamma brightness — slider 220=default; pixel loop, no cv.LUT dependency
    finalMat = grayMat.clone();
    const gamma = meta.grayIntensity / 155;
    const invGamma = 1 / gamma;
    const gammaTable = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      gammaTable[i] = Math.min(255, Math.round(255 * Math.pow(i / 255, invGamma)));
    }
    const pixels = finalMat.data;
    for (let i = 0; i < pixels.length; i++) pixels[i] = gammaTable[pixels[i]];

    if (mode === 'gray') {
      const jpgCanvas = document.createElement('canvas');
      cv.imshow(jpgCanvas, finalMat);
      const jpgBlob = await new Promise<Blob>((res, rej) =>
        jpgCanvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.82)
      );
      const grayPatched = patchJpegDpi(await jpgBlob.arrayBuffer(), 100);
      cleanup();
      return { jpgBlob: new Blob([grayPatched], { type: 'image/jpeg' }), tiffBlob: new Blob([grayPatched], { type: 'image/jpeg' }) };
    }

    // ── BW pipeline: scale to 1600px, pure Otsu ────────────────────────────
    const bwScaleMat = new cv.Mat();
    const bwScaleH = Math.round(grayScaleH * (BW_W / GRAY_W));
    cv.resize(finalMat, bwScaleMat, new cv.Size(BW_W, bwScaleH), 0, 0, cv.INTER_LANCZOS4);

    const bwMat = new cv.Mat();
    cv.threshold(bwScaleMat, bwMat, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
    bwScaleMat.delete();

    const bwCanvas = document.createElement('canvas');
    cv.imshow(bwCanvas, bwMat);
    const bwPreviewBlob = await new Promise<Blob>((res, rej) =>
      bwCanvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.82)
    );

    const wT = bwMat.cols, hT = bwMat.rows;
    const stepT = bwMat.step[0] as number;
    const rowBytes = Math.ceil(wT / 8);
    const packed = new Uint8Array(rowBytes * hT);
    for (let row = 0; row < hT; row++) {
      for (let col = 0; col < wT; col++) {
        if (bwMat.data[row * stepT + col] === 0)
          packed[row * rowBytes + Math.floor(col / 8)] |= (0x80 >> (col % 8));
      }
    }
    bwMat.delete();
    const tiffBlob = new Blob([encodeBitonalTIFF(packed, wT, hT, rowBytes)], { type: 'image/tiff' });

    cleanup();
    return { jpgBlob: bwPreviewBlob, tiffBlob };
  } catch (e) {
    cleanup();
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Root modal
// ─────────────────────────────────────────────────────────────────────────────
export function RREditModal({ imageBaseName, onClose, onSave }: Props) {
  const frontUrl = getImageUrl(`${imageBaseName}CF_O.jpg`);
  const backUrl  = getImageUrl(`${imageBaseName}CR_O.jpg`);

  const [frontMeta, setFrontMeta] = useState<ImageMeta>({ ...DEFAULT_META, bbox: [...DEFAULT_META.bbox] });
  const [backMeta,  setBackMeta]  = useState<ImageMeta>({ ...DEFAULT_META, bbox: [...DEFAULT_META.bbox] });
  const [viewMode,  setViewMode]  = useState<ViewMode>('crop');
  const [grayValue, setGrayValue] = useState(220);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const apply = (raw: any, setter: (m: ImageMeta) => void) => {
          const parsed = parseMeta(raw);
          if (!parsed) return;
          setter({
            bbox:          Array.isArray(parsed.bbox) ? parsed.bbox : DEFAULT_META.bbox,
            grayIntensity: typeof parsed.grayIntensity === 'number' ? parsed.grayIntensity : 220,
          });
        };
        const [fm, bm] = await Promise.all([
          exifr.parse(frontUrl, { userComment: true, pick: ['userComment'] }),
          exifr.parse(backUrl,  { userComment: true, pick: ['userComment'] }),
        ]);
        apply(fm?.userComment, m => { setFrontMeta(m); setGrayValue(m.grayIntensity); });
        apply(bm?.userComment, setBackMeta);
      } catch (err) { console.error('Error reading image metadata', err); }
    }
    load();
  }, [frontUrl, backUrl]);

  const frontMetaWithSlider: ImageMeta = { ...frontMeta, grayIntensity: grayValue };
  const backMetaWithSlider:  ImageMeta = { ...backMeta,  grayIntensity: grayValue };

  const [frontRotation, setFrontRotation] = useState(0);
  const [backRotation,  setBackRotation]  = useState(0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const [frontGray, frontBW, backGray, backBW] = await Promise.all([
        processImage(frontUrl, frontMetaWithSlider, frontRotation, 'gray'),
        processImage(frontUrl, frontMetaWithSlider, frontRotation, 'bw'),
        processImage(backUrl,  backMetaWithSlider,  backRotation,  'gray'),
        processImage(backUrl,  backMetaWithSlider,  backRotation,  'bw'),
      ]);

      const baseName = imageBaseName.replace(/\/$/, '').split('/').pop() ?? imageBaseName;
      const fJpg  = new File([frontGray.jpgBlob], `${baseName}CF.jpg`,  { type: 'image/jpeg' });
      const fTiff = new File([frontBW.tiffBlob],  `${baseName}CF.tif`,  { type: 'image/tiff' });
      const bJpg  = new File([backGray.jpgBlob],  `${baseName}CR.jpg`,  { type: 'image/jpeg' });
      const bTiff = new File([backBW.tiffBlob],   `${baseName}CR.tif`,  { type: 'image/tiff' });

      onSave(fJpg, fTiff, bJpg, bTiff, frontMetaWithSlider, backMetaWithSlider);
    } catch (e) {
      console.error('RREditModal save failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a', display: 'flex', flexDirection: 'column', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{
        height: 52, padding: '0 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 220 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#06b6d4,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(99,102,241,0.35)' }}>
            <Icon name="edit" size={15} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.01em' }}>Image Editor</span>
        </div>

        <ModeToggle value={viewMode} onChange={setViewMode} />

        <div style={{ display: 'flex', gap: 8, width: 220, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ height: 32, padding: '0 16px', fontSize: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ height: 32, padding: '0 20px', fontSize: 12, borderRadius: 8, background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#06b6d4,#6366f1)', border: 'none', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 700, boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            {saving ? 'Processing…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Panels */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        <Panel
          label="FRONT"
          imageUrl={frontUrl}
          meta={frontMetaWithSlider} setMeta={m => setFrontMeta(m)}
          rotation={frontRotation} setRotation={setFrontRotation}
          viewMode={viewMode} grayValue={grayValue}
          borderRight
        />
        <Panel
          label="BACK"
          imageUrl={backUrl}
          meta={backMetaWithSlider} setMeta={m => setBackMeta(m)}
          rotation={backRotation} setRotation={setBackRotation}
          viewMode={viewMode} grayValue={grayValue}
        />
      </div>

      {/* Intensity slider — gray and bw modes (same slider controls brightness → affects both) */}
      {viewMode !== 'crop' && (
        <BottomSlider grayValue={grayValue} setGrayValue={setGrayValue} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3-way toggle
// ─────────────────────────────────────────────────────────────────────────────
const MODES: { key: ViewMode; label: string; icon: string }[] = [
  { key: 'crop', label: 'Crop Edit', icon: 'crop' },
  { key: 'gray', label: 'Grayscale', icon: 'contrast' },
  { key: 'bw',   label: 'B & W',    icon: 'tonality' },
];

function ModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, gap: 2, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
      {MODES.map(m => {
        const active = value === m.key;
        return (
          <button key={m.key} onClick={() => onChange(m.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: '.03em', transition: 'all .18s', background: active ? 'linear-gradient(135deg,#06b6d4,#6366f1)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.45)', boxShadow: active ? '0 0 14px rgba(99,102,241,0.35)' : 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, userSelect: 'none' }}>{m.icon}</span>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom slider — single brightness slider; applies to both gray and BW
// ─────────────────────────────────────────────────────────────────────────────
function BottomSlider({ grayValue, setGrayValue }: { grayValue: number; setGrayValue: (v: number) => void }) {
  return (
    <div style={{ flexShrink: 0, padding: '10px 32px 14px', background: '#1e293b', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>contrast</span>
        Brightness
      </span>
      <input type="range" min={100} max={300} step={1} value={grayValue} onChange={e => setGrayValue(Number(e.target.value))} style={{ flex: 1, accentColor: '#06b6d4', cursor: 'pointer' }} />
      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#06b6d4', minWidth: 36, textAlign: 'right' }}>{grayValue}</span>
      <button onClick={() => setGrayValue(220)} title="Reset" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>restart_alt</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────────
interface PanelProps {
  label: string;
  imageUrl: string;
  meta: ImageMeta;
  setMeta: (m: ImageMeta) => void;
  rotation: number;
  setRotation: (v: number) => void;
  viewMode: ViewMode;
  grayValue: number;
  borderRight?: boolean;
}
function Panel({ label, imageUrl, meta, setMeta, rotation, setRotation, viewMode, grayValue, borderRight }: PanelProps) {
  const bbox    = meta.bbox;
  const setBbox = (b: Point[]) => setMeta({ ...meta, bbox: b });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: borderRight ? '1px solid rgba(255,255,255,0.07)' : undefined, background: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', padding: '3px 14px', borderRadius: 20, background: 'linear-gradient(90deg,rgba(6,182,212,0.1),rgba(99,102,241,0.1))', border: '1px solid rgba(99,102,241,0.18)', color: '#475569' }}>
          {label}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <BBoxEditor
          imageUrl={imageUrl} bbox={bbox} setBbox={setBbox}
          rotation={rotation} viewMode={viewMode} grayIntensity={grayValue}
        />
      </div>

      {viewMode === 'crop' && (
        <div style={{ flexShrink: 0, padding: '8px 16px 10px', background: '#1e293b', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#475569', flexShrink: 0 }}>rotate_right</span>
          <input type="range" min={-180} max={180} step={1} value={rotation} onChange={e => setRotation(Number(e.target.value))} style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }} />
          <span style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>{rotation > 0 ? '+' : ''}{rotation}°</span>
          <button onClick={() => setRotation(0)} title="Reset" style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>restart_alt</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BBoxEditor
// ─────────────────────────────────────────────────────────────────────────────
interface BBoxEditorProps {
  imageUrl: string;
  bbox: Point[];
  setBbox: (p: Point[]) => void;
  rotation: number;
  viewMode: ViewMode;
  grayIntensity: number;
}

const BBOX_PAD = 0.18;

function bboxToView(bbox: Point[], baseImgW: number, baseImgH: number, cw: number, ch: number) {
  const xs = bbox.map(p => p.x), ys = bbox.map(p => p.y);
  const bx1 = Math.min(...xs), bx2 = Math.max(...xs);
  const by1 = Math.min(...ys), by2 = Math.max(...ys);
  const bw = bx2 - bx1, bh = by2 - by1;
  if (bw < 0.001 || bh < 0.001) return null;
  const zoom = Math.min((cw * (1 - BBOX_PAD)) / (bw * baseImgW), (ch * (1 - BBOX_PAD)) / (bh * baseImgH), 8);
  const bcx = (bx1 + bx2) / 2 * baseImgW * zoom;
  const bcy = (by1 + by2) / 2 * baseImgH * zoom;
  const panX = cw / 2 - bcx - (cw - baseImgW * zoom) / 2;
  const panY = ch / 2 - bcy - (ch - baseImgH * zoom) / 2;
  return { zoom, pan: { x: panX, y: panY } };
}

function BBoxEditor({ imageUrl, bbox, setBbox, rotation, viewMode, grayIntensity }: BBoxEditorProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [baseLayout, setBaseLayout] = useState({ imgW: 0, imgH: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState<Point>({ x: 0, y: 0 });
  const bboxSnappedRef  = useRef(false);

  const [dragging,      setDragging]      = useState(-1);
  const [draggingSide,  setDraggingSide]  = useState(-1);
  const [dragStart,     setDragStart]     = useState<Point | null>(null);
  const [initBbox,      setInitBbox]      = useState<Point[] | null>(null);
  const [panning,       setPanning]       = useState(false);
  const [panStart,      setPanStart]      = useState<Point | null>(null);
  const [panStartOff,   setPanStartOff]   = useState<Point>({ x: 0, y: 0 });

  const calcBase = useCallback(() => {
    const el = containerRef.current;
    if (!el || !imgNatural.w) return;
    const scale = Math.min(el.clientWidth / imgNatural.w, el.clientHeight / imgNatural.h);
    setBaseLayout({ imgW: imgNatural.w * scale, imgH: imgNatural.h * scale });
  }, [imgNatural]);

  useEffect(() => {
    calcBase();
    const obs = new ResizeObserver(calcBase);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [calcBase]);

  const snapToBbox = useCallback((b: Point[]) => {
    const el = containerRef.current;
    if (!el || !baseLayout.imgW) return;
    const r = bboxToView(b, baseLayout.imgW, baseLayout.imgH, el.clientWidth, el.clientHeight);
    if (r) { setZoom(r.zoom); setPan(r.pan); }
  }, [baseLayout]);

  useEffect(() => { if (baseLayout.imgW) snapToBbox(bbox); }, [baseLayout]); // eslint-disable-line
  useEffect(() => {
    if (!baseLayout.imgW) return;
    const isDef = bbox.every((p, i) => p.x === DEFAULT_META.bbox[i].x && p.y === DEFAULT_META.bbox[i].y);
    if (!isDef && !bboxSnappedRef.current) { bboxSnappedRef.current = true; snapToBbox(bbox); }
  }, [bbox, baseLayout, snapToBbox]);
  useEffect(() => { bboxSnappedRef.current = false; setZoom(1); setPan({ x: 0, y: 0 }); }, [imageUrl]);

  const cw    = containerRef.current?.clientWidth  ?? 0;
  const ch    = containerRef.current?.clientHeight ?? 0;
  const eImgW = baseLayout.imgW * zoom;
  const eImgH = baseLayout.imgH * zoom;
  const eImgX = (cw - eImgW) / 2 + pan.x;
  const eImgY = (ch - eImgH) / 2 + pan.y;
  const spx   = (nx: number) => eImgX + nx * eImgW;
  const spy   = (ny: number) => eImgY + ny * eImgH;

  const clientToNorm = useCallback((cx: number, cy: number): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: clamp((cx - rect.left - eImgX) / eImgW), y: clamp((cy - rect.top - eImgY) / eImgH) };
  }, [eImgX, eImgY, eImgW, eImgH]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !baseLayout.imgW) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setZoom(prevZ => {
      const nextZ = clampZoom(prevZ * factor);
      const prevX = (rect.width  - baseLayout.imgW * prevZ) / 2 + pan.x;
      const prevY = (rect.height - baseLayout.imgH * prevZ) / 2 + pan.y;
      const nextX = mx - ((mx - prevX) / (baseLayout.imgW * prevZ)) * baseLayout.imgW * nextZ;
      const nextY = my - ((my - prevY) / (baseLayout.imgH * prevZ)) * baseLayout.imgH * nextZ;
      setPan({ x: nextX - (rect.width - baseLayout.imgW * nextZ) / 2, y: nextY - (rect.height - baseLayout.imgH * nextZ) / 2 });
      return nextZ;
    });
  }, [baseLayout, pan]);

  const handleMove = useCallback((cx: number, cy: number) => {
    if (panning && panStart) { setPan({ x: panStartOff.x + cx - panStart.x, y: panStartOff.y + cy - panStart.y }); return; }
    if (dragging < 0 && draggingSide < 0) return;
    const pos = clientToNorm(cx, cy);
    const EDGE = 60, SPD = 8;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const lx = cx - rect.left, ly = cy - rect.top;
      let dx = 0, dy = 0;
      if (lx < EDGE) dx = SPD * (1 - lx / EDGE);
      if (lx > rect.width  - EDGE) dx = -SPD * (1 - (rect.width  - lx) / EDGE);
      if (ly < EDGE) dy = SPD * (1 - ly / EDGE);
      if (ly > rect.height - EDGE) dy = -SPD * (1 - (rect.height - ly) / EDGE);
      if (dx || dy) setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
    if (dragging >= 0) {
      const next = [...bbox]; next[dragging] = pos; setBbox(next);
    } else if (draggingSide >= 0 && dragStart && initBbox) {
      const dx2 = pos.x - dragStart.x, dy2 = pos.y - dragStart.y;
      const next = [...initBbox];
      const p1 = draggingSide, p2 = (draggingSide + 1) % 4;
      next[p1] = { x: clamp(initBbox[p1].x + dx2), y: clamp(initBbox[p1].y + dy2) };
      next[p2] = { x: clamp(initBbox[p2].x + dx2), y: clamp(initBbox[p2].y + dy2) };
      setBbox(next);
    }
  }, [panning, panStart, panStartOff, dragging, draggingSide, dragStart, initBbox, bbox, setBbox, clientToNorm]);

  const handleUp = useCallback(() => {
    setPanning(false); setPanStart(null);
    setDragging(-1); setDraggingSide(-1); setDragStart(null); setInitBbox(null);
  }, []);

  useEffect(() => {
    const mm = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => { if (panning || dragging >= 0 || draggingSide >= 0) { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); } };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', tm, { passive: false }); window.addEventListener('touchend', handleUp);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', handleUp); };
  }, [handleMove, handleUp, panning, dragging, draggingSide]);

  // ── Gray/BW preview (debounced 120ms) ────────────────────────────────────
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgNatural.w || viewMode === 'crop') {
      if (canvas) { const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, canvas.width, canvas.height); }
      return;
    }

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      if (typeof cv === 'undefined' || !cv.Mat) {
        console.warn('[RREditModal] OpenCV not ready yet');
        return;
      }
      try {
        const meta: ImageMeta = { bbox, grayIntensity };
        const { jpgBlob } = await processImage(imageUrl, meta, rotation, viewMode);

        const bitmapUrl = URL.createObjectURL(jpgBlob);
        const processed = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = bitmapUrl;
        });

        const el = containerRef.current;
        if (!el) { URL.revokeObjectURL(bitmapUrl); return; }
        canvas.width  = el.clientWidth;
        canvas.height = el.clientHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const scale = Math.min(canvas.width / processed.naturalWidth, canvas.height / processed.naturalHeight);
        const dw2 = processed.naturalWidth  * scale;
        const dh2 = processed.naturalHeight * scale;
        ctx.drawImage(processed, (canvas.width - dw2) / 2, (canvas.height - dh2) / 2, dw2, dh2);
        URL.revokeObjectURL(bitmapUrl);
      } catch (err) { console.error('[RREditModal] preview failed:', err); }
    }, 120);

    return () => { if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current); };
  }, [viewMode, grayIntensity, bbox, rotation, eImgX, eImgY, eImgW, eImgH, imageUrl, imgNatural.w]); // eslint-disable-line

  const loaded = imgNatural.w > 0 && baseLayout.imgW > 0;
  const pts    = bbox.map(p => `${spx(p.x)},${spy(p.y)}`).join(' ');

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onMouseDown={e => { if ((e.target as HTMLElement).dataset.handle) return; setPanning(true); setPanStart({ x: e.clientX, y: e.clientY }); setPanStartOff({ ...pan }); }}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', overflow: 'hidden', cursor: panning ? 'grabbing' : 'default', background: '#0f172a' }}
    >
      <img src={imageUrl} alt="" draggable={false}
        onLoad={e => { const i = e.currentTarget; setImgNatural({ w: i.naturalWidth, h: i.naturalHeight }); }}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />

      {loaded && (
        <>
          <img src={imageUrl} alt="" draggable={false}
            style={{ position: 'absolute', left: eImgX, top: eImgY, width: eImgW, height: eImgH, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center', userSelect: 'none', pointerEvents: 'none', opacity: 0.35, display: viewMode === 'crop' ? 'block' : 'none' }}
          />
          <img src={imageUrl} alt="" draggable={false}
            style={{ position: 'absolute', left: eImgX, top: eImgY, width: eImgW, height: eImgH, transform: `rotate(${rotation}deg)`, transformOrigin: 'center center', userSelect: 'none', pointerEvents: 'none', clipPath: `polygon(${bbox.map(p => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`).join(', ')})`, zIndex: 1, display: viewMode === 'crop' ? 'block' : 'none' }}
          />
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', display: viewMode !== 'crop' ? 'block' : 'none' }} />

          {viewMode === 'crop' && (
            <>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}>
                <polygon points={pts} fill="none" stroke="#00e5ff" strokeWidth="1.5" opacity="0.9" />
                <polygon points={pts} fill="none" stroke="#00e5ff" strokeWidth="6"   opacity="0.07" />
                {bbox.map((p, i) => {
                  const next = bbox[(i + 1) % 4], prev = bbox[(i + 3) % 4];
                  const ex = spx(next.x) - spx(p.x), ey = spy(next.y) - spy(p.y);
                  const px2 = spx(prev.x) - spx(p.x), py2 = spy(prev.y) - spy(p.y);
                  const ln  = Math.hypot(ex, ey) || 1, ln2 = Math.hypot(px2, py2) || 1;
                  const T = 22;
                  return (
                    <g key={`brk-${i}`}>
                      <line x1={spx(p.x)} y1={spy(p.y)} x2={spx(p.x)+ex/ln*T}   y2={spy(p.y)+ey/ln*T}   stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1={spx(p.x)} y1={spy(p.y)} x2={spx(p.x)+px2/ln2*T} y2={spy(p.y)+py2/ln2*T} stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" />
                    </g>
                  );
                })}
              </svg>

              {bbox.map((p1, i) => {
                const p2 = bbox[(i+1)%4], mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
                return (
                  <div key={`side-${i}`} data-handle="1"
                    onMouseDown={e => { e.stopPropagation(); setDraggingSide(i); setDragStart(clientToNorm(e.clientX, e.clientY)); setInitBbox([...bbox]); }}
                    onTouchStart={e => { setDraggingSide(i); setDragStart(clientToNorm(e.touches[0].clientX, e.touches[0].clientY)); setInitBbox([...bbox]); }}
                    style={{ position: 'absolute', zIndex: 9, left: spx(mx)-12, top: spy(my)-12, width: 24, height: 24, borderRadius: '50%', background: draggingSide===i ? 'rgba(251,191,36,0.3)' : 'rgba(0,229,255,0.06)', border: `1.5px dashed ${draggingSide===i?'#fbbf24':'#00e5ff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: i%2===0?'ns-resize':'ew-resize' }}
                  >
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: draggingSide===i?'#fbbf24':'#00e5ff' }} />
                  </div>
                );
              })}

              {bbox.map((p, i) => (
                <div key={`corner-${i}`} data-handle="1"
                  onMouseDown={e => { e.stopPropagation(); setDragging(i); }}
                  onTouchStart={() => setDragging(i)}
                  style={{ position: 'absolute', zIndex: 10, touchAction: 'none', left: spx(p.x)-20, top: spy(p.y)-20, width: 40, height: 40, borderRadius: '50%', background: dragging===i?'rgba(251,191,36,0.18)':'rgba(0,0,0,0.25)', border: `2px solid ${dragging===i?'#fbbf24':'#00e5ff'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair', boxShadow: `0 0 0 3px ${dragging===i?'rgba(251,191,36,0.15)':'rgba(0,229,255,0.1)'}` }}
                >
                  <div style={{ position: 'absolute', width: '45%', height: 1, background: dragging===i?'#fbbf24':'#00e5ff', opacity: 0.7 }} />
                  <div style={{ position: 'absolute', height: '45%', width: 1, background: dragging===i?'#fbbf24':'#00e5ff', opacity: 0.7 }} />
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: dragging===i?'#fbbf24':'#00e5ff', border: '1px solid rgba(0,0,0,0.5)' }} />
                </div>
              ))}
            </>
          )}

          <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([
              { icon: 'add',       fn: () => setZoom(z => clampZoom(z * 1.3)), title: 'Zoom in' },
              { icon: 'remove',    fn: () => setZoom(z => clampZoom(z / 1.3)), title: 'Zoom out' },
              { icon: 'crop_free', fn: () => snapToBbox(bbox),                 title: 'Fit selection' },
            ] as const).map(b => (
              <button key={b.icon} onClick={b.fn} title={b.title} data-handle="1"
                style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15, userSelect: 'none' }}>{b.icon}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bank-spec image encoders
// ─────────────────────────────────────────────────────────────────────────────

function patchJpegDpi(buffer: ArrayBuffer, dpi: number): ArrayBuffer {
  const arr = new Uint8Array(buffer.slice(0));
  if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF && arr[3] === 0xE0) {
    arr[11] = 1;
    arr[12] = (dpi >> 8) & 0xFF; arr[13] = dpi & 0xFF;
    arr[14] = (dpi >> 8) & 0xFF; arr[15] = dpi & 0xFF;
  }
  return arr.buffer;
}

function encodeBitonalTIFF(packed: Uint8Array, width: number, height: number, _rowBytes: number): ArrayBuffer {
  const entries: [number, number, number, number][] = [
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 1, 1],
    [259, 3, 1, 1],
    [262, 3, 1, 0],
    [266, 3, 1, 1],
    [273, 4, 1, 0],
    [277, 3, 1, 1],
    [278, 4, 1, height],
    [279, 4, 1, packed.length],
    [282, 5, 1, 0],
    [283, 5, 1, 0],
    [296, 3, 1, 2],
  ];

  const HEADER       = 8;
  const IFD_SIZE     = 2 + entries.length * 12 + 4;
  const RATIONAL_OFF = HEADER + IFD_SIZE;
  const DATA_OFF     = RATIONAL_OFF + 16;

  entries[6][3]  = DATA_OFF;
  entries[10][3] = RATIONAL_OFF;
  entries[11][3] = RATIONAL_OFF + 8;

  const buf = new ArrayBuffer(DATA_OFF + packed.length);
  const dv  = new DataView(buf);
  const LE  = true;

  dv.setUint16(0, 0x4949, LE);
  dv.setUint16(2, 42,     LE);
  dv.setUint32(4, HEADER, LE);

  let pos = HEADER;
  dv.setUint16(pos, entries.length, LE); pos += 2;

  for (const [tag, type, count, value] of entries) {
    dv.setUint16(pos,     tag,   LE);
    dv.setUint16(pos + 2, type,  LE);
    dv.setUint32(pos + 4, count, LE);
    if (type === 3)      { dv.setUint16(pos + 8, value, LE); dv.setUint16(pos + 10, 0, LE); }
    else if (type === 5) { dv.setUint32(pos + 8, value, LE); }
    else                 { dv.setUint32(pos + 8, value, LE); }
    pos += 12;
  }
  dv.setUint32(pos, 0, LE);

  dv.setUint32(RATIONAL_OFF,      200, LE);
  dv.setUint32(RATIONAL_OFF + 4,    1, LE);
  dv.setUint32(RATIONAL_OFF + 8,  200, LE);
  dv.setUint32(RATIONAL_OFF + 12,   1, LE);

  new Uint8Array(buf).set(packed, DATA_OFF);
  return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export { parseMeta, buildMeta };
function clamp(v: number)     { return Math.max(0, Math.min(1, v)); }
function clampZoom(v: number) { return Math.max(0.3, Math.min(10, v)); }
