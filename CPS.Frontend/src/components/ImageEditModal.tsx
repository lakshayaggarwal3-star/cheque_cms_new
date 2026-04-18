import { useEffect, useMemo, useState } from 'react';

interface ImageEditModalProps {
  file: File | null;
  title: string;
  onClose: () => void;
  onSave: (file: File, previewUrl: string) => void;
}

const OUTPUT_WIDTH = 1400;
const OUTPUT_HEIGHT = 900;

export function ImageEditModal({ file, title, onClose, onSave }: ImageEditModalProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setOffsetX(0);
    setOffsetY(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewStyle = useMemo(() => ({
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom}) rotate(${rotation}deg)`,
    filter: `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`,
  }), [brightness, contrast, grayscale, offsetX, offsetY, rotation, zoom]);

  if (!file || !sourceUrl) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const image = await loadImage(sourceUrl);
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
      ctx.translate(canvas.width / 2 + offsetX * 2, canvas.height / 2 + offsetY * 2);
      ctx.rotate((rotation * Math.PI) / 180);

      const coverScale = Math.max(canvas.width / image.width, canvas.height / image.height);
      const finalScale = coverScale * zoom;
      ctx.scale(finalScale, finalScale);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, file.type || 'image/jpeg', 0.92)
      );
      if (!blob) throw new Error('Could not save edited image');

      const editedFile = new File([blob], file.name, { type: blob.type || file.type || 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      onSave(editedFile, previewUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/75 p-4">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl lg:flex-row">
        <div className="flex flex-1 flex-col border-b border-slate-200 bg-slate-950 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-5 py-4 text-white">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-xs text-slate-300">Crop, resize, rotate, and adjust before saving.</p>
            </div>
            <button onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800">
              Close
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center p-4">
            <div className="relative aspect-[14/9] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-[linear-gradient(135deg,#111827,#0f172a)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_62%)]" />
              <div className="pointer-events-none absolute inset-6 rounded-[28px] border border-dashed border-white/35" />
              <div className="absolute inset-0 flex items-center justify-center">
                <img src={sourceUrl} alt="Editable preview" className="max-h-none max-w-none select-none object-contain" style={previewStyle} />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full space-y-5 overflow-y-auto bg-slate-50 p-5 lg:w-[360px]">
          <EditorSlider label="Zoom" min={1} max={2.5} step={0.05} value={zoom} onChange={setZoom} />
          <EditorSlider label="Rotate" min={-180} max={180} step={1} value={rotation} onChange={setRotation} suffix="deg" />
          <EditorSlider label="Brightness" min={60} max={160} step={1} value={brightness} onChange={setBrightness} suffix="%" />
          <EditorSlider label="Contrast" min={60} max={180} step={1} value={contrast} onChange={setContrast} suffix="%" />
          <EditorSlider label="Grayscale" min={0} max={100} step={1} value={grayscale} onChange={setGrayscale} suffix="%" />
          <EditorSlider label="Move Left / Right" min={-160} max={160} step={1} value={offsetX} onChange={setOffsetX} />
          <EditorSlider label="Move Up / Down" min={-160} max={160} step={1} value={offsetY} onChange={setOffsetY} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Quick reset</div>
            <p className="mt-1 text-xs text-slate-500">Use this if the user wants to start the edit again from the original photo.</p>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setBrightness(100);
                setContrast(100);
                setGrayscale(0);
                setOffsetX(0);
                setOffsetY(0);
              }}
              className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset adjustments
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-white">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save edited image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix = '',
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        <span className="text-xs font-medium text-slate-500">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-sky-700"
      />
    </label>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}
