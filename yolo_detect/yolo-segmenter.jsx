import React, { useState, useRef, useEffect } from 'react';

const tf     = window.tf;
const tflite = window.tflite;
if (tflite) tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/');

// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL_SIZE  = 640;
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

export default function YOLOSegmenter() {
  const [model,        setModel]       = useState(null);
  const [isLoading,    setIsLoading]   = useState(false);
  const [detections,   setDetections]  = useState([]);
  const [procTime,     setProcTime]    = useState(0);
  const [confidence,   setConfidence]  = useState(0.10); // Lowered to ensure detections show
  const [maskOpacity,  setMaskOpacity] = useState(0.4);
  const [selectedDet,  setSelectedDet] = useState(null);
  const [lastPreds,    setLastPreds]   = useState(null);
  const [image,        setImage]       = useState(null);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Model loading ──────────────────────────────────────────────────────────
  const loadModel = async () => {
    setIsLoading(true);
    try {
      const lib = window.tflite;
      if (!lib) throw new Error('TFLite missing');
      const m = await lib.loadTFLiteModel('./yolo26n-seg_float16.tflite');
      setModel(m);
    } catch(e) { console.error('Model load failed', e); }
    finally { setIsLoading(false); }
  };

  useEffect(()=>{ loadModel(); }, []);

  // ── Preprocess ──────────────────────────────────────────────────────────────
  const preprocessImage = (el) => tf.tidy(()=>{
    const src=tf.browser.fromPixels(el);
    const [h,w]=src.shape;
    const scale=Math.min(MODEL_SIZE/w,MODEL_SIZE/h);
    const newW=Math.round(w*scale), newH=Math.round(h*scale);
    const padL=Math.floor((MODEL_SIZE-newW)/2), padT=Math.floor((MODEL_SIZE-newH)/2);
    const norm=tf.div(tf.cast(tf.image.resizeBilinear(src,[newH,newW]),'float32'),255.0);
    const padded=tf.pad(norm,[[padT,MODEL_SIZE-newH-padT],[padL,MODEL_SIZE-newW-padL],[0,0]],0.5);
    return padded.expandDims(0);
  });

  const parseDetections = (preds,imgW,imgH,lb,conf) => {
    const allOut=preds instanceof tf.Tensor?{out:preds}:preds;
    let detTensor=null;
    for (const k of Object.keys(allOut)) {
      const t=allOut[k];
      const s=t.shape??t.dims;
      if (s.length===3) { detTensor=t; break; }
    }
    if (!detTensor) return [];

    const shape=detTensor.shape??detTensor.dims;
    const raw=detTensor.dataSync();
    const N=shape[1], C=shape[2];
    const at=(n,c)=>raw[n*C+c];

    const dets=[];
    for (let i=0; i<N; i++) {
      const score=at(i,4);
      if (score < conf) continue;

      let mx1=at(i,0), my1=at(i,1), mx2=at(i,2), my2=at(i,3);
      if (mx1 <= 1) { // Normalize if needed
        mx1*=MODEL_SIZE; my1*=MODEL_SIZE; mx2*=MODEL_SIZE; my2*=MODEL_SIZE;
      }

      const classId=Math.round(at(i,5));
      const coeffs=[];
      for (let c=6; c<6+NUM_COEFFS; c++) coeffs.push(at(i,c));

      const ix1=Math.max(0,(mx1-lb.padW)/lb.scale), iy1=Math.max(0,(my1-lb.padH)/lb.scale);
      const ix2=Math.min(imgW,(mx2-lb.padW)/lb.scale), iy2=Math.min(imgH,(my2-lb.padH)/lb.scale);

      dets.push({ id:i, bbox:[ix1,iy1,ix2,iy2], bboxModel:[mx1,my1,mx2,my2], class:classId, className:classNames[classId]||'Item', score, coeffs });
    }
    return dets;
  };

  const draw = (imgEl, dets, preds) => {
    const canvas=canvasRef.current; if (!canvas) return;
    const imgW=imgEl.naturalWidth, imgH=imgEl.naturalHeight;
    canvas.width=imgW; canvas.height=imgH;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(imgEl,0,0);

    const lb=getLetterbox(imgW,imgH);
    const allOut = preds instanceof tf.Tensor ? { out: preds } : preds;
    let protoTensor = null;
    for (const k of Object.keys(allOut)) {
      const t = allOut[k];
      const s = t.shape ?? t.dims;
      if (s && s.length === 4) { protoTensor = t; break; }
    }
    
    // Fallback for some TFLite environments
    if (!protoTensor && Object.values(allOut).length > 1) {
      protoTensor = Object.values(allOut).find(t => (t.shape || t.dims)?.length === 4);
    }

    if (protoTensor && dets.length > 0) {
      const shape=protoTensor.shape??protoTensor.dims;
      const protosData=protoTensor.dataSync();
      const ratioW=shape[2]/MODEL_SIZE, ratioH=shape[1]/MODEL_SIZE;

      dets.forEach(det => {
        const isSelected = selectedDet?.id === det.id;
        const [mx1, my1, mx2, my2] = det.bboxModel;
        const px1=Math.max(0,mx1*ratioW), py1=Math.max(0,my1*ratioH);
        const px2=Math.min(shape[2],mx2*ratioW), py2=Math.min(shape[1],my2*ratioH);
        
        const cpx1=Math.floor(px1), cpy1=Math.floor(py1), cpx2=Math.ceil(px2), cpy2=Math.ceil(py2);
        const cw=cpx2-cpx1, ch=cpy2-cpy1;
        if (cw<1||ch<1) return;

        const cropped=new Float32Array(ch*cw);
        for (let r=0; r<ch; r++) {
          for (let c=0; c<cw; c++) {
            let v=0;
            for (let k=0; k<32; k++) v+=det.coeffs[k]*protosData[(cpy1+r)*shape[2]*32 + (cpx1+c)*32 + k];
            cropped[r*cw+c]=v;
          }
        }

        const outW=Math.round(det.bbox[2]-det.bbox[0]), outH=Math.round(det.bbox[3]-det.bbox[1]);
        const imgData=new ImageData(outW,outH);
        const {rgb}=PALETTE(det.class);
        const op = isSelected ? 0.75 : maskOpacity;

        for (let r=0; r<outH; r++) {
          const sy=Math.floor(r*(ch-1)/outH);
          for (let c=0; c<outW; c++) {
            const sx=Math.floor(c*(cw-1)/outW);
            if (sigmoid(cropped[sy*cw+sx])>0.5) {
              const p=(r*outW+c)*4;
              imgData.data[p]=rgb[0]; imgData.data[p+1]=rgb[1]; imgData.data[p+2]=rgb[2]; imgData.data[p+3]=Math.round(op*255);
            }
          }
        }
        const tmp=document.createElement('canvas'); tmp.width=outW; tmp.height=outH;
        tmp.getContext('2d').putImageData(imgData,0,0);
        ctx.drawImage(tmp,det.bbox[0],det.bbox[1]);
        
        if (isSelected) {
          ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.strokeRect(det.bbox[0],det.bbox[1],outW,outH);
        }
      });
    }
  };

  const handleUpload = e => {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=async()=>{
        setImage(img);
        const t0=performance.now();
        const inp=preprocessImage(img);
        const preds=await model.predict(inp);
        tf.dispose(inp);
        const dets=parseDetections(preds,img.naturalWidth,img.naturalHeight,getLetterbox(img.naturalWidth,img.naturalHeight),confidence);
        setDetections(dets); setLastPreds(preds); setProcTime(performance.now()-t0);
        draw(img, dets, preds);
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (e) => {
    if (!image || detections.length===0) return;
    const rect=canvasRef.current.getBoundingClientRect();
    const x=(e.clientX-rect.left)*(canvasRef.current.width/rect.width);
    const y=(e.clientY-rect.top)*(canvasRef.current.height/rect.height);
    const match=detections.filter(d=>x>=d.bbox[0]&&x<=d.bbox[2]&&y>=d.bbox[1]&&y<=d.bbox[3]).sort((a,b)=>((a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1]))-((b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1])))[0];
    setSelectedDet(match||null);
  };

  useEffect(()=>{ if(image && lastPreds) draw(image, detections, lastPreds); }, [selectedDet, confidence, maskOpacity]);

  return (
    <div style={{height:'100vh', background:'#050508', color:'#fff', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'sans-serif'}}>
      <header style={{padding:'15px 25px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#0c0c14', borderBottom:'1px solid #1a1a25'}}>
        <div style={{display:'flex', alignItems:'center', gap:15}}>
          <h2 style={{margin:0, fontSize:'1.2rem', background:'linear-gradient(to right,#4facfe,#00f2fe)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>YOLO Segmenter</h2>
          <button onClick={()=>fileInputRef.current.click()} style={{background:'#4facfe', color:'#000', border:'none', padding:'8px 20px', borderRadius:'8px', fontWeight:700, cursor:'pointer'}}>Upload Image</button>
          <input type="file" ref={fileInputRef} onChange={handleUpload} hidden accept="image/*"/>
        </div>
        <div style={{display:'flex', gap:20, fontSize:'0.85rem', color:'#888'}}>
          <span>Confidence: <b>{Math.round(confidence*100)}%</b></span>
          <input type="range" min="1" max="50" value={confidence*100} onChange={e=>setConfidence(e.target.value/100)}/>
          {procTime>0 && <span style={{color:'#4facfe'}}>Inference: {procTime.toFixed(1)}ms</span>}
        </div>
      </header>

      <main style={{flex:1, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'radial-gradient(circle at center, #111 0%, #050508 100%)'}}>
        <div style={{width:'100%', height:'100%', maxWidth:'1200px', maxHeight:'85vh', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #1a1a25', borderRadius:20, background:'#000', overflow:'hidden'}}>
           <canvas ref={canvasRef} onClick={handleCanvasClick} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain', cursor:'crosshair'}}/>
           {!image && <div style={{color:'#333', textAlign:'center'}}><p style={{fontSize:'3rem', margin:0}}>◈</p><p>Select an image to begin</p></div>}
        </div>
      </main>

      <footer style={{padding:'12px 25px', background:'#0c0c14', borderTop:'1px solid #1a1a25', display:'flex', gap:20, alignItems:'center'}}>
        <a href="/" style={{color:'#888', textDecoration:'none', fontSize:'0.8rem'}}>⬅ Back to Detector</a>
        {selectedDet && <div style={{background:'#1a1a25', padding:'5px 15px', borderRadius:100, fontSize:'0.85rem', border:'1px solid #4facfe44'}}>
          Selected: <b style={{color:'#4facfe'}}>{selectedDet.className}</b> ({(selectedDet.score*100).toFixed(1)}%)
        </div>}
        <div style={{marginLeft:'auto', display:'flex', gap:10}}>
          {detections.slice(0, 8).map(d => (
            <span key={d.id} onClick={()=>setSelectedDet(d)} style={{fontSize:'0.7rem', padding:'3px 10px', borderRadius:5, background:selectedDet?.id===d.id?'#4facfe':'#1a1a25', color:selectedDet?.id===d.id?'#000':'#666', cursor:'pointer'}}>{d.className}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
