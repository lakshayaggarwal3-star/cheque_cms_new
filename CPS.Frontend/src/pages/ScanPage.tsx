// =============================================================================
// File        : ScanPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Thin orchestrator — wires together hooks and layout components.
//               All business logic lives in:
//                 pages/scan/useScanPageState.ts    — UI state
//                 pages/scan/useScanPageSession.ts  — session & step transitions
//               All layout lives in:
//                 pages/scan/ScanViewport.tsx
//                 pages/scan/ScanControlPanel.tsx
//                 pages/scan/ScanFullscreenOverlay.tsx
//                 pages/scan/ScanConfirmCompleteModal.tsx
// Created     : 2026-04-17
// Refactored  : 2026-04-22  (split into sub-module)
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { getImageUrl } from '../utils/imageUtils';
import { useSettingsStore } from '../store/settingsStore';
import { useScannerLogic } from '../hooks/useScannerLogic';
import { SlipFormModal } from '../components/SlipFormModal';
import { ImageEditModal } from '../components/ImageEditModal';
import {
  Pill, Icon, ScanItemsTable, ScannerSettingsModal,
} from '../components/scan';
import { uploadBulkSlipScans } from '../services/scanService';

import {
  useScanPageState,
  useScanPageSession,
  ScanViewport,
  ThumbnailSidebar,
  ScanControlPanel,
  ScanFullscreenOverlay,
  ScanConfirmCompleteModal,
} from './scan';


// ── ScanPage ──────────────────────────────────────────────────────────────────

// ── Upload Slip Images Panel ─────────────────────────────────────────────────

type UploadViewMode = 'grid' | 'preview';

interface UploadFile {
  file: File;
  previewUrl: string;
}

// ── ScanPage ──────────────────────────────────────────────────────────────────

export function ScanPage() {
  const { batchNo } = useParams<{ batchNo: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    mockScanEnabled,
    rangerMicrEnabled, setRangerMicrEnabled,
    rangerEndorsementEnabled, setRangerEndorsementEnabled,
    rangerEndorsementUseImageName, setRangerEndorsementUseImageName,
    rangerEndorsementCustomText, setRangerEndorsementCustomText,
    rangerEndorsementBatchName, setRangerEndorsementBatchName,
  } = useSettingsStore();

  // ── All UI state ────────────────────────────────────────────────────────────
  // ── Upload panel state ────────────────────────────────────────────────────
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadViewMode, setUploadViewMode] = useState<UploadViewMode>('grid');
  const [uploadPreviewIdx, setUploadPreviewIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const state = useScanPageState();

  const {
    id, session, batchDetails, loading,
    scanStep, setScanStep,
    activeSlipEntryId, activeSlipNo,
    nextSlipScanOrder, nextChqSeq, setNextChqSeq,
    frontFile, backFile, frontPreview, backPreview,
    flipped, setFlipped, zoom, setZoom,
    isFullscreen, setIsFullscreen,
    panning, hasMoved, viewerRef, viewerFsRef, makePanHandlers,
    viewerFront, setViewerFront, viewerBack, setViewerBack,
    viewerType, setViewerType,
    sidebarOpen, setSidebarOpen,
    expandedGroups, setExpandedGroups,
    completing,
    showSlipForm, setShowSlipForm,
    showScanSettings, setShowScanSettings,
    showTable, setShowTable,
    confirmComplete, setConfirmComplete,
    pickupPointCode,
    editorState, setEditorState,
    clearCameraFiles, openImageEditor, applyEditedImage,
    toImageSrc,
  } = state;

  // ── Scanner logic ───────────────────────────────────────────────────────────
  const scanner = useScannerLogic({
    batchId: id,
    batchNo: session?.batchNo || '',
    activeSlipEntryId,
    nextSlipScanOrder,
    nextChqSeq,
    mockScanEnabled,
    isDeveloper: user?.isDeveloper,
    rangerMicrEnabled,
    rangerEndorsementEnabled,
    rangerEndorsementUseImageName,
    rangerEndorsementCustomText,
    rangerEndorsementBatchName,
    onCaptureSuccess: async () => {
      setNextChqSeq(s => s + 1);
      setViewerFront(null);
      setViewerBack(null);
      setViewerType(null);
      await session_hooks.loadSession();
    },
    onClearCameraFiles: clearCameraFiles,
    frontFile,
    backFile,
    openImageEditor,
  });

  // ── Session logic ───────────────────────────────────────────────────────────
  const session_hooks = useScanPageSession({ state, scanner });

  // Clear viewer when scan step changes
  useEffect(() => {
    setViewerFront(null);
    setViewerBack(null);
    setViewerType(null);
  }, [scanStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init on mount
  useEffect(() => {
    if (!batchNo) { toast.error('Batch number not found'); return; }
    session_hooks.init(batchNo);
    scanner.autoInitScanner();
    return session_hooks.cleanup;
  }, [batchNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--fg-subtle)', fontSize: 'var(--text-sm)' }}>
        Loading scan session…
      </div>
    );
  }
  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
        Session not found
      </div>
    );
  }

  const withSlip = session.withSlip ?? false;
  const activeGroup = session.slipGroups.find(g => g.slipEntryId === activeSlipEntryId);
  const slipScansForActive = activeGroup?.slipScans ?? [];
  const isCurrentSlipScanDone = withSlip && slipScansForActive.length > 0;
  const canMoveToChequeScan = !withSlip || isCurrentSlipScanDone;

  const isSlipView = viewerType === 'slip' || (viewerType === null && scanStep === 'SlipScan');
  const viewItems = isSlipView ? slipScansForActive : (activeGroup?.cheques ?? []);
  const lastActiveItem = viewItems.length > 0 ? viewItems[viewItems.length - 1] as any : null;

  const previewFront = viewerFront
    ?? (lastActiveItem ? (isSlipView ? toImageSrc(lastActiveItem.imagePath) : toImageSrc(lastActiveItem.frontImagePath)) : null)
    ?? toImageSrc(scanner.currentCheque?.frontImagePath, scanner.mockPreview?.front)
    ?? toImageSrc(scanner.currentSlipScan?.imagePath, scanner.mockPreview?.front);

  const previewBack = viewerBack
    ?? (lastActiveItem && !isSlipView ? toImageSrc(lastActiveItem.backImagePath) : null)
    ?? toImageSrc(scanner.currentCheque?.backImagePath, scanner.mockPreview?.back);

  const currentViewIdx = (() => {
    if (!viewerFront) return viewItems.length;
    if (isSlipView) return (viewItems as any[]).findIndex(s => getImageUrl(s.imagePath) === viewerFront);
    return (viewItems as any[]).findIndex(c => getImageUrl(c.frontImagePath) === viewerFront);
  })();

  const handleNavLeft = () => {
    const idx = currentViewIdx === -1 ? viewItems.length : currentViewIdx;
    if (idx > 0) {
      const item = viewItems[idx - 1] as any;
      if (isSlipView) { setViewerFront(getImageUrl(item.imagePath)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }
      else { setViewerFront(getImageUrl(item.frontImagePath)); setViewerBack(item.backImagePath ? getImageUrl(item.backImagePath) : null); setViewerType('cheque'); setFlipped(false); }
    }
  };

  const handleNavRight = () => {
    const idx = currentViewIdx === -1 ? viewItems.length : currentViewIdx;
    if (idx < viewItems.length - 1) {
      const item = viewItems[idx + 1] as any;
      if (isSlipView) { setViewerFront(getImageUrl(item.imagePath)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }
      else { setViewerFront(getImageUrl(item.frontImagePath)); setViewerBack(item.backImagePath ? getImageUrl(item.backImagePath) : null); setViewerType('cheque'); setFlipped(false); }
    } else if (idx === viewItems.length - 1) {
      setViewerFront(null); setViewerBack(null); setViewerType(isSlipView ? 'slip' : 'cheque'); setFlipped(false);
    }
  };

  const handleSaveSettings = () => { scanner.handleSaveSettings(); setShowScanSettings(false); };

  // ── Upload panel handlers ────────────────────────────────────────────────
  const addUploadFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') || f.name.match(/\.(pdf|tif|tiff)$/i));
    const mapped: UploadFile[] = arr.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }));
    setUploadFiles(prev => [...prev, ...mapped]);
  };

  const removeUploadFile = (idx: number) => {
    setUploadFiles(prev => { URL.revokeObjectURL(prev[idx].previewUrl); return prev.filter((_, i) => i !== idx); });
    if (uploadPreviewIdx >= uploadFiles.length - 1) setUploadPreviewIdx(Math.max(0, uploadFiles.length - 2));
  };

  const handleUploadSubmit = async () => {
    if (uploadFiles.length === 0) { toast.error('No files selected.'); return; }
    setUploading(true);
    try {
      // Pass 0 if no active slip; the server will handle global batch association
      await uploadBulkSlipScans(id, activeSlipEntryId || 0, uploadFiles.map(f => f.file));
      toast.success(`${uploadFiles.length} slip image(s) uploaded globally to batch`);
      uploadFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
      setUploadFiles([]);
      setShowUploadPanel(false);
      session_hooks.loadSession();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Scan viewport (action bar + 3-column grid) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-raised)', flexShrink: 0, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <Pill icon="receipt_long" mono title="Batch Number" style={{ flex: '0 1 auto' }}>Batch: {session.batchNo}</Pill>
            <Pill icon="analytics" title="Summary Reference No" style={{ flex: '0 1 auto' }}>Sum Ref: {batchDetails?.summRefNo || '—'}</Pill>
            <Pill icon="apartment" title="Location" style={{ flex: '0 1 auto' }}>Loc:{batchDetails?.locationCode}</Pill>
            <Pill icon="account_tree" title="Cluster" style={{ flex: '0 1 auto' }}>Cluster: {batchDetails?.clusterCode || '—'}</Pill>
            <Pill icon="print" title="Scanner Code" style={{ flex: '0 1 auto' }}>Scanner ID: {batchDetails?.scannerID || '—'}</Pill>
            {batchDetails?.isPDC && <Pill icon="event_upcoming" title="PDC" style={{ flex: '0 1 auto' }}>PDC: True</Pill>}
          </div>

          <button
            onClick={() => setShowScanSettings(true)}
            className="btn-secondary"
            style={{ height: 32, padding: '0 12px', gap: 6, fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Icon name="tune" size={14} />
            Scanner settings
          </button>

          {!withSlip && (
            <button
              onClick={() => { setUploadFiles([]); setUploadViewMode('grid'); setShowUploadPanel(true); }}
              className="btn-secondary"
              style={{ height: 32, padding: '0 12px', gap: 6, fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderColor: 'var(--accent-400)', color: 'var(--accent-400)' }}
            >
              <Icon name="upload_file" size={14} />
              Upload Slip Images
            </button>
          )}

          {(() => {
            const incompleteSlips = session?.slipGroups?.filter(g => (g.slipScans?.length ?? 0) === 0) || [];
            const hasIncompleteSlips = incompleteSlips.length > 0;
            const activeSlipIncomplete = activeGroup ? activeGroup.cheques.length !== activeGroup.totalInstruments : false;
            
            let tooltip = undefined;
            if (activeSlipIncomplete && activeGroup) {
              tooltip = `Active slip needs ${activeGroup.totalInstruments} cheques (scanned ${activeGroup.cheques.length})`;
            } else if (hasIncompleteSlips) {
              tooltip = `Missing slip images for: ${incompleteSlips.map(s => s.depositSlipNo || s.slipNo).join(', ')}`;
            }

            return (
              <button
                onClick={() => setConfirmComplete('batch')}
                disabled={scanner.isBusy || completing || activeSlipIncomplete || hasIncompleteSlips}
                className="btn-primary"
                style={{ height: 32, padding: '0 14px', gap: 6, fontSize: 'var(--text-xs)' }}
                title={tooltip}
              >
                <Icon name="check" size={14} />
                {scanner.isBusy || completing ? 'Completing…' : 'Complete batch'}
              </button>
            );
          })()}
        </div>

        {/* ── 3-column grid (sidebar | viewer | controls) ──────────────── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: sidebarOpen ? '140px 1fr minmax(450px, 32%)' : '1fr minmax(450px, 32%)', minHeight: 0 }}>

          {/* Left: thumbnail sidebar */}
          <ThumbnailSidebar
            session={session}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            setViewerFront={setViewerFront}
            setViewerBack={setViewerBack}
            setViewerType={setViewerType}
            setFlipped={setFlipped}
          />

          {/* Center: image viewer */}
          <ScanViewport
            session={session}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            activeSlipEntryId={activeSlipEntryId}
            activeGroup={activeGroup}
            scanStep={scanStep}
            isSlipView={isSlipView}
            viewItems={viewItems}
            currentViewIdx={currentViewIdx}
            previewFront={previewFront}
            previewBack={previewBack}
            flipped={flipped}
            setFlipped={setFlipped}
            zoom={zoom}
            setZoom={setZoom}
            panning={panning}
            hasMoved={hasMoved}
            viewerRef={viewerRef}
            makePanHandlers={makePanHandlers}
            setViewerFront={setViewerFront}
            setViewerBack={setViewerBack}
            setViewerType={setViewerType}
            setIsFullscreen={setIsFullscreen}
            handleNavLeft={handleNavLeft}
            handleNavRight={handleNavRight}
            batchDate={batchDetails?.batchDate}
          />

          {/* Right: scan controls + recent sequences */}
          <ScanControlPanel
            session={session}
            scanner={scanner}
            scanStep={scanStep}
            activeSlipEntryId={activeSlipEntryId}
            activeGroup={activeGroup}
            slipScansForActive={slipScansForActive}
            canMoveToChequeScan={canMoveToChequeScan}
            withSlip={withSlip}
            isDeveloper={user?.isDeveloper}
            mockScanEnabled={mockScanEnabled}
            completing={completing}
            frontFile={frontFile}
            backFile={backFile}
            frontPreview={frontPreview}
            backPreview={backPreview}
            showTable={showTable}
            setShowTable={setShowTable}
            expandedGroups={expandedGroups}
            setExpandedGroups={setExpandedGroups}
            viewerFront={viewerFront}
            setViewerFront={setViewerFront}
            setViewerBack={setViewerBack}
            setViewerType={setViewerType}
            setFlipped={setFlipped}
            setActiveSlipEntryId={state.setActiveSlipEntryId}
            setScanStep={setScanStep}
            setShowSlipForm={setShowSlipForm}
            setConfirmComplete={setConfirmComplete}
            openImageEditor={openImageEditor}
            startNewSlip={() => session_hooks.startNewSlip(activeGroup)}
            onImageSelect={(front, back, type) => {
              setViewerFront(front);
              setViewerBack(back ?? null);
              setViewerType(type ?? null);
              setFlipped(false);
              setShowTable(false);
            }}
          />
        </div>

        {/* Scanned items table overlay */}
        {showTable && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ScanItemsTable
                session={session}
                onImageSelect={(front, back, type) => {
                  setViewerFront(front); setViewerBack(back ?? null); setViewerType(type ?? null);
                  setFlipped(false);
                  setIsFullscreen(true);
                }}
                onClose={() => setShowTable(false)}
                pickupPoint={pickupPointCode}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Upload Slip Images Panel ────────────────────────────────────── */}
      {showUploadPanel && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, display: 'flex', pointerEvents: 'none',
        }}>
          {/* Backdrop */}
          <div
            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', pointerEvents: 'all' }}
            onClick={() => !uploading && setShowUploadPanel(false)}
          />
          {/* Panel */}
          <div style={{
            width: 420, background: 'var(--bg-raised)', borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', pointerEvents: 'all', height: '100%',
          }}>
            {/* Panel Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="upload_file" size={18} style={{ color: 'var(--accent-500)' }} />
                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Upload Slip Images</span>
                {uploadFiles.length > 0 && (
                  <span style={{ fontSize: 10, padding: '2px 8px', background: 'var(--accent-bg)', color: 'var(--accent-500)', borderRadius: 'var(--r-full)', fontWeight: 700 }}>
                    {uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* View toggle */}
                {uploadFiles.length > 0 && (
                  <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', padding: 2, gap: 2 }}>
                    <button
                      onClick={() => setUploadViewMode('grid')}
                      style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', background: uploadViewMode === 'grid' ? 'var(--bg-raised)' : 'transparent', border: 'none', cursor: 'pointer', color: uploadViewMode === 'grid' ? 'var(--fg)' : 'var(--fg-faint)', display: 'flex', alignItems: 'center' }}
                      title="Grid view"
                    >
                      <Icon name="grid_view" size={16} />
                    </button>
                    <button
                      onClick={() => { setUploadViewMode('preview'); setUploadPreviewIdx(0); }}
                      style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', background: uploadViewMode === 'preview' ? 'var(--bg-raised)' : 'transparent', border: 'none', cursor: 'pointer', color: uploadViewMode === 'preview' ? 'var(--fg)' : 'var(--fg-faint)', display: 'flex', alignItems: 'center' }}
                      title="Preview view"
                    >
                      <Icon name="crop_original" size={16} />
                    </button>
                  </div>
                )}
                <button onClick={() => { if (!uploading) { uploadFiles.forEach(f => URL.revokeObjectURL(f.previewUrl)); setUploadFiles([]); setShowUploadPanel(false); } }} className="btn-ghost" style={{ color: 'var(--fg-faint)', padding: 4 }}>
                  <Icon name="close" size={20} />
                </button>
              </div>
            </div>

            {/* Upload button row */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="btn-secondary"
                style={{ flex: 1, height: 34, gap: 6, fontSize: 'var(--text-xs)' }}
              >
                <Icon name="add_photo_alternate" size={14} /> Add Images
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                hidden
                multiple
                accept="image/*,.pdf,.tif,.tiff"
                onChange={e => { if (e.target.files) addUploadFiles(e.target.files); e.target.value = ''; }}
              />
              {uploadFiles.length > 0 && (
                <button onClick={() => { uploadFiles.forEach(f => URL.revokeObjectURL(f.previewUrl)); setUploadFiles([]); }} className="btn-ghost" style={{ height: 34, color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>
                  Clear All
                </button>
              )}
            </div>

            {/* Drop Zone / Content */}
            <div
              style={{ flex: 1, overflow: 'auto', position: 'relative' }}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files) addUploadFiles(e.dataTransfer.files); }}
            >
              {isDragOver && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(var(--accent-500-rgb),0.12)', border: '2px dashed var(--accent-500)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-md)', margin: 12, pointerEvents: 'none' }}>
                  <span style={{ color: 'var(--accent-500)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>Drop images here</span>
                </div>
              )}

              {uploadFiles.length === 0 ? (
                /* Empty drop zone */
                <div
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, cursor: 'pointer' }}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="cloud_upload" size={32} style={{ color: 'var(--accent-400)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, margin: 0, color: 'var(--fg)' }}>Drag &amp; drop images here</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 4 }}>or click to browse • JPEG, PNG, TIFF, PDF</p>
                  </div>
                </div>
              ) : uploadViewMode === 'grid' ? (
                /* Grid view */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14 }}>
                  {uploadFiles.map((uf, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer' }} onClick={() => { setUploadPreviewIdx(i); setUploadViewMode('preview'); }}>
                      <img src={uf.previewUrl} alt={uf.file.name} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                      <div style={{ padding: '6px 8px', fontSize: 9, color: 'var(--fg-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uf.file.name}</div>
                      <button
                        onClick={e => { e.stopPropagation(); removeUploadFile(i); }}
                        style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                      >
                        <Icon name="close" size={12} />
                      </button>
                      <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{i + 1}</div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Preview view */
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <img
                      src={uploadFiles[uploadPreviewIdx]?.previewUrl}
                      alt="preview"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--r-md)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                    />
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => setUploadPreviewIdx(i => Math.max(0, i - 1))} disabled={uploadPreviewIdx === 0} className="btn-ghost" style={{ height: 28 }}><Icon name="chevron_left" size={18} /></button>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>{uploadPreviewIdx + 1} / {uploadFiles.length} — {uploadFiles[uploadPreviewIdx]?.file.name}</span>
                    <button onClick={() => setUploadPreviewIdx(i => Math.min(uploadFiles.length - 1, i + 1))} disabled={uploadPreviewIdx === uploadFiles.length - 1} className="btn-ghost" style={{ height: 28 }}><Icon name="chevron_right" size={18} /></button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', gap: 10 }}>
              <button onClick={() => { if (!uploading) { uploadFiles.forEach(f => URL.revokeObjectURL(f.previewUrl)); setUploadFiles([]); setShowUploadPanel(false); } }} className="btn-secondary" style={{ flex: 1, height: 36, fontSize: 'var(--text-xs)' }} disabled={uploading}>
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploadFiles.length === 0 || uploading}
                className="btn-primary"
                style={{ flex: 2, height: 36, fontSize: 'var(--text-xs)', gap: 6 }}
              >
                <Icon name="upload" size={14} />
                {uploading ? `Uploading ${uploadFiles.length} image(s)…` : `Upload ${uploadFiles.length} Image${uploadFiles.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen overlay ───────────────────────────────────────────── */}
      {isFullscreen && (
        <ScanFullscreenOverlay
          session={session}
          isSlipView={isSlipView}
          scanStep={scanStep}
          previewFront={previewFront}
          previewBack={previewBack}
          flipped={flipped}
          setFlipped={setFlipped}
          zoom={zoom}
          setZoom={setZoom}
          nextChqSeq={nextChqSeq}
          panning={panning}
          hasMoved={hasMoved}
          viewerFsRef={viewerFsRef}
          makePanHandlers={makePanHandlers}
          onClose={() => setIsFullscreen(false)}
        />
      )}

      {/* ── Scanner settings modal ───────────────────────────────────────── */}
      {showScanSettings && (
        <ScannerSettingsModal
          scanner={scanner}
          rangerWsUrl={scanner.rangerWsUrl}
          flatbedWsUrl={scanner.flatbedWsUrl}
          useFlatbedWs={scanner.useFlatbedWs}
          isDeveloper={!!user?.isDeveloper}
          flatbedConnecting={scanner.flatbedConnecting}
          detectedScanners={scanner.detectedScanners}
          selectedScannerId={scanner.selectedScannerId}
          flatbedResolution={scanner.flatbedResolution}
          flatbedMode={scanner.flatbedMode}
          flatbedFormat={scanner.flatbedFormat}
          rangerMicrEnabled={rangerMicrEnabled}
          rangerEndorsementEnabled={rangerEndorsementEnabled}
          rangerEndorsementUseImageName={rangerEndorsementUseImageName}
          rangerEndorsementCustomText={rangerEndorsementCustomText}
          rangerEndorsementBatchName={rangerEndorsementBatchName}
          onRangerUrlChange={scanner.setRangerWsUrl}
          onFlatbedUrlChange={scanner.setFlatbedWsUrl}
          onFlatbedWsToggle={scanner.setUseFlatbedWs}
          onDetectScanners={scanner.handleDetectScanners}
          onAutoSelect={scanner.handleAutoSelectScanner}
          onSelectScanner={scanner.setSelectedScannerId}
          onResolutionChange={scanner.setFlatbedResolution}
          onModeChange={scanner.setFlatbedMode}
          onFormatChange={scanner.setFlatbedFormat}
          onRangerMicrChange={setRangerMicrEnabled}
          onRangerEndorsementChange={setRangerEndorsementEnabled}
          onRangerEndorsementModeChange={setRangerEndorsementUseImageName}
          onRangerEndorsementTextChange={setRangerEndorsementCustomText}
          onRangerEndorsementBatchNameChange={setRangerEndorsementBatchName}
          onSave={handleSaveSettings}
          onClose={() => setShowScanSettings(false)}
        />
      )}

      {/* ── Slip form modal ──────────────────────────────────────────────── */}
      {showSlipForm && (
        <SlipFormModal
          batchId={id}
          defaultPickupPoint={pickupPointCode}
          existingSlips={session?.slipGroups}
          onClose={() => setShowSlipForm(false)}
          onSaved={slip => {
            setShowSlipForm(false);
            state.setNewSlipSaved(true);
            state.setActiveSlipEntryId(slip.slipEntryId);
            state.setActiveSlipNo(slip.slipNo);
            state.setNextSlipScanOrder(1);
            state.setNextChqSeq(1);
            if (withSlip) {
              session_hooks.moveToSlipScan();
              toast.success(`Slip ${slip.depositSlipNo || slip.slipNo} saved — scan slip images`);
            } else {
              session_hooks.moveToChequeScan(slip.slipEntryId);
              toast.success(`Slip ${slip.depositSlipNo || slip.slipNo} saved — scan cheques`);
            }
            session_hooks.loadSession();
          }}
        />
      )}

      {/* ── Image editor modal ───────────────────────────────────────────── */}
      {editorState && (
        <ImageEditModal
          file={editorState.file}
          title={editorState.title}
          onClose={() => setEditorState(null)}
          onSave={(file, previewUrl) => {
            applyEditedImage(editorState.target, file, previewUrl);
            setEditorState(null);
            toast.success('Edited image saved');
          }}
        />
      )}

      {/* ── Confirm complete modal ───────────────────────────────────────── */}
      {confirmComplete && (
        <ScanConfirmCompleteModal
          type={confirmComplete}
          onCancel={() => setConfirmComplete(null)}
          onConfirm={async () => {
            const type = confirmComplete;
            setConfirmComplete(null);
            if (type === 'slip') {
              await session_hooks.moveToChequeScan();
            } else if (type === 'cheque') {
              // Finish this slip's cheque phase and prepare for the next slip.
              await session_hooks.startNewSlip(activeGroup);
              toast.success('Slip scanning completed. Ready for next slip.');
            } else if (type === 'batch') {
              // Finalize the entire batch explicitly
              await scanner.handleCompleteScan(() => navigate('/'));
            }
          }}
        />
      )}
    </div>
  );
}
