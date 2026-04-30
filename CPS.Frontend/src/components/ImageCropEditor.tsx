// =============================================================================
// File        : ImageCropEditor.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Full image perspective editor with jscanify auto-detection
// Created     : 2026-04-20
// Updated     : 2026-04-28
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../store/toastStore';

declare const cv: any;

const tf = (window as any).tf;
const tflite = (window as any).tflite;
if (tflite) tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/');

const MODEL_SIZE = 640;
const NUM_COEFFS = 32;

const classNames = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'Document', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];

interface Point { x: number; y: number; }
interface Detection {
  id: number;
  bbox: [number, number, number, number];
  bboxModel: [number, number, number, number];
  class: number;
  className: string;
  score: number;
  coeffs: number[];
}

interface ImageCropEditorProps {
  file: File;
  title: string;
  onClose: () => void;
  /** processed = grayscale TIFF; originalFile is the raw capture (cheque only); corners = BBox */
  onSave: (file: File, previewUrl: string, originalFile?: File, corners?: Point[]) => void;
  mode?: 'desktop' | 'mobile';
  initialCropFull?: boolean;
  /** true for cheque: onSave also receives the untouched original capture */
  saveOriginal?: boolean;
  /** true for slips: skip grayscale/TIFF and save as high-quality JPG */
  isSlip?: boolean;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

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
  const [draggingSide, setDraggingSide] = useState<number>(-1);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [initialCorners, setInitialCorners] = useState<Point[] | null>(null);

  const lastTapRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number, y: number } | null>(null);
  const wasDraggingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<any>(null);

  const [detections, setDetections] = useState<Detection[]>([]);
  const [protosData, setProtosData] = useState<Float32Array | null>(null);
  const [protosShape, setProtosShape] = useState<number[] | null>(null);
  const [selectedDetId, setSelectedDetId] = useState<number | null>(null);

  const [detectRun, setDetectRun] = useState(false);
  const [detecting, setDetecting] = useState(false);

  // Model init
  useEffect(() => {
    const loadModel = async () => {
      if (!tflite) return;
      try {
        const fileName = 'yolo26n-seg_float16.tflite';
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
  }, []);

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

    let isActive = true;

    const runDetect = async () => {
      try {
        if (isActive) setDetecting(true);
        console.log('[AI] Starting inference for:', imgUrl);
        
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

        if (!isActive) {
          Object.values(preds).forEach((t: any) => t?.dispose?.());
          return;
        }

        // ── Parse Detections ──
        const allOut = preds instanceof tf.Tensor ? { out: preds } : preds;
        let detTensor: any = null;
        let protoTensor: any = null;

        for (const k of Object.keys(allOut)) {
          const t = allOut[k];
          const s = t.shape ?? t.dims;
          if (s && s.length === 3) detTensor = t;
          if (s && s.length === 4) protoTensor = t;
        }

        // Fallback for some TFLite environments
        if (!protoTensor && Object.values(allOut).length > 1) {
          protoTensor = Object.values(allOut).find((t: any) => (t.shape || t.dims)?.length === 4);
        }

        if (!detTensor) throw new Error('Detection tensor missing');

        const shape = detTensor.shape ?? detTensor.dims;
        const raw = detTensor.dataSync();
        const N = shape[1], C = shape[2];
        const at = (n: number, c: number) => raw[n * C + c];

        const dets: Detection[] = [];
        for (let i = 0; i < N; i++) {
          const score = at(i, 4);
          if (score < 0.1) continue; // Lowered to be extremely sensitive

          let mx1 = at(i, 0), my1 = at(i, 1), mx2 = at(i, 2), my2 = at(i, 3);
          if (mx1 <= 1) { mx1 *= MODEL_SIZE; my1 *= MODEL_SIZE; mx2 *= MODEL_SIZE; my2 *= MODEL_SIZE; }

          const classId = Math.round(at(i, 5));
          const coeffs = [];
          for (let c = 6; c < 6 + NUM_COEFFS; c++) coeffs.push(at(i,c));

          const ix1 = Math.max(0, (mx1 - padW) / scale);
          const iy1 = Math.max(0, (my1 - padH) / scale);
          const ix2 = Math.min(w, (mx2 - padW) / scale);
          const iy2 = Math.min(h, (my2 - padH) / scale);

          dets.push({
            id: i,
            bbox: [ix1, iy1, ix2, iy2],
            bboxModel: [mx1, my1, mx2, my2],
            class: classId,
            className: classNames[classId] || 'Item',
            score,
            coeffs
          });
        }

        if (isActive) {
          setDetections(dets);
          
          if (dets.length > 0) {
            const summary = dets.map(d => `${d.className} (${Math.round(d.score * 100)}%)`).join(', ');
            console.log(`[AI] Found ${dets.length} objects: ${summary}`);
          } else {
            console.log('[AI] No objects detected in this image.');
          }

          if (protoTensor) {
            setProtosData(protoTensor.dataSync ? protoTensor.dataSync() : protoTensor.data);
            setProtosShape(protoTensor.shape ?? protoTensor.dims);
          }

          const priorityMap: Record<string, number> = {
            'Document': 10, 'book': 9, 'remote': 8, 'tv': 7, 'laptop': 6, 'mouse': 5, 'cell phone': 4, 'person': 3, 'chair': 2
          };

          const candidates = dets
            .filter(d => priorityMap[d.className] !== undefined && d.score > 0.1)
            .sort((a, b) => (priorityMap[b.className] || 0) - (priorityMap[a.className] || 0));

          const bestCandidate = candidates[0];
          if (bestCandidate) {
            console.log(`[AI] Auto-snapping to the best candidate: ${bestCandidate.className} (${Math.round(bestCandidate.score * 100)}%)`);
            setSelectedDetId(bestCandidate.id);
          } else {
            console.log('[AI] No suitable document-like object found for auto-snapping.');
          }
        }

        Object.values(preds).forEach((t: any) => t?.dispose?.());
      } catch (e) {
        if (isActive) console.warn('YOLO-seg failed', e);
      } finally {
        if (isActive) {
          setDetecting(false);
          setDetectRun(true);
        }
      }
    };

    runDetect();

    return () => {
      isActive = false;
    };
  }, [imgNatural.w, imgUrl, model, detectRun]);

  // Reset detection state when image changes
  useEffect(() => {
    console.log('[Editor] Image changed, resetting state');
    setDetectRun(false);
    setDetections([]);
    setSelectedDetId(null);
    setProtosData(null);
  }, [imgUrl]);

  // Corner extraction from mask
  useEffect(() => {
    if (selectedDetId === null || !imgNatural.w) return;
    
    const det = detections.find(d => d.id === selectedDetId);
    if (!det) return;

    // Safety fallback: If protos aren't ready yet, use BBox immediately
    if (!protosData || !protosShape) {
      console.log('[Editor] Protos not ready, using BBox fallback for handles');
      const [ix1, iy1, ix2, iy2] = det.bbox;
      setCorners([
        { x: ix1 / imgNatural.w, y: iy1 / imgNatural.h },
        { x: ix2 / imgNatural.w, y: iy1 / imgNatural.h },
        { x: ix2 / imgNatural.w, y: iy2 / imgNatural.h },
        { x: ix1 / imgNatural.w, y: iy2 / imgNatural.h }
      ]);
      return;
    }

    console.log('[Editor] Extracting corners for:', det.className, '(ID:', det.id, ')');

    try {
      const [mx1, my1, mx2, my2] = det.bboxModel;
      const pH = protosShape[1], pW = protosShape[2], pC = protosShape[3];
      const ratioW = pW / MODEL_SIZE, ratioH = pH / MODEL_SIZE;
      
      const cpx1 = Math.floor(mx1 * ratioW), cpy1 = Math.floor(my1 * ratioH);
      const cpx2 = Math.ceil(mx2 * ratioW),  cpy2 = Math.ceil(my2 * ratioH);
      const cw = cpx2 - cpx1, ch = cpy2 - cpy1;
      if (cw < 1 || ch < 1) return;
      
      // Generate mask for the bbox area
      const mask = new Uint8Array(ch * cw);
      for (let r = 0; r < ch; r++) {
        for (let c = 0; c < cw; c++) {
          let v = 0;
          const rowBase = (cpy1 + r) * pW * pC + (cpx1 + c) * pC;
          for (let k = 0; k < 32; k++) v += det.coeffs[k] * protosData[rowBase + k];
          mask[r * cw + c] = sigmoid(v) > 0.5 ? 255 : 0;
        }
      }

      // Find corners using OpenCV
      const cv = (window as any).cv;
      if (!cv || !cv.matFromArray) {
        console.warn('[Editor] OpenCV not loaded yet! Retrying in 500ms...');
        setTimeout(() => {
          setProtosData(prev => prev ? new Float32Array(prev) : null);
        }, 500);
        return;
      }

      const src = cv.matFromArray(ch, cw, cv.CV_8UC1, mask);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(src, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      if (contours.size() > 0) {
        let maxArea = 0, maxIdx = -1;
        for (let i = 0; i < contours.size(); i++) {
          const area = cv.contourArea(contours.get(i));
          if (area > maxArea) { maxArea = area; maxIdx = i; }
        }

        if (maxIdx !== -1) {
          const cnt = contours.get(maxIdx);
          const peri = cv.arcLength(cnt, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
          if (approx.rows === 4) {
            console.log('[Editor] Found 4 corners!');
            const pts: Point[] = [];
            const w = imgNatural.w, h = imgNatural.h;
            const scale = Math.min(MODEL_SIZE / w, MODEL_SIZE / h);
            const padW = (MODEL_SIZE - w * scale) / 2;
            const padH = (MODEL_SIZE - h * scale) / 2;
            const pH = protosShape[1], pW = protosShape[2];

            for (let i = 0; i < 4; i++) {
              const px = cpx1 + approx.data32S[i * 2];
              const py = cpy1 + approx.data32S[i * 2 + 1];
              
              const mx = (px / pW) * MODEL_SIZE;
              const my = (py / pH) * MODEL_SIZE;
              
              const ix = (mx - padW) / scale;
              const iy = (my - padH) / scale;

              pts.push({ x: ix / w, y: iy / h });
            }
            
            pts.sort((a, b) => a.y - b.y);
            const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
            const bot = pts.slice(2, 4).sort((a, b) => b.x - a.x);
            setCorners([top[0], top[1], bot[0], bot[1]]);
          } else {
            console.warn(`[Editor] approxPolyDP returned ${approx.rows} points. Falling back to BBox.`);
            const [ix1, iy1, ix2, iy2] = det.bbox;
            setCorners([
              { x: ix1 / imgNatural.w, y: iy1 / imgNatural.h },
              { x: ix2 / imgNatural.w, y: iy1 / imgNatural.h },
              { x: ix2 / imgNatural.w, y: iy2 / imgNatural.h },
              { x: ix1 / imgNatural.w, y: iy2 / imgNatural.h }
            ]);
          }
          approx.delete();
        }
        contours.delete();
        hierarchy.delete();
        src.delete();
      }
    } catch (e) {
      console.error('[Editor] Corner extraction failed', e);
    }
  }, [selectedDetId, protosData, protosShape, imgNatural.w, detections]);

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
    if (!containerRef.current) return { x: 0, y: 0, mx: 0, my: 0 };
    const r = containerRef.current.getBoundingClientRect();
    const lx = clientX - r.left - containerRect.imgX;
    const ly = clientY - r.top - containerRect.imgY;
    
    const nx = lx / containerRect.imgW;
    const ny = ly / containerRect.imgH;

    // Convert normalized image pos back to MODEL_SIZE space for detection matching
    const w = imgNatural.w, h = imgNatural.h;
    const scale = Math.min(MODEL_SIZE / w, MODEL_SIZE / h);
    const padW = (MODEL_SIZE - w * scale) / 2;
    const padH = (MODEL_SIZE - h * scale) / 2;

    const mx = nx * (scale * w) + padW;
    const my = ny * (scale * h) + padH;

    return { x: nx, y: ny, mx, my };
  }, [containerRect, imgNatural]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    // If we were just dragging a handle, don't snap
    if (wasDraggingRef.current || dragging >= 0 || draggingSide >= 0 || detections.length === 0) {
      wasDraggingRef.current = false;
      return;
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const pos = getCanvasPos(clientX, clientY);

    // Find best detection containing the click point (ALLOW ALL CLASSES)
    const matches = detections.filter(d => {
      const px = pos.x * imgNatural.w;
      const py = pos.y * imgNatural.h;
      return px >= d.bbox[0] && px <= d.bbox[2] && py >= d.bbox[1] && py <= d.bbox[3];
    });

    if (matches.length > 0) {
      const match = matches.sort((a, b) => {
        const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
        const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
        return areaA - areaB;
      })[0];
      
      setSelectedDetId(match.id);
      toast.info('Document selected');
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };
    const DOUBLE_TAP_DELAY = 500; // Increased to be more forgiving
    const MAX_DISTANCE = 30; // pixels
    
    const lastPos = lastTapPosRef.current;
    const dist = lastPos ? Math.sqrt(Math.pow(pos.x - lastPos.x, 2) + Math.pow(pos.y - lastPos.y, 2)) : Infinity;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY && dist < MAX_DISTANCE) {
      handleCanvasClick(e);
      lastTapRef.current = 0;
      lastTapPosRef.current = null;
    } else {
      lastTapRef.current = now;
      lastTapPosRef.current = pos;
    }
  };

  const onStart = (idx: number) => {
    setDragging(idx);
  };

  const onStartSide = (idx: number, clientX: number, clientY: number) => {
    setDraggingSide(idx);
    setDragStart(getCanvasPos(clientX, clientY));
    setInitialCorners([...corners]);
  };

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (dragging < 0 && draggingSide < 0) return;
    const pos = getCanvasPos(clientX, clientY);

    if (dragging >= 0) {
      setCorners(prev => {
        const next = [...prev];
        next[dragging] = { 
          x: Math.max(0, Math.min(1, pos.x)), 
          y: Math.max(0, Math.min(1, pos.y)) 
        };
        return next;
      });
    } else if (draggingSide >= 0 && dragStart && initialCorners) {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      
      setCorners(() => {
        const next = [...initialCorners];
        const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]];
        const [p1, p2] = pairs[draggingSide];
        
        next[p1] = { 
          x: Math.max(0, Math.min(1, initialCorners[p1].x + dx)), 
          y: Math.max(0, Math.min(1, initialCorners[p1].y + dy)) 
        };
        next[p2] = { 
          x: Math.max(0, Math.min(1, initialCorners[p2].x + dx)), 
          y: Math.max(0, Math.min(1, initialCorners[p2].y + dy)) 
        };
        return next;
      });
    }
  }, [dragging, draggingSide, dragStart, initialCorners, getCanvasPos]);

  const onEnd = () => {
    if (dragging >= 0 || draggingSide >= 0) {
      wasDraggingRef.current = true;
      // Small timeout to prevent the immediate click event from firing a snap
      setTimeout(() => { wasDraggingRef.current = false; }, 200);
    }
    setDragging(-1);
    setDraggingSide(-1);
    setDragStart(null);
    setInitialCorners(null);
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const mu = () => onEnd();
    const tm = (e: TouchEvent) => { 
      if (dragging >= 0 || draggingSide >= 0) { 
        e.preventDefault(); 
        onMove(e.touches[0].clientX, e.touches[0].clientY); 
      } 
    };
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

  const handleSave = () => {
    if (!imgUrl) return;
    setSaving(true);
    // Yield to browser so the "saving..." spinner renders before heavy CPU work begins
    setTimeout(async () => {
      let sp: any = null, dp: any = null, M: any = null, srcMat: any = null;
      let warpMat: any = null, grayMat: any = null, equalizedMat: any = null, finalMat: any = null;
      const cleanup = () => {
        [sp, dp, M, srcMat, warpMat, grayMat, equalizedMat, finalMat].forEach(m => { try { m?.delete(); } catch (_) {} });
        sp = dp = M = srcMat = warpMat = grayMat = equalizedMat = finalMat = null;
      };
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
          // Slips: save as high-quality JPEG (colour preserved)
          const canvas = document.createElement('canvas');
          cv.imshow(canvas, warpMat);
          cleanup(); // free mats before toBlob (async)
          canvas.toBlob((blob) => {
            if (blob) {
              const jpgFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
              const previewUrl = canvas.toDataURL('image/jpeg', 0.9);
              onSave(jpgFile, previewUrl);
            }
            setSaving(false);
          }, 'image/jpeg', 0.9);
          return; // toBlob is async — setSaving(false) called inside callback
        }

        // Cheques: High-Pass Background Removal (matches Python image_proce.py)
        grayMat = new cv.Mat();
        cv.cvtColor(warpMat, grayMat, cv.COLOR_RGBA2GRAY);

        // Downscale → blur → upscale for fast sigma-80 background estimation
        const BLUR_RES   = 300;
        const blurScale  = Math.min(1.0, BLUR_RES / Math.max(dw, dh));
        const bw         = Math.max(1, Math.round(dw * blurScale));
        const bh         = Math.max(1, Math.round(dh * blurScale));
        const sigmaSmall = Math.max(5, Math.round(80 * blurScale));

        const smallGray    = new cv.Mat();
        const blurSmallMat = new cv.Mat();
        cv.resize(grayMat, smallGray, new cv.Size(bw, bh), 0, 0, cv.INTER_AREA);
        cv.GaussianBlur(smallGray, blurSmallMat, new cv.Size(0, 0), sigmaSmall, sigmaSmall);
        equalizedMat = new cv.Mat();
        cv.resize(blurSmallMat, equalizedMat, new cv.Size(dw, dh), 0, 0, cv.INTER_LINEAR);
        smallGray.delete(); blurSmallMat.delete();

        // hp = clip(gray − bg + 220, 0, 255)
        const grayF  = new cv.Mat();
        const bgF    = new cv.Mat();
        const diffF  = new cv.Mat();
        const normU8 = new cv.Mat();
        const blurSm = new cv.Mat();
        grayMat.convertTo(grayF, cv.CV_32F);
        equalizedMat.convertTo(bgF, cv.CV_32F);
        cv.subtract(grayF, bgF, diffF);
        diffF.convertTo(normU8, cv.CV_8U, 1.0, 220);
        grayF.delete(); bgF.delete(); diffF.delete();

        // Unsharp mask
        cv.GaussianBlur(normU8, blurSm, new cv.Size(3, 3), 0, 0);
        finalMat = new cv.Mat();
        cv.addWeighted(normU8, 1.4, blurSm, -0.4, 0, finalMat);
        normU8.delete(); blurSm.delete();

        // Encode grayscale TIFF
        const w = finalMat.cols, h = finalMat.rows;
        const step = finalMat.step[0] as number;
        const pixels = new Uint8Array(w * h);
        for (let row = 0; row < h; row++)
          for (let col = 0; col < w; col++)
            pixels[row * w + col] = finalMat.data[row * step + col];

        const tiffFile = new File(
          [new Blob([encodeGrayscaleTIFF(pixels, w, h)], { type: 'image/tiff' })],
          `${baseName}.tif`, { type: 'image/tiff' }
        );

        // JPEG preview for inline display
        const previewCanvas = document.createElement('canvas');
        cv.imshow(previewCanvas, finalMat);
        const previewUrl = previewCanvas.toDataURL('image/jpeg', 0.88);

        // Original capture renamed with _O suffix
        const ext = file.name.substring(file.name.lastIndexOf('.'));
        const originalRenamed = new File([file], `${baseName}_O${ext}`, { type: file.type });

        cleanup(); // free all mats before calling onSave
        onSave(tiffFile, previewUrl, saveOriginal ? originalRenamed : undefined, corners);
      } catch (e) {
        console.error('ImageCropEditor save failed', e);
      } finally {
        cleanup(); // no-op if already cleaned; guards against error paths
        setSaving(false);
      }
    }, 0);
  };

  const isTouch = mode === 'mobile';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      overscrollBehaviorX: 'none',
      userSelect: 'none', // Prevent text selection while dragging
    }}>
      {/* -- Header -- */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', flexShrink: 0,
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={onClose} style={hdrBtn}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, userSelect: 'none' }}>close</span>
        </button>
        <span style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 15 }}>{title}</span>
        <div style={{ width: 36 }} />
      </div>

      {/* -- Editor Area -- */}
      <div 
        ref={containerRef} 
        onDoubleClick={!isTouch ? handleCanvasClick : undefined}
        onTouchStart={isTouch ? onTouchStart : undefined}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111', touchAction: 'none' }}
      >
        {imgUrl && (
          <img
            src={imgUrl}
            onLoad={e => {
              const img = e.currentTarget;
              setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            style={{
              position: 'absolute',
              left: containerRect.imgX,
              top: containerRect.imgY,
              width: containerRect.imgW,
              height: containerRect.imgH,
              objectFit: 'contain',
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

        {/* Midpoint Handles (Side dragging) */}
        {[0, 1, 2, 3].map(i => {
          const p1 = corners[i], p2 = corners[(i + 1) % 4];
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          return (
            <div
              key={`side-${i}`}
              onMouseDown={!isTouch ? (e) => onStartSide(i, e.clientX, e.clientY) : undefined}
              onTouchStart={isTouch ? (e) => onStartSide(i, e.touches[0].clientX, e.touches[0].clientY) : undefined}
              style={{
                position: 'absolute',
                left: containerRect.imgX + midX * containerRect.imgW - 15,
                top: containerRect.imgY + midY * containerRect.imgH - 15,
                width: 30, height: 30,
                borderRadius: '50%',
                background: draggingSide === i ? 'rgba(251, 191, 36, 0.4)' : 'rgba(0, 229, 255, 0.1)',
                border: '1px dashed #00e5ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: i % 2 === 0 ? 'ns-resize' : 'ew-resize', zIndex: 9
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00e5ff' }} />
            </div>
          );
        })}

        {/* Corner Handles */}
        {corners.map((p, i) => (
          <div
            key={i}
            onMouseDown={!isTouch ? () => onStart(i) : undefined}
            onTouchStart={isTouch ? () => onStart(i) : undefined}
            style={{
              position: 'absolute',
              left: containerRect.imgX + p.x * containerRect.imgW - 22,
              top: containerRect.imgY + p.y * containerRect.imgH - 22,
              width: 44, height: 44,
              borderRadius: '50%',
              background: dragging === i ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `2px solid ${dragging === i ? '#fbbf24' : '#00e5ff'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'move', zIndex: 10, touchAction: 'none'
            }}
          >
            {/* Target Crosshair */}
            <div style={{ position: 'absolute', width: '50%', height: 1, background: dragging === i ? '#fbbf24' : '#00e5ff', opacity: 0.5 }} />
            <div style={{ position: 'absolute', height: '50%', width: 1, background: dragging === i ? '#fbbf24' : '#00e5ff', opacity: 0.5 }} />
            {/* Center dot */}
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dragging === i ? '#fbbf24' : '#00e5ff', border: '1px solid #fff' }} />
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

