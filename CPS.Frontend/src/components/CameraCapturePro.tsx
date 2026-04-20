// =============================================================================
// File        : CameraCapturePro.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Professional camera capture with zoom, brightness, menu options
// Created     : 2026-04-20
// =============================================================================

import { useEffect, useRef, useState } from 'react';

interface CameraCapturProProps {
  mode: 'slip' | 'cheque';
  onCapture: (file: File, position: 'front' | 'back') => void;
  onClose: () => void;
}

export function CameraCapturePro({ mode, onCapture, onClose }: CameraCapturProProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [position, setPosition] = useState<'front' | 'back'>('front');

  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    };

    getCameras();
  }, []);

  useEffect(() => {
    const startCamera = async () => {
      try {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Failed to start camera:', err);
      }
    };

    if (selectedCamera) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.filter = `brightness(${brightness}%)`;
        ctx.drawImage(videoRef.current, 0, 0);
        canvasRef.current.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `${position}-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file, position);
            setShowMenu(false);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    } else if (e.touches.length === 2) {
      // Pinch zoom start - store initial distance
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      dragStartRef.current.x = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setOffset({
        x: dragStartRef.current.offsetX + dx,
        y: dragStartRef.current.offsetY + dy,
      });
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const prevDist = dragStartRef.current.x;
      if (prevDist > 0) {
        const newZoom = Math.max(1, Math.min(3, zoom * (dist / prevDist)));
        setZoom(newZoom);
        dragStartRef.current.x = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Camera video */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`,
            filter: `brightness(${brightness}%)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease',
          }}
        />

        {/* Dashed frame guide */}
        <div style={{
          position: 'absolute',
          inset: '10%',
          border: '2px dashed rgba(255,255,255,0.3)',
          borderRadius: 12,
          pointerEvents: 'none',
        }} />

        {/* Corner menu button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 44,
            height: 44,
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            backdropFilter: 'blur(4px)',
          }}
        >
          ⋮
        </button>
      </div>

      {/* Bottom controls */}
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        padding: '12px 16px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(10px)',
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            borderRadius: 'var(--r-md)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
          }}
        >
          Close
        </button>

        <button
          onClick={handleCapture}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#3b82f6',
            border: '3px solid #fff',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
          }}
        />
      </div>

      {/* Menu panel */}
      {showMenu && (
        <div style={{
          position: 'absolute',
          top: 70,
          right: 16,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: 12,
          width: 280,
          zIndex: 71,
          maxHeight: '60vh',
          overflowY: 'auto',
        }}>
          {/* Camera selection */}
          {cameras.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 600 }}>
                Camera
              </label>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: 4,
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--fg)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {cameras.map(cam => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Zoom */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 600 }}>
              Zoom: {zoom.toFixed(1)}x
            </label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: 4,
                accentColor: 'var(--accent-500)',
              }}
            />
          </div>

          {/* Brightness */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 600 }}>
              Brightness: {brightness}%
            </label>
            <input
              type="range"
              min="50"
              max="150"
              step="5"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: 4,
                accentColor: 'var(--accent-500)',
              }}
            />
          </div>

          {/* Position selection (for cheque) */}
          {mode === 'cheque' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 600 }}>
                Position
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                <button
                  onClick={() => setPosition('front')}
                  style={{
                    padding: '8px',
                    background: position === 'front' ? 'var(--accent-500)' : 'var(--bg)',
                    color: position === 'front' ? 'var(--fg-on-accent)' : 'var(--fg)',
                    border: `1px solid ${position === 'front' ? 'var(--accent-600)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                  }}
                >
                  Front
                </button>
                <button
                  onClick={() => setPosition('back')}
                  style={{
                    padding: '8px',
                    background: position === 'back' ? 'var(--accent-500)' : 'var(--bg)',
                    color: position === 'back' ? 'var(--fg-on-accent)' : 'var(--fg)',
                    border: `1px solid ${position === 'back' ? 'var(--accent-600)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
