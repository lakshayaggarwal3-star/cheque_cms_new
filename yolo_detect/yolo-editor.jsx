import React, { useState, useRef, useEffect, useCallback } from 'react';

const tf = window.tf;
const tflite = window.tflite;
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

const sigmoid = x => 1 / (1 + Math.exp(-x));

export default function YOLOEditor() {
  const [model, setModel] = useState(null);
  const [image, setImage] = useState(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [detections, setDetections] = useState([]);
  const [protosData, setProtosData] = useState(null);
  const [protosShape, setProtosShape] = useState(null);
  const [selectedDetId, setSelectedDetId] = useState(null);
  const [corners, setCorners] = useState([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }]);
  
  const [containerRect, setContainerRect] = useState({ w: 0, h: 0, imgX: 0, imgY: 0, imgW: 0, imgH: 0 });
  const [dragging, setDragging] = useState(-1);
  const [draggingSide, setDraggingSide] = useState(-1);
  const [dragStart, setDragStart] = useState(null);
  const [initialCorners, setInitialCorners] = useState(null);
  const [logs, setLogs] = useState([]);

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef(null);
  const wasDraggingRef = useRef(false);

  const addLog = (msg) => {
    console.log(msg);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0, -1)}: ${msg}`]);
  };

  useEffect(() => {
    const loadModel = async () => {
      addLog('[App] Loading YOLO model...');
      try {
        const m = await tflite.loadTFLiteModel('./yolo26n-seg_float16.tflite');
        setModel(m);
        addLog('[App] Model loaded successfully');
      } catch (e) {
        addLog(`[App] Model load failed: ${e.message}`);
      }
    };
    loadModel();
  }, []);

  // Layout calculation
  const calcLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el || !imgNatural.w) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min(cw / imgNatural.w, ch / imgNatural.h);
    const imgW = imgNatural.w * scale;
    const imgH = imgNatural.h * scale;
    setContainerRect({ w: cw, h: ch, imgX: (cw - imgW) / 2, imgY: (ch - imgH) / 2, imgW, imgH });
    addLog(`[Layout] Updated layout: cw=${cw}, ch=${ch}, scale=${scale.toFixed(2)}, imgW=${imgW.toFixed(0)}, imgH=${imgH.toFixed(0)}`);
  }, [imgNatural]);

  useEffect(() => {
    calcLayout();
    window.addEventListener('resize', calcLayout);
    return () => window.removeEventListener('resize', calcLayout);
  }, [calcLayout]);

  // AI Inference
  useEffect(() => {
    if (!imgNatural.w || !model || !image) return;

    const runDetect = async () => {
      addLog('[AI] Starting inference...');
      const t0 = performance.now();
      
      const w = imgNatural.w, h = imgNatural.h;
      const scale = Math.min(MODEL_SIZE / w, MODEL_SIZE / h);
      const padW = (MODEL_SIZE - w * scale) / 2;
      const padH = (MODEL_SIZE - h * scale) / 2;

      const input = tf.tidy(() => {
        const tfImg = tf.browser.fromPixels(image);
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

      const allOut = preds instanceof tf.Tensor ? { out: preds } : preds;
      let detTensor = null, protoTensor = null;

      for (const k of Object.keys(allOut)) {
        const t = allOut[k];
        const s = t.shape ?? t.dims;
        if (s && s.length === 3) detTensor = t;
        if (s && s.length === 4) protoTensor = t;
      }
      
      // Fallback for some TFLite environments
      if (!protoTensor && Object.values(allOut).length > 1) {
        protoTensor = Object.values(allOut).find(t => (t.shape || t.dims)?.length === 4);
      }

      if (!detTensor) {
        addLog('[AI] Error: Detection tensor missing');
        return;
      }

      const shape = detTensor.shape ?? detTensor.dims;
      const raw = detTensor.dataSync();
      const N = shape[1], C = shape[2];
      const at = (n, c) => raw[n * C + c];

      const dets = [];
      for (let i = 0; i < N; i++) {
        const score = at(i, 4);
        if (score < 0.1) continue;

        let mx1 = at(i, 0), my1 = at(i, 1), mx2 = at(i, 2), my2 = at(i, 3);
        if (mx1 <= 1) { mx1 *= MODEL_SIZE; my1 *= MODEL_SIZE; mx2 *= MODEL_SIZE; my2 *= MODEL_SIZE; }

        const classId = Math.round(at(i, 5));
        const coeffs = [];
        for (let c = 6; c < 6 + NUM_COEFFS; c++) coeffs.push(at(i, c));

        const ix1 = Math.max(0, (mx1 - padW) / scale);
        const iy1 = Math.max(0, (my1 - padH) / scale);
        const ix2 = Math.min(w, (mx2 - padW) / scale);
        const iy2 = Math.min(h, (my2 - padH) / scale);

        dets.push({
          id: i, bbox: [ix1, iy1, ix2, iy2], bboxModel: [mx1, my1, mx2, my2],
          class: classId, className: classNames[classId] || 'Item', score, coeffs
        });
      }

      setDetections(dets);
      addLog(`[AI] Found ${dets.length} objects in ${(performance.now() - t0).toFixed(1)}ms`);

      if (protoTensor) {
        setProtosData(protoTensor.dataSync ? protoTensor.dataSync() : protoTensor.data);
        setProtosShape(protoTensor.shape ?? protoTensor.dims);
      } else {
        addLog('[AI] Warning: protoTensor not found, mask generation will fail.');
      }

      const priorityMap = { 'Document': 10, 'book': 9, 'remote': 8, 'tv': 7, 'laptop': 6, 'cell phone': 5, 'person': 3 };
      const candidates = dets
        .filter(d => priorityMap[d.className] !== undefined && d.score > 0.1)
        .sort((a, b) => (priorityMap[b.className] || 0) - (priorityMap[a.className] || 0));

      if (candidates.length > 0) {
        addLog(`[AI] Auto-snapping to: ${candidates[0].className} (${(candidates[0].score * 100).toFixed(1)}%)`);
        setSelectedDetId(candidates[0].id);
      } else {
        addLog('[AI] No suitable auto-snap candidate found.');
      }

      Object.values(preds).forEach(t => t.dispose());
    };

    runDetect();
  }, [imgNatural.w, image, model]);

  // Corner Extraction
  useEffect(() => {
    if (selectedDetId === null || !imgNatural.w || !protosData) {
      if (selectedDetId !== null && !protosData) {
        addLog(`[CornerExt] Cannot extract: missing protosData for detId ${selectedDetId}`);
      }
      return;
    }

    const det = detections.find(d => d.id === selectedDetId);
    if (!det) return;

    addLog(`[CornerExt] Extracting corners for: ${det.className} (ID: ${det.id})`);

    try {
      const [mx1, my1, mx2, my2] = det.bboxModel;
      const pH = protosShape[1], pW = protosShape[2], pC = protosShape[3];
      const ratioW = pW / MODEL_SIZE, ratioH = pH / MODEL_SIZE;
      
      const cpx1 = Math.floor(mx1 * ratioW), cpy1 = Math.floor(my1 * ratioH);
      const cpx2 = Math.ceil(mx2 * ratioW),  cpy2 = Math.ceil(my2 * ratioH);
      const cw = cpx2 - cpx1, ch = cpy2 - cpy1;
      
      if (cw < 1 || ch < 1) {
        addLog('[CornerExt] Invalid crop dimensions');
        return;
      }
      
      const mask = new Uint8Array(ch * cw);
      for (let r = 0; r < ch; r++) {
        for (let c = 0; c < cw; c++) {
          let v = 0;
          const rowBase = (cpy1 + r) * pW * pC + (cpx1 + c) * pC;
          for (let k = 0; k < 32; k++) v += det.coeffs[k] * protosData[rowBase + k];
          mask[r * cw + c] = sigmoid(v) > 0.5 ? 255 : 0;
        }
      }

      const cv = window.cv;
      if (!cv || !cv.matFromArray) {
        addLog('[CornerExt] OpenCV not loaded yet! Retrying in 500ms...');
        setTimeout(() => {
          // Re-trigger the effect by updating a dummy state or just calling it
          setProtosData(prev => new Float32Array(prev)); 
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
            addLog(`[CornerExt] Found 4 extreme corners!`);
            const pts = [];
            const w = imgNatural.w, h = imgNatural.h;
            const scale = Math.min(MODEL_SIZE / w, MODEL_SIZE / h);
            const padW = (MODEL_SIZE - w * scale) / 2;
            const padH = (MODEL_SIZE - h * scale) / 2;

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
            addLog(`[CornerExt] approxPolyDP returned ${approx.rows} points. Falling back to bounding box.`);
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
      } else {
        addLog('[CornerExt] No contours found');
      }
    } catch (e) {
      addLog(`[CornerExt] Exception: ${e.message}`);
    }
  }, [selectedDetId, protosData, protosShape, imgNatural.w, detections]);

  // Canvas drawing
  useEffect(() => {
    if (!image || !containerRect.w || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = containerRect.imgW;
    canvas.height = containerRect.imgH;
    
    // Draw Image
    ctx.drawImage(image, 0, 0, containerRect.imgW, containerRect.imgH);

    // Draw Mask if available
    if (selectedDetId !== null && protosData && protosShape) {
       const det = detections.find(d => d.id === selectedDetId);
       if (det) {
         try {
           const [mx1, my1, mx2, my2] = det.bboxModel;
           const pH = protosShape[1], pW = protosShape[2], pC = protosShape[3];
           const ratioW = pW / MODEL_SIZE, ratioH = pH / MODEL_SIZE;
           const cpx1 = Math.floor(mx1 * ratioW), cpy1 = Math.floor(my1 * ratioH);
           const cpx2 = Math.ceil(mx2 * ratioW),  cpy2 = Math.ceil(my2 * ratioH);
           const cw = cpx2 - cpx1, ch = cpy2 - cpy1;
           
           if (cw >= 1 && ch >= 1) {
             const outW = Math.round(det.bbox[2] - det.bbox[0]) * (containerRect.imgW / imgNatural.w);
             const outH = Math.round(det.bbox[3] - det.bbox[1]) * (containerRect.imgH / imgNatural.h);
             const imgData = new ImageData(outW, outH);
             
             for (let r = 0; r < outH; r++) {
               const sy = Math.floor(r * (ch - 1) / outH);
               for (let c = 0; c < outW; c++) {
                 const sx = Math.floor(c * (cw - 1) / outW);
                 let v = 0;
                 const rowBase = (cpy1 + sy) * pW * pC + (cpx1 + sx) * pC;
                 for (let k = 0; k < 32; k++) v += det.coeffs[k] * protosData[rowBase + k];
                 if (sigmoid(v) > 0.5) {
                   const p = (r * outW + c) * 4;
                   imgData.data[p] = 0; imgData.data[p+1] = 255; imgData.data[p+2] = 0; imgData.data[p+3] = 100;
                 }
               }
             }
             
             const tmp = document.createElement('canvas'); tmp.width = outW; tmp.height = outH;
             tmp.getContext('2d').putImageData(imgData, 0, 0);
             const dx = det.bbox[0] * (containerRect.imgW / imgNatural.w);
             const dy = det.bbox[1] * (containerRect.imgH / imgNatural.h);
             ctx.drawImage(tmp, dx, dy);
           }
         } catch (e) {
           addLog(`[Draw] Mask draw failed: ${e.message}`);
         }
       }
    }

    // Draw Corners & Edges
    const pts = corners.map(p => ({ x: p.x * containerRect.imgW, y: p.y * containerRect.imgH }));
    
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.fill();
    
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.stroke();

    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#00FF00';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

  }, [image, containerRect, corners, selectedDetId, protosData, protosShape, detections]);

  const getCanvasPos = useCallback((clientX, clientY) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    const lx = clientX - r.left - containerRect.imgX;
    const ly = clientY - r.top - containerRect.imgY;
    return { x: lx / containerRect.imgW, y: ly / containerRect.imgH };
  }, [containerRect]);

  const handleCanvasClick = (e) => {
    if (wasDraggingRef.current || dragging >= 0 || draggingSide >= 0 || detections.length === 0) {
      wasDraggingRef.current = false;
      addLog('[Interaction] Click ignored due to drag state');
      return;
    }
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getCanvasPos(clientX, clientY);

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
      
      addLog(`[Interaction] Double-click/tap selected: ${match.className} (${(match.score * 100).toFixed(1)}%)`);
      setSelectedDetId(match.id);
    } else {
      addLog('[Interaction] Double-click/tap missed all detections');
    }
  };

  const onTouchStart = (e) => {
    const now = Date.now();
    const touch = e.touches[0];
    const pos = { x: touch.clientX, y: touch.clientY };
    const DOUBLE_TAP_DELAY = 500;
    const MAX_DISTANCE = 30;
    
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

  const onMouseClick = (e) => {
    const now = Date.now();
    const pos = { x: e.clientX, y: e.clientY };
    const DOUBLE_TAP_DELAY = 500;
    const MAX_DISTANCE = 30;
    
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

  const onStart = (idx) => setDragging(idx);
  const onStartSide = (idx, clientX, clientY) => {
    setDraggingSide(idx);
    setDragStart(getCanvasPos(clientX, clientY));
    setInitialCorners([...corners]);
  };

  const onMove = useCallback((clientX, clientY) => {
    if (dragging < 0 && draggingSide < 0) return;
    const pos = getCanvasPos(clientX, clientY);

    if (dragging >= 0) {
      setCorners(prev => {
        const next = [...prev];
        next[dragging] = { x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) };
        return next;
      });
    } else if (draggingSide >= 0 && dragStart && initialCorners) {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      setCorners(() => {
        const next = [...initialCorners];
        const pairs = [[0, 1], [1, 2], [2, 3], [3, 0]];
        const [p1, p2] = pairs[draggingSide];
        next[p1] = { x: Math.max(0, Math.min(1, initialCorners[p1].x + dx)), y: Math.max(0, Math.min(1, initialCorners[p1].y + dy)) };
        next[p2] = { x: Math.max(0, Math.min(1, initialCorners[p2].x + dx)), y: Math.max(0, Math.min(1, initialCorners[p2].y + dy)) };
        return next;
      });
    }
  }, [dragging, draggingSide, dragStart, initialCorners, getCanvasPos]);

  const onEnd = () => {
    if (dragging >= 0 || draggingSide >= 0) {
      wasDraggingRef.current = true;
      setTimeout(() => { wasDraggingRef.current = false; }, 200);
    }
    setDragging(-1);
    setDraggingSide(-1);
    setDragStart(null);
    setInitialCorners(null);
  };

  useEffect(() => {
    const mm = (e) => onMove(e.clientX, e.clientY);
    const mu = () => onEnd();
    const tm = (e) => { 
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
  }, [onMove, dragging, draggingSide]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    addLog(`[File] Uploading file: ${file.name}`);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      addLog(`[File] Image loaded: ${img.naturalWidth}x${img.naturalHeight}`);
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setImage(img);
      setDetections([]);
      setProtosData(null);
      setSelectedDetId(null);
    };
    img.src = url;
  };

  // Camera Logic
  const startCamera = async () => {
    setUseCamera(true);
    addLog('[Camera] Requesting camera access...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      addLog('[Camera] Camera started');
    } catch (e) {
      addLog(`[Camera] Error starting camera: ${e.message}`);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    addLog('[Camera] Capturing photo...');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const img = new Image();
    img.onload = () => {
      addLog(`[Camera] Photo captured: ${img.naturalWidth}x${img.naturalHeight}`);
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setImage(img);
      setDetections([]);
      setProtosData(null);
      setSelectedDetId(null);
      
      const stream = video.srcObject;
      if (stream) stream.getTracks().forEach(t => t.stop());
      setUseCamera(false);
    };
    img.src = canvas.toDataURL('image/jpeg');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#111', color: '#fff', fontFamily: 'sans-serif' }}>
      <header style={{ padding: 15, background: '#222', borderBottom: '1px solid #444', display: 'flex', alignItems: 'center', gap: 15 }}>
        <h2>YOLO Editor (Standalone)</h2>
        <a href="/" style={{ color: '#aaa' }}>Back</a>
        <input type="file" accept="image/*" onChange={handleUpload} style={{ marginLeft: 20 }} />
        <button onClick={startCamera}>Open Camera</button>
      </header>
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <main style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {useCamera ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', padding: '15px 30px', fontSize: 18, background: '#00f', color: '#fff', border: 'none', borderRadius: 8 }}>
                Capture
              </button>
            </div>
          ) : image ? (
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
              <canvas 
                ref={canvasRef} 
                style={{ 
                  position: 'absolute', left: containerRect.imgX, top: containerRect.imgY,
                  width: containerRect.imgW, height: containerRect.imgH,
                  touchAction: 'none'
                }} 
              />
              {/* Interaction Layer */}
              <div
                style={{
                  position: 'absolute', left: containerRect.imgX, top: containerRect.imgY,
                  width: containerRect.imgW, height: containerRect.imgH,
                  touchAction: 'none', cursor: 'crosshair'
                }}
                onTouchStart={onTouchStart}
                onClick={onMouseClick}
              >
                {/* SVG for Draggable Edges and Corners */}
                <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible', zIndex: 10 }}>
                  <line x1={`${corners[0].x*100}%`} y1={`${corners[0].y*100}%`} x2={`${corners[1].x*100}%`} y2={`${corners[1].y*100}%`} stroke="transparent" strokeWidth="20" onMouseDown={(e) => { e.stopPropagation(); onStartSide(0, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); onStartSide(0, e.touches[0].clientX, e.touches[0].clientY); }} style={{ cursor: 'pointer' }} />
                  <line x1={`${corners[1].x*100}%`} y1={`${corners[1].y*100}%`} x2={`${corners[2].x*100}%`} y2={`${corners[2].y*100}%`} stroke="transparent" strokeWidth="20" onMouseDown={(e) => { e.stopPropagation(); onStartSide(1, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); onStartSide(1, e.touches[0].clientX, e.touches[0].clientY); }} style={{ cursor: 'pointer' }} />
                  <line x1={`${corners[2].x*100}%`} y1={`${corners[2].y*100}%`} x2={`${corners[3].x*100}%`} y2={`${corners[3].y*100}%`} stroke="transparent" strokeWidth="20" onMouseDown={(e) => { e.stopPropagation(); onStartSide(2, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); onStartSide(2, e.touches[0].clientX, e.touches[0].clientY); }} style={{ cursor: 'pointer' }} />
                  <line x1={`${corners[3].x*100}%`} y1={`${corners[3].y*100}%`} x2={`${corners[0].x*100}%`} y2={`${corners[0].y*100}%`} stroke="transparent" strokeWidth="20" onMouseDown={(e) => { e.stopPropagation(); onStartSide(3, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); onStartSide(3, e.touches[0].clientX, e.touches[0].clientY); }} style={{ cursor: 'pointer' }} />
                  
                  {corners.map((p, i) => (
                    <circle key={i} cx={`${p.x*100}%`} cy={`${p.y*100}%`} r="15" fill="transparent"
                      onMouseDown={(e) => { e.stopPropagation(); onStart(i); }}
                      onTouchStart={(e) => { e.stopPropagation(); onStart(i); }}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </svg>
              </div>
            </div>
          ) : (
            <div style={{ color: '#888' }}>Upload an image or use the camera to start. Double click a detection to select it.</div>
          )}
        </main>

        <aside style={{ width: 350, borderLeft: '1px solid #444', background: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 10, background: '#2a2a2a', borderBottom: '1px solid #444', fontWeight: 'bold' }}>Detailed Logs</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, fontSize: 12, fontFamily: 'monospace', color: '#0f0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
