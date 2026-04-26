// =============================================================================
// File        : CameraCapturePro.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Camera capture with live preview, pinch zoom, brightness, gallery fallback
// Created     : 2026-04-20
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

interface CameraCapturProProps {
  mode: 'slip' | 'cheque';
  side?: 'front' | 'back';
  onCapture: (file: File, position: 'front' | 'back') => void;
  onClose: () => void;
}

type CameraState = 'starting' | 'live' | 'error' | 'gallery';

export function CameraCapturePro({ mode, side = 'front', onCapture, onClose }: CameraCapturProProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('starting');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [useFront, setUseFront] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<'front' | 'back'>(side);
  const [showSettings, setShowSettings] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // Pinch zoom tracking
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (deviceId?: string, facingMode?: string) => {
    stopStream();
    setCameraState('starting');
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: facingMode ?? 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
      }
      setCameraState('live');

      // Enumerate cameras after getting permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter(d => d.kind === 'videoinput');
      setCameras(vids);
      const track = ms.getVideoTracks()[0];
      const settings = track.getSettings();
      setActiveCameraId(settings.deviceId ?? '');
    } catch {
      setCameraState('error');
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return stopStream;
  }, [startCamera, stopStream]);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  // Switch camera
  const switchCamera = async (deviceId: string) => {
    setActiveCameraId(deviceId);
    setShowSettings(false);
    await startCamera(deviceId);
  };

  // Flip front/back
  const flipCamera = async () => {
    const next = !useFront;
    setUseFront(next);
    setShowSettings(false);
    await startCamera(undefined, next ? 'user' : 'environment');
  };

  // Capture frame from video
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = `brightness(${brightness}%)`;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      setCapturing(false);
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file, position);
    }, 'image/jpeg', 0.92);
  };

  // Gallery fallback
  const openGallery = () => galleryRef.current?.click();
  const onGalleryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onCapture(f, position);
    e.target.value = '';
  };

  // Pinch zoom handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      pinchRef.current = { startDist: dist, startZoom: zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      const ratio = dist / pinchRef.current.startDist;
      const next = Math.min(3, Math.max(1, pinchRef.current.startZoom * ratio));
      setZoom(next);
    }
  };
  const onTouchEnd = () => { pinchRef.current = null; };

  const frameAspect = mode === 'slip' ? '210 / 297' : '85.6 / 54';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, background: '#000',
      display: 'flex', flexDirection: 'column', userSelect: 'none',
    }}>
      {/* ── TOP HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={btnStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
        </button>

        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, textAlign: 'center' }}>
          {mode === 'slip' ? 'Scan Slip' : `Scan Cheque — ${position === 'front' ? 'Front' : 'Back'}`}
        </div>

        <button onClick={() => setShowSettings(s => !s)} style={btnStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>tune</span>
        </button>
      </div>

      {/* ── CAMERA AREA ── */}
      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoom})`,
            filter: `brightness(${brightness}%)`,
            display: cameraState === 'live' ? 'block' : 'none',
          }}
        />

        {/* Starting spinner */}
        {cameraState === 'starting' && (
          <div style={centerFlex}>
            <div style={{ color: '#fff', fontSize: 14, opacity: 0.7 }}>Starting camera…</div>
          </div>
        )}

        {/* Error */}
        {cameraState === 'error' && (
          <div style={{ ...centerFlex, flexDirection: 'column', gap: 16, padding: 24 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#f87171' }}>no_photography</span>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, textAlign: 'center' }}>
              Camera not available
            </div>
            <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
              Allow camera access in your browser settings, or upload from your gallery.
            </div>
            <button
              onClick={openGallery}
              style={{
                marginTop: 8, padding: '12px 24px',
                background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>photo_library</span>
              Upload from Gallery
            </button>
          </div>
        )}

        {/* Document frame guide */}
        {cameraState === 'live' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              aspectRatio: frameAspect,
              maxWidth: '85%', maxHeight: '80%',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
              position: 'relative',
            }}>
              {/* Corner markers only */}
              {[
                { top: -2, left: -2, borderTop: '4px solid #fff', borderLeft: '4px solid #fff' },
                { top: -2, right: -2, borderTop: '4px solid #fff', borderRight: '4px solid #fff' },
                { bottom: -2, left: -2, borderBottom: '4px solid #fff', borderLeft: '4px solid #fff' },
                { bottom: -2, right: -2, borderBottom: '4px solid #fff', borderRight: '4px solid #fff' },
              ].map((s, i) => (
                <div key={i} style={{
                  position: 'absolute', width: 24, height: 24, ...s, borderRadius: 4,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
        padding: '16px 24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: 16,
      }}>
        {/* Gallery button */}
        <button onClick={openGallery} style={{ ...btnStyle, width: 48, height: 48 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>photo_library</span>
        </button>

        {/* Capture shutter */}
        <button
          onClick={capturePhoto}
          disabled={cameraState !== 'live' || capturing}
          style={{
            width: 68, height: 68,
            borderRadius: '50%',
            background: capturing ? '#9ca3af' : '#fff',
            border: '4px solid rgba(255,255,255,0.4)',
            boxShadow: '0 0 0 2px #3b82f6, 0 4px 16px rgba(0,0,0,0.4)',
            cursor: cameraState !== 'live' ? 'not-allowed' : 'pointer',
            flexShrink: 0, transition: 'background 0.1s',
          }}
        />

        {/* Flip camera */}
        <button onClick={flipCamera} style={{ ...btnStyle, width: 48, height: 48 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>flip_camera_android</span>
        </button>
      </div>

      {/* ── SETTINGS SHEET ── */}
      {showSettings && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 90,
          background: 'rgba(15,15,15,0.97)',
          backdropFilter: 'blur(12px)',
          borderRadius: '20px 20px 0 0',
          padding: '8px 20px 40px',
          maxHeight: '60vh', overflowY: 'auto',
        }}>
          {/* Handle */}
          <div style={{ width: 36, height: 4, background: '#444', borderRadius: 2, margin: '8px auto 20px' }} />

          {/* Brightness */}
          <SettingRow icon="light_mode" label={`Brightness ${brightness}%`}>
            <input type="range" min={60} max={160} step={5} value={brightness}
              onChange={e => setBrightness(+e.target.value)}
              style={{ width: '100%', accentColor: '#3b82f6', marginTop: 6 }} />
          </SettingRow>

          {/* Zoom */}
          <SettingRow icon="zoom_in" label={`Zoom ${zoom.toFixed(1)}×`}>
            <input type="range" min={1} max={3} step={0.1} value={zoom}
              onChange={e => setZoom(+e.target.value)}
              style={{ width: '100%', accentColor: '#3b82f6', marginTop: 6 }} />
          </SettingRow>

          {/* Camera select (if multiple) */}
          {cameras.length > 1 && (
            <SettingRow icon="camera_alt" label="Camera">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {cameras.map((cam, i) => (
                  <button key={cam.deviceId} onClick={() => switchCamera(cam.deviceId)}
                    style={{
                      padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                      background: cam.deviceId === activeCameraId ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                      color: '#fff', border: 'none', fontSize: 13, fontWeight: 500,
                    }}>
                    {cam.label || `Camera ${i + 1}`}
                  </button>
                ))}
              </div>
            </SettingRow>
          )}

          {/* Front/back for cheque */}
          {mode === 'cheque' && (
            <SettingRow icon="flip" label="Cheque side">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                {(['front', 'back'] as const).map(p => (
                  <button key={p} onClick={() => { setPosition(p); setShowSettings(false); }}
                    style={{
                      padding: '10px', borderRadius: 10, cursor: 'pointer',
                      background: position === p ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                      color: '#fff', border: 'none', fontSize: 14, fontWeight: 600,
                      textTransform: 'capitalize',
                    }}>{p}</button>
                ))}
              </div>
            </SettingRow>
          )}

          <button onClick={() => setShowSettings(false)} style={{
            width: '100%', marginTop: 12, padding: '12px',
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Done</button>
        </div>
      )}

      {/* Hidden canvas + gallery input */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <input ref={galleryRef} type="file" accept="image/*" capture={undefined}
        style={{ display: 'none' }} onChange={onGalleryFile} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTouchDist(touches: React.TouchList) {
  return Math.hypot(
    touches[1].clientX - touches[0].clientX,
    touches[1].clientY - touches[0].clientY
  );
}

function SettingRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>{icon}</span>
        <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(4px)', flexShrink: 0,
};

const centerFlex: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
