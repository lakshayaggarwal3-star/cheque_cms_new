// =============================================================================
// File        : ImageCropEditor.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Full image crop editor with draggable handles, grid, sliders
// Created     : 2026-04-20
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

interface Rect { x: number; y: number; w: number; h: number; }

type Handle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br' | 'move';

interface ImageCropEditorProps {
  file: File;
  title: string;
  onClose: () => void;
  onSave: (file: File, previewUrl: string) => void;
  /** 'desktop' uses mouse events; 'mobile' uses touch events */
  mode?: 'desktop' | 'mobile';
}

const MIN_SIZE = 40;

export function ImageCropEditor({ file, title, onClose, onSave, mode = 'desktop' }: ImageCropEditorProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [containerRect, setContainerRect] = useState({ w: 0, h: 0, imgX: 0, imgY: 0, imgW: 0, imgH: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }); // normalised 0-1 within img
  const [brightness, setBrightness] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; startCrop: Rect } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Compute how image is letterboxed inside container
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

  // Convert page position to normalised crop coordinates
  const toNorm = (pageX: number, pageY: number) => {
    const el = containerRef.current;
    if (!el) return { nx: 0, ny: 0 };
    const { left, top } = el.getBoundingClientRect();
    const lx = pageX - left - containerRect.imgX;
    const ly = pageY - top - containerRect.imgY;
    return { nx: lx / containerRect.imgW, ny: ly / containerRect.imgH };
  };

  const startDrag = (handle: Handle, clientX: number, clientY: number) => {
    dragRef.current = { handle, startX: clientX, startY: clientY, startCrop: { ...crop } };
  };

  const onDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragRef.current) return;
    const { handle, startX, startY, startCrop: sc } = dragRef.current;
    const dx = (clientX - startX) / containerRect.imgW;
    const dy = (clientY - startY) / containerRect.imgH;
    setCrop(prev => clampCrop(applyHandle(handle, sc, dx, dy), prev));
  }, [containerRect]);

  const endDrag = () => { dragRef.current = null; };

  // Mouse events
  const onMouseDown = (handle: Handle) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    startDrag(handle, e.clientX, e.clientY);
  };
  useEffect(() => {
    const mv = (e: MouseEvent) => onDrag(e.clientX, e.clientY);
    const up = () => endDrag();
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, [onDrag]);

  // Touch events
  const onTouchStart = (handle: Handle) => (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.touches[0];
    startDrag(handle, t.clientX, t.clientY);
  };
  useEffect(() => {
    const mv = (e: TouchEvent) => { if (dragRef.current) { e.preventDefault(); onDrag(e.touches[0].clientX, e.touches[0].clientY); } };
    const up = () => endDrag();
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('touchmove', mv); window.removeEventListener('touchend', up); };
  }, [onDrag]);

  const handleReset = () => {
    setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
    setBrightness(100); setGrayscale(0); setRotation(0);
  };

  const handleSave = async () => {
    if (!imgUrl) return;
    setSaving(true);
    try {
      const img = await loadImg(imgUrl);
      const canvas = document.createElement('canvas');
      const cropPxX = crop.x * img.naturalWidth;
      const cropPxY = crop.y * img.naturalHeight;
      const cropPxW = crop.w * img.naturalWidth;
      const cropPxH = crop.h * img.naturalHeight;
      canvas.width = Math.round(cropPxW);
      canvas.height = Math.round(cropPxH);
      const ctx = canvas.getContext('2d')!;
      ctx.filter = `brightness(${brightness}%) grayscale(${grayscale}%)`;
      if (rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }
      ctx.drawImage(img, cropPxX, cropPxY, cropPxW, cropPxH, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, file.type || 'image/jpeg', 0.92));
      if (!blob) throw new Error('Failed to export');
      const out = new File([blob], file.name, { type: blob.type });
      onSave(out, URL.createObjectURL(blob));
    } finally {
      setSaving(false);
    }
  };

  // Pixel positions of crop rect inside container
  const cx = containerRect.imgX + crop.x * containerRect.imgW;
  const cy = containerRect.imgY + crop.y * containerRect.imgH;
  const cw = crop.w * containerRect.imgW;
  const ch = crop.h * containerRect.imgH;

  if (!imgUrl) return null;

  const isTouch = mode === 'mobile';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <button onClick={onClose} style={hdrBtn}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
        </button>
        <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>{title}</span>
        <button onClick={handleReset} style={hdrBtn}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>restart_alt</span>
        </button>
      </div>

      {/* ── Crop canvas ── */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
        {/* Image */}
        <img
          src={imgUrl}
          alt="edit"
          draggable={false}
          style={{
            position: 'absolute',
            left: containerRect.imgX, top: containerRect.imgY,
            width: containerRect.imgW, height: containerRect.imgH,
            objectFit: 'fill',
            filter: `brightness(${brightness}%) grayscale(${grayscale}%)`,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
            pointerEvents: 'none', userSelect: 'none',
          }}
        />

        {/* Dark overlay — 4 pieces around crop rect */}
        <Shade l={0}              t={0}              w={cx}              h={containerRect.h} />
        <Shade l={cx + cw}        t={0}              w={containerRect.w - cx - cw} h={containerRect.h} />
        <Shade l={cx}             t={0}              w={cw}              h={cy} />
        <Shade l={cx}             t={cy + ch}        w={cw}              h={containerRect.h - cy - ch} />

        {/* Crop border */}
        <div style={{
          position: 'absolute', left: cx, top: cy, width: cw, height: ch,
          border: '1.5px solid rgba(255,255,255,0.85)',
          boxSizing: 'border-box', pointerEvents: 'none',
        }}>
          {/* Rule of thirds grid */}
          {[1/3, 2/3].map(f => (
            <div key={`v${f}`} style={{ position:'absolute', left:`${f*100}%`, top:0, bottom:0, width:1, background:'rgba(255,255,255,0.25)' }} />
          ))}
          {[1/3, 2/3].map(f => (
            <div key={`h${f}`} style={{ position:'absolute', top:`${f*100}%`, left:0, right:0, height:1, background:'rgba(255,255,255,0.25)' }} />
          ))}
        </div>

        {/* Move handle (center area) */}
        <div
          style={{ position:'absolute', left:cx+12, top:cy+12, width:cw-24, height:ch-24, cursor:'move' }}
          onMouseDown={!isTouch ? onMouseDown('move') : undefined}
          onTouchStart={isTouch ? onTouchStart('move') : undefined}
        />

        {/* Corner + edge handles */}
        {([
          ['tl', cx-6,       cy-6      ],
          ['tc', cx+cw/2-6,  cy-6      ],
          ['tr', cx+cw-6,    cy-6      ],
          ['ml', cx-6,       cy+ch/2-6 ],
          ['mr', cx+cw-6,    cy+ch/2-6 ],
          ['bl', cx-6,       cy+ch-6   ],
          ['bc', cx+cw/2-6,  cy+ch-6   ],
          ['br', cx+cw-6,    cy+ch-6   ],
        ] as [Handle, number, number][]).map(([h, lx, ly]) => (
          <div
            key={h}
            onMouseDown={!isTouch ? onMouseDown(h) : undefined}
            onTouchStart={isTouch ? onTouchStart(h) : undefined}
            style={{
              position: 'absolute', left: lx, top: ly, width: 14, height: 14,
              background: '#fff', border: '2px solid #3b82f6',
              borderRadius: 3, cursor: cursorFor(h), zIndex: 2,
              touchAction: 'none',
            }}
          />
        ))}
      </div>

      {/* ── Sliders ── */}
      <div style={{
        background: '#0f172a', padding: '14px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Slider label="Brightness" value={brightness} min={50} max={160} step={5} unit="%" onChange={setBrightness} />
          <Slider label="Grayscale"  value={grayscale}  min={0}  max={100} step={5} unit="%" onChange={setGrayscale}  />
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
          <button onClick={handleSave} disabled={saving} style={primaryBtn}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Shade({ l, t, w, h }: { l:number; t:number; w:number; h:number }) {
  if (w <= 0 || h <= 0) return null;
  return <div style={{ position:'absolute', left:l, top:t, width:w, height:h, background:'rgba(0,0,0,0.52)', pointerEvents:'none' }} />;
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#cbd5e1', fontVariantNumeric:'tabular-nums' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width:'100%', accentColor:'#3b82f6', cursor:'pointer' }} />
    </div>
  );
}

// ── Logic helpers ─────────────────────────────────────────────────────────────

function applyHandle(handle: Handle, sc: Rect, dx: number, dy: number): Rect {
  let { x, y, w, h } = sc;
  switch (handle) {
    case 'move': x += dx; y += dy; break;
    case 'tl':   x += dx; y += dy; w -= dx; h -= dy; break;
    case 'tc':              y += dy;          h -= dy; break;
    case 'tr':              y += dy; w += dx; h -= dy; break;
    case 'ml':   x += dx;           w -= dx;           break;
    case 'mr':                       w += dx;           break;
    case 'bl':   x += dx;           w -= dx; h += dy;  break;
    case 'bc':                                h += dy;  break;
    case 'br':                       w += dx; h += dy;  break;
  }
  return { x, y, w, h };
}

function clampCrop(next: Rect, _prev: Rect): Rect {
  let { x, y, w, h } = next;
  w = Math.max(MIN_SIZE / 300, w); // rough min
  h = Math.max(MIN_SIZE / 300, h);
  x = Math.max(0, Math.min(1 - w, x));
  y = Math.max(0, Math.min(1 - h, y));
  w = Math.min(1 - x, w);
  h = Math.min(1 - y, h);
  return { x, y, w, h };
}

function cursorFor(h: Handle): string {
  const map: Record<Handle, string> = {
    tl:'nwse-resize', tc:'ns-resize', tr:'nesw-resize',
    ml:'ew-resize',                   mr:'ew-resize',
    bl:'nesw-resize', bc:'ns-resize', br:'nwse-resize',
    move:'move',
  };
  return map[h];
}

async function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
}

// ── Style constants ───────────────────────────────────────────────────────────

const hdrBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8,
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#cbd5e1', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const outlineBtn: React.CSSProperties = {
  display:'flex', alignItems:'center', justifyContent:'center', gap:4,
  padding:'9px 4px', borderRadius:8,
  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)',
  color:'#e2e8f0', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
};

const primaryBtn: React.CSSProperties = {
  display:'flex', alignItems:'center', justifyContent:'center',
  padding:'9px 4px', borderRadius:8,
  background:'#3b82f6', border:'1px solid #2563eb',
  color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
};
