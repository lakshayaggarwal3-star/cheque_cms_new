// =============================================================================
// File        : CameraCapture.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Reusable camera capture component for slip (1 image) and cheque (2 images).
//               Works in both mock and real camera modes.
// Created     : 2026-04-17
// =============================================================================

import React, { useRef, useState } from 'react';

interface CameraCaptureProps {
  mode: 'slip' | 'cheque';
  isMockMode?: boolean;
  onCaptureFront: (file: File) => void;
  onCaptureBack?: (file: File) => void;
  onCaptureBoth?: (front: File, back: File) => void;
  frontPreview?: string | null;
  backPreview?: string | null;
  disabled?: boolean;
}

export function CameraCapture({
  mode,
  isMockMode = false,
  onCaptureFront,
  onCaptureBack,
  onCaptureBoth,
  frontPreview,
  backPreview,
  disabled = false,
}: CameraCaptureProps) {
  const [capturing, setCapturing] = useState(false);
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  const isSlip = mode === 'slip';
  const isCheque = mode === 'cheque';

  const handleFrontFile = (file?: File | null) => {
    if (!file) return;
    onCaptureFront(file);
  };

  const handleBackFile = (file?: File | null) => {
    if (!file) return;
    onCaptureBack?.(file);
  };

  const handleCaptureBoth = async () => {
    if (!onCaptureBoth) return;
    setCapturing(true);
    try {
      // Trigger front camera
      const frontPromise = new Promise<File>((resolve) => {
        const handler = (e: Event) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          if (file) {
            handleFrontFile(file);
            resolve(file);
          }
          frontInputRef.current?.removeEventListener('change', handler);
        };
        frontInputRef.current?.addEventListener('change', handler);
        frontInputRef.current?.click();
      });

      // Wait a bit for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger back camera
      const backPromise = new Promise<File>((resolve) => {
        const handler = (e: Event) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          if (file) {
            handleBackFile(file);
            resolve(file);
          }
          backInputRef.current?.removeEventListener('change', handler);
        };
        backInputRef.current?.addEventListener('change', handler);
        backInputRef.current?.click();
      });

      const [front, back] = await Promise.all([frontPromise, backPromise]);
      onCaptureBoth(front, back);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden file inputs with camera capture */}
      <input
        ref={frontInputRef}
        id="camera-front"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFrontFile(e.target.files?.[0])}
        className="hidden"
      />
      
      {isCheque && (
        <input
          ref={backInputRef}
          id="camera-back"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleBackFile(e.target.files?.[0])}
          className="hidden"
        />
      )}

      {/* Front Image Capture */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">
          {isSlip ? 'Slip Image' : 'Front Image'}
          {isMockMode && <span className="ml-1 text-orange-600">(Mock)</span>}
        </label>
        
        <button
          type="button"
          onClick={() => frontInputRef.current?.click()}
          disabled={disabled || capturing}
          className="w-full border-2 border-blue-300 text-blue-700 py-2.5 rounded-lg text-sm 
            font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {frontPreview ? 'Retake' : 'Capture'} {isSlip ? 'Slip' : 'Front'} Image
        </button>

        {/* Front Preview */}
        {frontPreview && (
          <div className="relative">
            <img 
              src={frontPreview} 
              alt="Front preview" 
              className="w-full max-h-64 object-contain bg-gray-50 rounded-lg border-2 border-green-200" 
            />
            <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              ✓ Captured
            </span>
          </div>
        )}
      </div>

      {/* Back Image Capture (Cheque only) */}
      {isCheque && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            Back Image
            {isMockMode && <span className="ml-1 text-orange-600">(Mock)</span>}
          </label>
          
          <button
            type="button"
            onClick={() => backInputRef.current?.click()}
            disabled={disabled || capturing}
            className="w-full border-2 border-blue-300 text-blue-700 py-2.5 rounded-lg text-sm 
              font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {backPreview ? 'Retake' : 'Capture'} Back Image
          </button>

          {/* Back Preview */}
          {backPreview && (
            <div className="relative">
              <img 
                src={backPreview} 
                alt="Back preview" 
                className="w-full max-h-64 object-contain bg-gray-50 rounded-lg border-2 border-green-200" 
              />
              <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                ✓ Captured
              </span>
            </div>
          )}
        </div>
      )}

      {/* Capture Both Button (Cheque only, optional) */}
      {isCheque && onCaptureBoth && (
        <button
          type="button"
          onClick={handleCaptureBoth}
          disabled={disabled || capturing}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg 
            text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 
            disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {capturing ? 'Capturing...' : 'Capture Both (Front + Back)'}
        </button>
      )}
    </div>
  );
}
