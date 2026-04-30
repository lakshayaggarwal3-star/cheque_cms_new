import React, { useState, useRef, useEffect } from 'react';

const tf     = window.tf;
const tflite = window.tflite;
if (tflite) tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/');

// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL_SIZE  = 640;
const NUM_CLASSES = 26;   // not used for parsing, class_id is directly in output
const NUM_COEFFS  = 32;
const classNames = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sigmoid = x => 1 / (1 + Math.exp(-x));

const hslToRgb = (h, s, l) => {
  const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
  const f=t=>{t=((t%1)+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
  return [f(h+1/3),f(h),f(h-1/3)].map(v=>Math.round(v*255));
};
const PALETTE = id => {
  const h=(id*137.508)%360/360;
  return {color:`hsl(${h*360},85%,55%)`,rgb:hslToRgb(h,0.85,0.55)};
};

const getLetterbox = (imgW,imgH) => {
  const scale=Math.min(MODEL_SIZE/imgW,MODEL_SIZE/imgH);
  return {scale,padW:(MODEL_SIZE-imgW*scale)/2,padH:(MODEL_SIZE-imgH*scale)/2};
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function YOLODetector() {
  const [model,        setModel]       = useState(null);
  const [modelType,    setModelType]   = useState('tflite');
  const [isLoading,    setIsLoading]   = useState(false);
  const [detections,   setDetections]  = useState([]);
  const [imagePreview, setImagePreview]= useState(null);
  const [procTime,     setProcTime]    = useState(0);
  const [confidence,   setConfidence]  = useState(0.40);
  const [minAspect,    setMinAspect]   = useState(1.2); // Default to ignore square-ish things
  const [maskOpacity,  setMaskOpacity] = useState(0.55);
  const [error,        setError]       = useState(null);
  const [selFile,      setSelFile]     = useState('yolo26n-seg_float16.tflite');
  const [loadMsg,      setLoadMsg]     = useState('');
  const [debugLines,   setDebugLines]  = useState([]);
  const [modelMeta,    setModelMeta]   = useState(null);
  const [selectedDet,  setSelectedDet] = useState(null);
  const [allDets,      setAllDets]     = useState([]);
  const [lastPreds,    setLastPreds]   = useState(null);
  const [isSnapshot,   setIsSnapshot]  = useState(false);
  const [useDeshadow,  setUseDeshadow] = useState(true);
  const [showMask,     setShowMask]    = useState(true);
  const [bright,       setBright]      = useState(0);
  const [contrast,     setContrast]    = useState(0);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [webcamOn, setWebcamOn] = useState(false);
  const rafRef    = useRef(null);

  const log = (...args) => {
    const msg = args.map(a=>typeof a==='object'?JSON.stringify(a):String(a)).join(' ');
    console.log(msg);
    setDebugLines(prev=>[...prev.slice(-40), msg]);
  };

  // ── Model loading ──────────────────────────────────────────────────────────
  const loadModel = async (fileName) => {
    setIsLoading(true); setError(null); setLoadMsg('Loading…'); setDebugLines([]);
    const type=fileName.endsWith('.onnx')?'onnx':'tflite';
    setModelType(type);
    try {
      if (type==='tflite') {
        const lib=window.tflite;
        if (!lib) throw new Error('TFLite not available');
        let m;
        for (const url of [`./${fileName}`,`${location.origin}/${fileName}`]) {
          try { m=await lib.loadTFLiteModel(url); break; } catch(_) {}
        }
        if (!m) throw new Error(`Cannot load ${fileName}`);
        const inputs = m.inputs.map(t=>`${t.name}[${t.shape}]`);
        const outputs = m.outputs.map(t=>`${t.name}[${t.shape}]`);
        log('inputs:',  inputs.join(' '));
        log('outputs:', outputs.join(' '));
        setModelMeta({ inputs, outputs });
        setModel(m);
      } else {
        const ort=window.ort;
        if (!ort) throw new Error('ONNX Runtime not available');
        const s=await ort.InferenceSession.create(`./${fileName}`,{
          executionProviders:['webgl','wasm'],graphOptimizationLevel:'all'});
        const inputs = s.inputNames;
        const outputs = s.outputNames;
        log('inputs:', inputs.join(' '));
        log('outputs:', outputs.join(' '));
        setModelMeta({ inputs, outputs });
        setModel(s);
      }
      setLoadMsg('Ready ✓');
    } catch(e) { setError(e.message); setLoadMsg(''); }
    finally { setIsLoading(false); }
  };

  const loadFromFile = async (file) => {
    setIsLoading(true); setError(null); setDebugLines([]);
    const type=file.name.endsWith('.onnx')?'onnx':'tflite';
    setModelType(type);
    try {
      const buf=await file.arrayBuffer();
      const m=type==='tflite'
        ?await window.tflite.loadTFLiteModel(buf)
        :await window.ort.InferenceSession.create(buf,{executionProviders:['webgl','wasm']});
      if (type==='tflite') {
        log('inputs:',  m.inputs.map(t=>`${t.name}[${t.shape}]`).join(' '));
        log('outputs:', m.outputs.map(t=>`${t.name}[${t.shape}]`).join(' '));
      }
      setModel(m); setSelFile(file.name); setLoadMsg('Loaded ✓');
    } catch(e) { setError(e.message); }
    finally { setIsLoading(false); }
  };

  // Redraw when UI parameters change (for snapshots)
  useEffect(() => {
    if (!lastPreds) return;
    const el = isSnapshot ? (imagePreview ? (()=>{const i=new Image();i.src=imagePreview;return i;})() : null) : (videoRef.current?.srcObject ? videoRef.current : null);
    
    // For snapshot mode, we need to redraw with current settings
    if (isSnapshot && lastPreds) {
      // Find current element
      const img = new Image();
      img.onload = () => {
        const lb = getLetterbox(img.width, img.height);
        drawResult(img, allDets, lastPreds, img.width, img.height, lb, selectedDet);
      };
      img.src = imagePreview;
    }
  }, [bright, contrast, showMask, maskOpacity, selectedDet]);

  useEffect(()=>{const t=setTimeout(()=>loadModel(selFile),800);return()=>clearTimeout(t);},[]);

  // ── Preprocess (letterbox) ─────────────────────────────────────────────────
  const preprocessImage = (el, fmt='nhwc') => tf.tidy(()=>{
    const src=tf.browser.fromPixels(el);
    const [h,w]=src.shape;
    const scale=Math.min(MODEL_SIZE/w,MODEL_SIZE/h);
    const newW=Math.round(w*scale), newH=Math.round(h*scale);
    const padL=Math.floor((MODEL_SIZE-newW)/2), padT=Math.floor((MODEL_SIZE-newH)/2);
    const norm=tf.div(tf.cast(tf.image.resizeBilinear(src,[newH,newW]),'float32'),255.0);
    const padded=tf.pad(norm,[[padT,MODEL_SIZE-newH-padT],[padL,MODEL_SIZE-newW-padL],[0,0]],0.5);
    const b=padded.expandDims(0);
    return fmt==='nchw'?b.transpose([0,3,1,2]):b;
  });

  // ── Inference ──────────────────────────────────────────────────────────────
  const runInference = async (el) => {
    if (!model) { setError('Model not loaded'); return; }
    const t0=performance.now();
    const imgW=el.naturalWidth||el.videoWidth||el.width;
    const imgH=el.naturalHeight||el.videoHeight||el.height;
    const lb=getLetterbox(imgW,imgH);

    try {
      let preds;
      if (modelType==='tflite') {
        const inp=preprocessImage(el,'nhwc');
        preds=await model.predict(inp);
        tf.dispose(inp);
      } else {
        const inp=preprocessImage(el,'nchw');
        const data=inp.dataSync();
        preds=await model.run({[model.inputNames[0]]:
          new window.ort.Tensor('float32',data,[1,3,MODEL_SIZE,MODEL_SIZE])});
        tf.dispose(inp);
      }

      const {dets,dbg}=parseDetections(preds,imgW,imgH,lb,0.2); // Only looking for books now
      log('parse:',dbg);
      setAllDets(dets);
      setDetections(dets);
      setLastPreds(preds);
      setProcTime(performance.now()-t0);
      
      // Auto-select the best book if available
      if (dets.length > 0) {
        const bestBook = dets.sort((a,b) => b.score - a.score)[0];
        setSelectedDet(bestBook);
        drawResult(el, dets, preds, imgW, imgH, lb, bestBook);
      } else {
        drawResult(el, dets, preds, imgW, imgH, lb, null);
      }
    } catch(e) { setError(`Inference: ${e.message}`); console.error(e); }
  };

  // ── Parse NMS-included output [1, 300, 38] ────────────────────────────────
  //
  // Format per detection (38 values):
  //   [0]   x1  (model space 0-640, with letterbox padding)
  //   [1]   y1
  //   [2]   x2
  //   [3]   y2
  //   [4]   confidence/score
  //   [5]   class_id (integer, but stored as float)
  //   [6..37] 32 mask coefficients
  //
  // Boxes are in MODEL space — we just need to strip letterbox to get image coords.
  //
  const parseDetections = (preds,imgW,imgH,lb,confThreshold) => {
    // Find the 3D output [1, N, C]
    const allOut=preds instanceof tf.Tensor?{out:preds}:preds;
    let detTensor=null;

    for (const k of Object.keys(allOut)) {
      const t=allOut[k];
      const s=t.shape??t.dims;
      if (s.length===3) { detTensor=t; break; }
    }
    if (!detTensor) return {dets:[],dbg:'no 3D tensor found'};

    const shape=detTensor.shape??detTensor.dims;
    const raw=detTensor.dataSync?detTensor.dataSync():detTensor.data;

    const N=shape[1];   // 300
    const C=shape[2];   // 38
    // at(row, col)
    const at=(n,c)=>raw[n*C+c];

    log(`det tensor shape=[${shape}]`);

    // Log first valid detection for format verification
    for (let i=0; i<Math.min(5,N); i++) {
      let x1=at(i,0), y1=at(i,1), x2=at(i,2), y2=at(i,3);
      if (x1 <= 1 && x2 <= 1) {
        x1 *= MODEL_SIZE; y1 *= MODEL_SIZE;
        x2 *= MODEL_SIZE; y2 *= MODEL_SIZE;
      }
      const score=at(i,4), cls=at(i,5);
      if (score>0.01) {
        log(`det[${i}]: bbox=[${x1.toFixed(1)},${y1.toFixed(1)},${x2.toFixed(1)},${y2.toFixed(1)}] score=${score.toFixed(3)} cls=${cls.toFixed(0)}`);
        break;
      }
    }

    const dets=[];
    let validCount=0;

    for (let i=0; i<N; i++) {
      const score=at(i,4);
      if (score < confThreshold) continue;  
      validCount++;

      let mx1=at(i,0), my1=at(i,1), mx2=at(i,2), my2=at(i,3);
      
      // Fix: Scale 0-1 coordinates to 0-640 model space
      if (mx1 <= 1 && mx2 <= 1) {
        mx1 *= MODEL_SIZE; my1 *= MODEL_SIZE;
        mx2 *= MODEL_SIZE; my2 *= MODEL_SIZE;
      }

      const classId=Math.round(at(i,5));
      
      // EXCLUSIVE FILTER: Only keep 'book' (Class 73)
      if (classId !== 73) continue;

      const coeffs=[];
      for (let c=6; c<6+NUM_COEFFS; c++) coeffs.push(at(i,c));

      const ix1=Math.max(0,   (mx1-lb.padW)/lb.scale);
      const iy1=Math.max(0,   (my1-lb.padH)/lb.scale);
      const ix2=Math.min(imgW,(mx2-lb.padW)/lb.scale);
      const iy2=Math.min(imgH,(my2-lb.padH)/lb.scale);

      dets.push({
        bbox:    [ix1,iy1,ix2,iy2],
        bboxModel:[mx1,my1,mx2,my2],
        class:   classId,
        className: classNames[classId] ?? `DocItem_${classId}`,
        score,
        coeffs,
      });
    }

    return {dets, dbg:`N=${N} C=${C} valid=${validCount} kept=${dets.length}`};
  };

  // ── Mask processing: exact Ultralytics process_mask() ─────────────────────
  //
  // Identity_1: [1,160,160,32] → HWC layout
  //
  // Steps (from ops.py):
  //   1. masks = coeffs @ protos.view(32,-1)  → [N,160*160]
  //   2. crop in proto space (bboxModel * ratio)
  //   3. upsample to MODEL_SIZE
  //   4. sigmoid > 0.5
  //   5. strip letterbox → image coords
  //
  const processMasks = (protosHWC,protoH,protoW,coeffsList,bboxesModel,lb,imgW,imgH) => {
    const area=protoH*protoW;
    // HWC accessor: protos[r,c,k] = protosHWC[r*protoW*32 + c*32 + k]
    const P=(k,r,c)=>protosHWC[r*protoW*NUM_COEFFS + c*NUM_COEFFS + k];

    const ratioW=protoW/MODEL_SIZE;
    const ratioH=protoH/MODEL_SIZE;

    return coeffsList.map((coeffs, i)=>{
      const [mx1, my1, mx2, my2] = bboxesModel[i];
      // bbox in proto space
      const px1=Math.max(0,     mx1*ratioW);
      const py1=Math.max(0,     my1*ratioH);
      const px2=Math.min(protoW,mx2*ratioW);
      const py2=Math.min(protoH,my2*ratioH);

      if (px2<=px1||py2<=py1) return null;

      const cpx1=Math.floor(px1), cpy1=Math.floor(py1);
      const cpx2=Math.ceil(px2),  cpy2=Math.ceil(py2);
      const cropW=Math.max(1,cpx2-cpx1), cropH=Math.max(1,cpy2-cpy1);

      // Dot product only in crop region
      const cropped=new Float32Array(cropH*cropW);
      for (let r=0; r<cropH; r++) {
        const pr=Math.min(protoH-1,cpy1+r);
        for (let c=0; c<cropW; c++) {
          const pc=Math.min(protoW-1,cpx1+c);
          let v=0;
          for (let k=0; k<NUM_COEFFS; k++) v+=coeffs[k]*P(k,pr,pc);
          cropped[r*cropW+c]=v;
        }
      }

      // Output size in image space
      const ix1=Math.max(0,   (mx1-lb.padW)/lb.scale);
      const iy1=Math.max(0,   (my1-lb.padH)/lb.scale);
      const ix2=Math.min(imgW,(mx2-lb.padW)/lb.scale);
      const iy2=Math.min(imgH,(my2-lb.padH)/lb.scale);
      const outW=Math.round(ix2-ix1), outH=Math.round(iy2-iy1);
      if (outW<1||outH<1) return null;

      // Bilinear upsample + sigmoid threshold
      const pixels=new Uint8Array(outH*outW);
      const scX=(cropW-1)/Math.max(1,outW-1);
      const scY=(cropH-1)/Math.max(1,outH-1);

      for (let r=0; r<outH; r++) {
        const sy=r*scY;
        const sy0=Math.floor(sy), sy1=Math.min(cropH-1,sy0+1), dy=sy-sy0;
        for (let c=0; c<outW; c++) {
          const sx=c*scX;
          const sx0=Math.floor(sx), sx1=Math.min(cropW-1,sx0+1), dx=sx-sx0;
          const v=
            cropped[sy0*cropW+sx0]*(1-dy)*(1-dx)+
            cropped[sy0*cropW+sx1]*(1-dy)*dx+
            cropped[sy1*cropW+sx0]*dy*(1-dx)+
            cropped[sy1*cropW+sx1]*dy*dx;
          pixels[r*outW+c]=sigmoid(v)>0.5?255:0;
        }
      }

      return {pixels,x:Math.round(ix1),y:Math.round(iy1),w:outW,h:outH};
    });
  };

  // ── Smart Restoration (Division Filter + Brightness/Contrast) ───────────
  const applyRestoration = (ctx, x, y, w, h, bVal, cVal) => {
    const imgData = ctx.getImageData(x, y, w, h);
    const data = imgData.data;
    const len = data.length;
    
    // 1. Division Filter (Shadow Removal)
    // We estimate the background by looking for local maximums (the paper color)
    const factor = 1.1; // Strength of shadow removal
    for (let i = 0; i < len; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const gray = (r + g + b) / 3;
      
      // Smart boost: boost more in dark areas, less in light areas
      // This matches the brightness of shadows to the light areas
      if (useDeshadow) {
        const boost = 255 / Math.max(120, gray); 
        data[i]   = Math.min(255, r * boost);
        data[i+1] = Math.min(255, g * boost);
        data[i+2] = Math.min(255, b * boost);
      }

      // 2. Manual Brightness (-100 to 100)
      if (bVal !== 0) {
        data[i]   = Math.max(0, Math.min(255, data[i] + bVal));
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + bVal));
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + bVal));
      }

      // 3. Manual Contrast (-100 to 100)
      if (cVal !== 0) {
        const f = (259 * (cVal + 255)) / (255 * (259 - cVal));
        data[i]   = Math.max(0, Math.min(255, f * (data[i] - 128) + 128));
        data[i+1] = Math.max(0, Math.min(255, f * (data[i+1] - 128) + 128));
        data[i+2] = Math.max(0, Math.min(255, f * (data[i+2] - 128) + 128));
      }
    }
    ctx.putImageData(imgData, x, y);
  };

  // ── Draw ──────────────────────────────────────────────────────────────────
  const drawResult = (el,dets,preds,imgW,imgH,lb, activeDet) => {
    const canvas=canvasRef.current;
    if (!canvas) return;
    canvas.width=imgW; canvas.height=imgH;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,imgW,imgH);
    ctx.drawImage(el,0,0,imgW,imgH);

    const detsToDraw = activeDet ? [activeDet] : dets;
    if (detsToDraw.length===0) return;

    // Find proto tensor (4D)
    const allOut=preds instanceof tf.Tensor?{out:preds}:preds;
    let protoTensor=null;
    for (const k of Object.keys(allOut)) {
      const t=allOut[k];
      const s=t.shape??t.dims;
      if (s.length===4) { protoTensor=t; break; }
    }

    if (protoTensor) {
      const shape=protoTensor.shape??protoTensor.dims;
      const protoH=shape[1], protoW=shape[2];
      const protosData=protoTensor.dataSync?protoTensor.dataSync():protoTensor.data;

      try {
        const masks=processMasks(
          protosData, protoH, protoW,
          detsToDraw.map(d=>d.coeffs),
          detsToDraw.map(d=>d.bboxModel),
          lb, imgW, imgH
        );

        const off=document.createElement('canvas');
        off.width=imgW; off.height=imgH;
        const offCtx=off.getContext('2d');

        if (showMask) {
          masks.forEach((mask,i)=>{
            if (!mask) return;
            const {pixels,x,y,w,h}=mask;
            const {rgb}=PALETTE(detsToDraw[i].class);
            const imgData=new ImageData(w,h);
            for (let p=0; p<w*h; p++) {
              if (!pixels[p]) continue;
              imgData.data[p*4]=rgb[0]; imgData.data[p*4+1]=rgb[1];
              imgData.data[p*4+2]=rgb[2]; imgData.data[p*4+3]=Math.round(maskOpacity*255);
            }
            const tmp=document.createElement('canvas');
            tmp.width=w; tmp.height=h;
            tmp.getContext('2d').putImageData(imgData,0,0);
            offCtx.drawImage(tmp,x,y);
          });
          ctx.drawImage(off,0,0);
        }
        
        // If selection is active, apply restoration (shadow removal + brightness/contrast)
        if (activeDet) {
          const [x1, y1, x2, y2] = activeDet.bbox;
          applyRestoration(ctx, Math.round(x1), Math.round(y1), Math.round(x2-x1), Math.round(y2-y1), bright, contrast);
        }
      } catch(e) { log('mask error:',e.message); }
    }

    // Draw boxes
    detsToDraw.forEach(det=>{
      const [x1,y1,x2,y2]=det.bbox;
      const {color}=PALETTE(det.class);
      ctx.strokeStyle=color; ctx.lineWidth=3;
      ctx.strokeRect(x1,y1,x2-x1,y2-y1);
      
      const label=`${det.className} ${(det.score*100).toFixed(0)}%`;
      ctx.font='bold 14px monospace';
      const tw=ctx.measureText(label).width;
      ctx.fillStyle=color; ctx.fillRect(x1,y1-22,tw+10,22);
      ctx.fillStyle='#000'; ctx.fillText(label,x1+5,y1-6);
    });
  };

  const handleCanvasClick = (e) => {
    if (allDets.length === 0) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvasRef.current.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvasRef.current.height;
    
    // Find the detection that contains the point
    // We sort by area to prefer smaller, more specific detections
    const match = allDets
      .filter(d => x >= d.bbox[0] && x <= d.bbox[2] && y >= d.bbox[1] && y <= d.bbox[3])
      .sort((a,b) => {
        const areaA = (a.bbox[2]-a.bbox[0]) * (a.bbox[3]-a.bbox[1]);
        const areaB = (b.bbox[2]-b.bbox[0]) * (b.bbox[3]-b.bbox[1]);
        return areaA - areaB;
      })[0];
      
    if (match) {
      setSelectedDet(match);
      // Force a redraw with the new selection
      const el = isSnapshot ? imagePreview : (videoRef.current.srcObject ? videoRef.current : null);
      if (el && lastPreds) {
        const imgW=el.naturalWidth||el.videoWidth||el.width;
        const imgH=el.naturalHeight||el.videoHeight||el.height;
        const lb=getLetterbox(imgW,imgH);
        drawResult(el, allDets, lastPreds, imgW, imgH, lb, match);
      }
    } else {
      setSelectedDet(null);
      // Redraw all
      const el = isSnapshot ? imagePreview : (videoRef.current.srcObject ? videoRef.current : null);
      if (el && lastPreds) {
        const imgW=el.naturalWidth||el.videoWidth||el.width;
        const imgH=el.naturalHeight||el.videoHeight||el.height;
        const lb=getLetterbox(imgW,imgH);
        drawResult(el, allDets, lastPreds, imgW, imgH, lb, null);
      }
    }
  };

  // ── Image / webcam handlers ────────────────────────────────────────────────
  const handleImgUpload = e=>{
    const file=e.target.files[0]; if(!file) return;
    setDebugLines([]);
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{setImagePreview(ev.target.result); runInference(img);};
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const startWebcam=async()=>{
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}});
      videoRef.current.srcObject=s;
      await videoRef.current.play();
      setWebcamOn(true);
      setIsSnapshot(false);
      setSelectedDet(null);
    }
    catch(e){setError(`Webcam: ${e.message}`);}
  };
  const takeSnapshot = () => {
    if (!videoRef.current || !webcamOn) return;
    setIsSnapshot(true);
    setWebcamOn(false);
    // The last inference results are already stored in allDets and lastPreds
  };
  const stopWebcam=()=>{
    videoRef.current?.srcObject?.getTracks().forEach(t=>t.stop());
    if(videoRef.current)videoRef.current.srcObject=null;
    cancelAnimationFrame(rafRef.current);setWebcamOn(false);
  };
  useEffect(()=>{
    if(!webcamOn||!model) return;
    let alive=true;
    const loop=async()=>{if(!alive||!videoRef.current)return;await runInference(videoRef.current);rafRef.current=requestAnimationFrame(loop);};
    loop(); return()=>{alive=false;cancelAnimationFrame(rafRef.current);};
  },[webcamOn,model,maskOpacity]);
  useEffect(()=>()=>stopWebcam(),[]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const card={background:'rgba(8,10,24,0.92)',padding:'20px',borderRadius:'18px',
    border:'1px solid rgba(255,255,255,0.06)',backdropFilter:'blur(14px)'};

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#04040f 0%,#08112a 100%)',
      padding:'28px 16px',fontFamily:'"JetBrains Mono",monospace',color:'#dde0f5'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;
          border-radius:50%;background:#4facfe;cursor:pointer;box-shadow:0 0 6px #4facfe88}
        .btn{transition:all .14s}.btn:hover{filter:brightness(1.18);transform:translateY(-1px)}
      `}</style>
      <div style={{maxWidth:1060,margin:'0 auto'}}>

        <div style={{textAlign:'center',marginBottom:22}}>
          <h1 style={{fontSize:'1.7rem',fontWeight:700,
            background:'linear-gradient(90deg,#4facfe,#a78bfa)',
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:3}}>
            ⬡ YOLO Seg · NMS-Export Format
          </h1>
          <div style={{marginTop: 8}}>
            <a href="/segmenter" style={{color: '#4facfe', fontSize: '0.8rem', textDecoration: 'none', border: '1px solid #4facfe44', padding: '4px 12px', borderRadius: '100px', marginRight: 8}}>
               All-Class Segmenter ➔
            </a>
            <a href="/editor" style={{color: '#a78bfa', fontSize: '0.8rem', textDecoration: 'none', border: '1px solid #a78bfa44', padding: '4px 12px', borderRadius: '100px'}}>
               Editor & Camera ➔
            </a>
          </div>
          <p style={{color:'#2d3858',fontSize:'.76rem', marginTop: 12}}>
            Model output: [1,300,38] — NMS already applied in model
          </p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14,marginBottom:14}}>
          <div style={card}>
            <h3 style={{color:'#4facfe',fontSize:'.74rem',letterSpacing:'.12em',marginBottom:11}}>📦 MODEL</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:11}}>
              {['yolo26n-seg_float16.tflite','yolo26n-seg_float32.tflite','yolo26n-seg.onnx'].map(f=>(
                <button key={f} className="btn" disabled={isLoading} onClick={()=>{setSelFile(f);loadModel(f);}}
                  style={{padding:'8px 5px',borderRadius:8,border:'none',fontSize:'.7rem',fontWeight:700,cursor:'pointer',
                    background:selFile===f?'linear-gradient(90deg,#4facfe,#2970e0)':'rgba(255,255,255,0.04)',
                    color:selFile===f?'#fff':'#4a5578',opacity:isLoading?.45:1}}>
                  {f.endsWith('.onnx')?'ONNX GPU':f.includes('16')?'FP16':'FP32'}
                </button>
              ))}
            </div>
            <input type="file" accept=".tflite,.onnx" id="mup" style={{display:'none'}}
              onChange={e=>{if(e.target.files[0])loadFromFile(e.target.files[0]);}}/>
            <label htmlFor="mup" className="btn" style={{display:'block',padding:'7px',
              border:'2px dashed #7c3aed',borderRadius:8,textAlign:'center',
              cursor:'pointer',color:'#8b5cf6',fontSize:'.73rem'}}>📁 Upload model</label>
            
            {modelMeta && (
              <div style={{marginTop:10, padding:8, background:'rgba(0,0,0,0.3)', borderRadius:8, fontSize:'0.65rem', color:'#8892b0'}}>
                <div style={{color:'#4facfe', fontWeight:'bold', marginBottom:4}}>Tensors:</div>
                <div>In: {modelMeta.inputs.join(', ')}</div>
                <div>Out: {modelMeta.outputs.join(', ')}</div>
              </div>
            )}

            <p style={{fontSize:'.71rem',marginTop:7,color:model?'#10b981':isLoading?'#4facfe':'#2d3858'}}>
              {isLoading?`⚡ ${loadMsg}`:model?`✓ ${selFile}`:'— no model —'}
            </p>
          </div>

          <div style={card}>
            <h3 style={{color:'#a78bfa',fontSize:'.74rem',letterSpacing:'.12em',marginBottom:13}}>🎛 PARAMETERS</h3>
            <div style={{marginBottom:15}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'.75rem',color:'#6a78a0',marginBottom:4}}>
                <span>Confidence Threshold</span>
                <strong style={{color:'#4facfe'}}>{Math.round(confidence*100)}%</strong>
              </div>
              <input type="range" min={5} max={95} value={Math.round(confidence*100)}
                onChange={e=>setConfidence(+e.target.value/100)}
                style={{width:'100%',height:4,borderRadius:10,outline:'none',
                  WebkitAppearance:'none',background:'rgba(255,255,255,0.08)'}}/>
            </div>
            <div style={{marginBottom:15}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'.75rem',color:'#6a78a0',marginBottom:4}}>
                <span>Min Aspect Ratio</span>
                <strong style={{color:'#a78bfa'}}>{minAspect.toFixed(1)}</strong>
              </div>
              <input type="range" min={0} max={30} value={minAspect*10}
                onChange={e=>setMinAspect(+e.target.value/10) }
                style={{width:'100%',height:4,borderRadius:10,outline:'none',
                  WebkitAppearance:'none',background:'rgba(255,255,255,0.08)'}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'.75rem',color:'#6a78a0',marginBottom:4}}>
                <span>Mask opacity</span>
                <strong style={{color:'#dde0f5'}}>{Math.round(maskOpacity*100)}%</strong>
              </div>
              <input type="range" min={10} max={90} value={Math.round(maskOpacity*100)}
                onChange={e=>setMaskOpacity(+e.target.value/100)}
                style={{width:'100%',height:4,borderRadius:10,outline:'none',
                  WebkitAppearance:'none',background:'rgba(255,255,255,0.08)'}}/>
            </div>
            <div style={{marginBottom:15}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'.75rem',color:'#6a78a0',marginBottom:4}}>
                <span>Shadow Removal</span>
                <strong style={{color:'#10b981'}}>{useDeshadow?'ON':'OFF'}</strong>
              </div>
              <button className="btn" onClick={()=>setUseDeshadow(!useDeshadow)} style={{
                width:'100%', padding:'8px', borderRadius:8, border:'none', fontSize:'.7rem', fontWeight:700,
                background:useDeshadow?'#10b98133':'rgba(255,255,255,0.05)',
                color:useDeshadow?'#10b981':'#4a5578', cursor:'pointer'
              }}>
                {useDeshadow?'✨ Enhanced (Active)':'🌑 Basic'}
              </button>
            </div>
            <div style={{marginTop:16,padding:'12px',background:'rgba(16,185,129,0.06)',
              borderRadius:10,border:'1px solid rgba(16,185,129,0.15)',fontSize:'.71rem',color:'#6a78a0'}}>
              <strong style={{color:'#10b981'}}>🔒 Book-Only Mode Active</strong><br/>
              The scanner is locked to Class 73 (Documents).<br/>
              All other objects (hands, tables) are being ignored.
            </div>
          </div>
        </div>

        <div style={{display:'flex',gap:11,marginBottom:14}}>
          <input type="file" accept="image/*" id="iup" style={{display:'none'}} onChange={handleImgUpload}/>
          <label htmlFor="iup" className="btn" style={{flex:1,padding:'13px',
            background:'rgba(255,255,255,0.05)',borderRadius:11,border:'1px solid #4facfe',
            textAlign:'center',cursor:'pointer',fontWeight:700,color:'#4facfe',fontSize:'.82rem'}}>
            📁 Upload
          </label>
          
          <button className="btn" disabled={!model || !webcamOn} onClick={takeSnapshot} style={{
            flex:1,padding:'13px',borderRadius:11,fontWeight:700,fontSize:'.82rem',
            cursor: (model && webcamOn)?'pointer':'not-allowed',
            background:'linear-gradient(90deg,#4facfe,#00d4ff)',
            border:'none', color:'#000', opacity:(model && webcamOn)?1:.4}}>
            📸 Take Snapshot
          </button>

          <button className="btn" disabled={!model} onClick={webcamOn?stopWebcam:startWebcam} style={{
            flex:1,padding:'13px',borderRadius:11,fontWeight:700,fontSize:'.82rem',
            cursor:model?'pointer':'not-allowed',
            background:webcamOn?'rgba(239,68,68,.1)':'rgba(139,92,246,.1)',
            border:`2px solid ${webcamOn?'#ef4444':'#8b5cf6'}`,
            color:webcamOn?'#ef4444':'#8b5cf6',opacity:model?1:.4}}>
            {webcamOn?'⏹ Stop':'📹 Start Camera'}
          </button>
        </div>

        <div style={{...card, marginBottom:14, border:'1px solid #4facfe33', background:'rgba(79,172,254,0.03)'}}>
          <h3 style={{color:'#4facfe',fontSize:'.74rem',letterSpacing:'.12em',marginBottom:12}}>✨ DOCUMENT RESTORATION</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:15}}>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'.7rem',color:'#6a78a0',marginBottom:5}}>
                <span>Brightness</span>
                <strong style={{color:'#dde0f5'}}>{bright}</strong>
              </div>
              <input type="range" min={-100} max={100} value={bright} onChange={e=>setBright(+e.target.value)}
                style={{width:'100%',height:3,borderRadius:10,outline:'none',WebkitAppearance:'none',background:'rgba(255,255,255,0.08)'}}/>
            </div>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'.7rem',color:'#6a78a0',marginBottom:5}}>
                <span>Contrast</span>
                <strong style={{color:'#dde0f5'}}>{contrast}</strong>
              </div>
              <input type="range" min={-100} max={100} value={contrast} onChange={e=>setContrast(+e.target.value)}
                style={{width:'100%',height:3,borderRadius:10,outline:'none',WebkitAppearance:'none',background:'rgba(255,255,255,0.08)'}}/>
            </div>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{display:'flex', gap:8}}>
              <button className="btn" onClick={()=>setShowMask(!showMask)} style={{
                padding:'8px 14px', borderRadius:10, border:'none', fontSize:'.72rem', fontWeight:700,
                background:showMask?'rgba(255,255,255,0.05)':'#4facfe33',
                color:showMask?'#8892b0':'#4facfe', cursor:'pointer'
              }}>
                {showMask?'Hide Mask':'Show Mask'}
              </button>
              <button className="btn" onClick={()=>setUseDeshadow(!useDeshadow)} style={{
                padding:'8px 14px', borderRadius:10, border:'none', fontSize:'.72rem', fontWeight:700,
                background:useDeshadow?'#10b98133':'rgba(255,255,255,0.05)',
                color:useDeshadow?'#10b981':'#8892b0', cursor:'pointer'
              }}>
                {useDeshadow?'Shadow Clean (ON)':'Shadow Clean (OFF)'}
              </button>
            </div>
            <div style={{display:'flex', gap:10}}>
              <button className="btn" onClick={() => { setBright(0); setContrast(0); }} style={{
                padding:'6px 12px', borderRadius:8, border:'1px solid #4facfe44', background:'none', color:'#4facfe', fontSize:'.7rem', cursor:'pointer'
              }}>Reset</button>
              <button className="btn" disabled={!selectedDet} onClick={() => {
                const canvas = canvasRef.current;
                if (canvas && selectedDet) {
                  const [x1,y1,x2,y2] = selectedDet.bbox;
                  applyRestoration(canvas.getContext('2d'), Math.round(x1), Math.round(y1), Math.round(x2-x1), Math.round(y2-y1), bright, contrast);
                }
              }} style={{
                padding:'8px 18px', borderRadius:10, border:'none', background:selectedDet?'#4facfe':'#2d3858', color:'#000',
                fontWeight:700, fontSize:'.75rem', cursor:selectedDet?'pointer':'not-allowed'
              }}>
                Clean Document
              </button>
            </div>
          </div>
        </div>

        <div style={{background:'#000',borderRadius:22,overflow:'hidden',position:'relative',
          border:'1px solid rgba(255,255,255,0.06)',boxShadow:'0 18px 55px rgba(0,0,0,.7)',
          minHeight:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <video ref={videoRef} muted playsInline style={{display:webcamOn?'block':'none',width:'100%'}}/>
          <canvas 
            ref={canvasRef} 
            onClick={handleCanvasClick}
            style={{
              position:webcamOn?'absolute':'relative',
              top:0,left:0,width:'100%',height:'auto',zIndex:10,
              cursor: allDets.length > 0 ? 'crosshair' : 'default'
            }}
          />
          {!imagePreview&&!webcamOn&&(
            <div style={{textAlign:'center',color:'#141828',userSelect:'none'}}>
              <div style={{fontSize:'2.5rem'}}>◈</div>
              <p style={{fontSize:'.8rem',marginTop:5}}>Upload an image or start webcam</p>
            </div>
          )}
          {procTime>0&&(
            <div style={{position:'absolute',top:11,right:11,background:'rgba(0,0,0,.82)',
              padding:'4px 11px',borderRadius:100,fontSize:'.7rem',color:'#10b981',
              border:'1px solid #10b98130',zIndex:20}}>
              {procTime.toFixed(1)}ms · {detections.length} obj
            </div>
          )}
        </div>

        {/* Debug panel */}
        {debugLines.length>0&&(
          <div style={{marginTop:12,background:'rgba(0,0,0,0.75)',borderRadius:12,
            padding:'12px',border:'1px solid #4facfe22',maxHeight:220,overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
              <span style={{fontSize:'.72rem',color:'#4facfe',fontWeight:700}}>🔍 DEBUG</span>
              <button onClick={()=>setDebugLines([])} style={{background:'none',border:'none',
                color:'#4a5578',cursor:'pointer',fontSize:'.7rem'}}>clear</button>
            </div>
            {debugLines.map((l,i)=>(
              <div key={i} style={{fontSize:'.67rem',color:'#8892b0',padding:'2px 0',
                borderBottom:'1px solid rgba(255,255,255,0.03)',fontFamily:'monospace',
                whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{l}</div>
            ))}
          </div>
        )}

        {detections.length>0&&(
          <div style={{marginTop:14}}>
            <p style={{color:'#4facfe',fontSize:'.73rem',fontWeight:700,marginBottom:10,letterSpacing:'0.05em'}}>
              🎯 DETECTION TABLE ({detections.length})
            </p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:8}}>
              {detections.map((d,i)=>{
                const {color}=PALETTE(d.class);
                return (
                  <div key={i} style={{
                    padding:'10px',borderRadius:10,fontSize:'.68rem',
                    background:'rgba(255,255,255,0.03)', border:`1px solid ${color}33`,
                    display:'flex', flexDirection:'column', gap:4
                  }}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{color,fontWeight:700,fontSize:'.75rem'}}>{d.className}</span>
                      <span style={{color:'#10b981',fontWeight:700}}>{(d.score*100).toFixed(0)}%</span>
                    </div>
                    <div style={{color:'#4a5578', fontSize:'0.62rem', fontFamily:'monospace'}}>
                      ID: {d.class} | Box: [{d.bbox.map(v=>Math.round(v)).join(',')}]
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error&&(
        <div style={{position:'fixed',bottom:18,left:'50%',transform:'translateX(-50%)',
          background:'#3f0808',color:'#fca5a5',padding:'11px 20px',borderRadius:11,
          boxShadow:'0 8px 24px rgba(0,0,0,.55)',zIndex:200,maxWidth:'92%',fontSize:'.77rem'}}>
          ⚠️ {error}
          <button onClick={()=>setError(null)} style={{marginLeft:10,background:'none',
            border:'none',color:'#fca5a5',cursor:'pointer',fontWeight:700}}>✕</button>
        </div>
      )}
    </div>
  );
}