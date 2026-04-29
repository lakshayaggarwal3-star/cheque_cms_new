// =============================================================================
// File        : useScanPageState.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Hook that owns all ScanPage UI state and shared helpers
//               (viewer, camera files, pan/zoom, image editor).
// =============================================================================

import { useState, useRef, useCallback } from 'react';
import { getImageUrl } from '../../utils/imageUtils';
import { type ScanSessionDto } from '../../types';
import { ScanStep, EditableImageTarget } from './ScanPage.types';

// ── Return type ───────────────────────────────────────────────────────────────

export interface ScanPageState {
  // Session / batch
  id: number;
  setId: (id: number) => void;
  session: ScanSessionDto | null;
  setSession: (s: ScanSessionDto | null) => void;
  batchDetails: any;
  setBatchDetails: (b: any) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  pickupPointCode: string;
  setPickupPointCode: (v: string) => void;

  // Modals
  showSlipForm: boolean;
  setShowSlipForm: (v: boolean) => void;
  showScanSettings: boolean;
  setShowScanSettings: (v: boolean) => void;
  showStartModal: boolean;
  setShowStartModal: (v: boolean) => void;
  showTable: boolean;
  setShowTable: React.Dispatch<React.SetStateAction<boolean>>;
  confirmComplete: 'slip' | 'cheque' | 'batch' | null;
  setConfirmComplete: (v: 'slip' | 'cheque' | 'batch' | null) => void;

  // Active slip
  activeSlipEntryId: number | null;
  setActiveSlipEntryId: (v: number | null) => void;
  activeSlipNo: string;
  setActiveSlipNo: (v: string) => void;
  nextSlipItemOrder: number;
  setNextSlipItemOrder: React.Dispatch<React.SetStateAction<number>>;
  nextChqSeq: number;
  setNextChqSeq: React.Dispatch<React.SetStateAction<number>>;
  newSlipSaved: boolean;
  setNewSlipSaved: (v: boolean) => void;

  // Scan step
  scanStep: ScanStep;
  setScanStep: (v: ScanStep) => void;
  scanStepRef: React.RefObject<ScanStep>;

  // Camera / preview files
  frontFile: File | null;
  setFrontFile: (f: File | null) => void;
  frontFileOriginal: File | null;
  setFrontFileOriginal: (f: File | null) => void;
  backFile: File | null;
  setBackFile: (f: File | null) => void;
  backFileOriginal: File | null;
  setBackFileOriginal: (f: File | null) => void;
  frontPreview: string | null;
  setFrontPreview: (v: string | null) => void;
  backPreview: string | null;
  setBackPreview: (v: string | null) => void;
  frontBBox: string | null;
  backBBox: string | null;
  clearCameraFiles: () => void;

  // Image editor
  editorState: { file: File; target: EditableImageTarget; title: string; isSlip: boolean } | null;
  setEditorState: (v: { file: File; target: EditableImageTarget; title: string; isSlip: boolean } | null) => void;
  openImageEditor: (file: File, target: EditableImageTarget) => void;
  applyEditedImage: (target: string, file: File, previewUrl: string, originalFile?: File, corners?: any[]) => void;

  // Cheque viewer
  flipped: boolean;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;

  // Pan / drag
  viewerRef: React.RefObject<HTMLDivElement | null>;
  viewerFsRef: React.RefObject<HTMLDivElement | null>;
  hasMoved: React.RefObject<boolean>;
  panning: boolean;
  panOffset: { x: number; y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  fsPanOffset: { x: number; y: number };
  setFsPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  makePanHandlers: (setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>) => {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
  };

  // Viewer override (click-to-view)
  viewerFront: string | null;
  setViewerFront: (v: string | null) => void;
  viewerBack: string | null;
  setViewerBack: (v: string | null) => void;
  viewerType: string | null;
  setViewerType: (v: string | null) => void;

  // UI layout
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  expandedGroups: Record<string, boolean>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  completing: boolean;
  setCompleting: (v: boolean) => void;

  // Helpers
  toImageSrc: (path?: string, fallback?: string) => string | undefined;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useScanPageState(): ScanPageState {
  // Session / batch
  const [id, setId] = useState<number>(0);
  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pickupPointCode, setPickupPointCode] = useState('');

  // Modals
  const [showSlipForm, setShowSlipForm] = useState(false);
  const [showScanSettings, setShowScanSettings] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState<'slip' | 'cheque' | 'batch' | null>(null);

  // Active slip
  const [activeSlipEntryId, setActiveSlipEntryId] = useState<number | null>(null);
  const [activeSlipNo, setActiveSlipNo] = useState<string>('');
  const [nextSlipItemOrder, setNextSlipItemOrder] = useState(1);
  const [nextChqSeq, setNextChqSeq] = useState(1);
  const [newSlipSaved, setNewSlipSaved] = useState(false);

  // Scan step
  const [scanStep, setScanStep] = useState<ScanStep>('SlipEntry');
  const scanStepRef = useRef<ScanStep>('SlipEntry');
  scanStepRef.current = scanStep;

  // Camera / preview files
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontFileOriginal, setFrontFileOriginal] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backFileOriginal, setBackFileOriginal] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [frontBBox, setFrontBBox] = useState<string | null>(null);
  const [backBBox, setBackBBox] = useState<string | null>(null);

  const clearCameraFiles = useCallback(() => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setFrontFile(null); setFrontFileOriginal(null); setFrontBBox(null);
    setBackFile(null); setBackFileOriginal(null); setBackBBox(null);
    setFrontPreview(null); setBackPreview(null);
  }, [frontPreview, backPreview]);

  // Image editor
  const [editorState, setEditorState] = useState<{
    file: File; target: EditableImageTarget; title: string; isSlip: boolean;
  } | null>(null);

  const openImageEditor = (file: File, target: EditableImageTarget) => {
    const titleMap: Record<EditableImageTarget, string> = {
      'slip-front': 'Edit slip image',
      'cheque-front': 'Edit cheque front image',
      'cheque-back': 'Edit cheque back image',
    };
    const isSlip = target === 'slip-front';
    setEditorState({ file, target, title: titleMap[target], isSlip });
  };

  const applyEditedImage = useCallback((target: string, file: File, preview: string, original?: File, corners?: any[]) => {
    const bbox = corners ? JSON.stringify(corners) : null;
    if (target === 'cheque-front' || target === 'slip-front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file);
      setFrontPreview(preview);
      if (original) setFrontFileOriginal(original);
      if (bbox) setFrontBBox(bbox);
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackFile(file);
      setBackPreview(preview);
      if (original) setBackFileOriginal(original);
      if (bbox) setBackBBox(bbox);
    }
  }, [frontPreview, backPreview]);

  // Cheque viewer
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pan / drag
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerFsRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const hasMoved = useRef(false);
  const [panning, setPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [fsPanOffset, setFsPanOffset] = useState({ x: 0, y: 0 });

  const makePanHandlers = (setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>) => ({
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      panRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      hasMoved.current = false;
      setPanning(true);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!panRef.current.active) return;
      e.preventDefault();
      const dx = e.clientX - panRef.current.lastX;
      const dy = e.clientY - panRef.current.lastY;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    },
    onMouseUp: () => { panRef.current.active = false; setPanning(false); },
    onMouseLeave: () => { panRef.current.active = false; setPanning(false); },
  });

  // Viewer override (click-to-view)
  const [viewerFront, setViewerFront] = useState<string | null>(null);
  const [viewerBack, setViewerBack] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);

  // UI layout
  const [sidebarOpen, setSidebarOpenRaw] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState(false);

  // Reset zoom + pan whenever the thumbnail sidebar opens or closes so the
  // image fits the newly-available space without manual zoom-out.
  const setSidebarOpen = useCallback((v: boolean) => {
    setSidebarOpenRaw(v);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Helpers
  const toImageSrc = (path?: string, fallback?: string): string | undefined => {
    if (!path) return fallback;
    if (path.startsWith('data:')) return path;
    return getImageUrl(path);
  };

  return {
    id, setId,
    session, setSession,
    batchDetails, setBatchDetails,
    loading, setLoading,
    pickupPointCode, setPickupPointCode,
    showSlipForm, setShowSlipForm,
    showScanSettings, setShowScanSettings,
    showStartModal, setShowStartModal,
    showTable, setShowTable,
    confirmComplete, setConfirmComplete,
    activeSlipEntryId, setActiveSlipEntryId,
    activeSlipNo, setActiveSlipNo,
    nextSlipItemOrder, setNextSlipItemOrder,
    nextChqSeq, setNextChqSeq,
    newSlipSaved, setNewSlipSaved,
    scanStep, setScanStep,
    scanStepRef,
    frontFile, setFrontFile,
    frontFileOriginal, setFrontFileOriginal,
    backFile, setBackFile,
    backFileOriginal, setBackFileOriginal,
    frontPreview, setFrontPreview,
    backPreview, setBackPreview,
    frontBBox,
    backBBox,
    clearCameraFiles,
    editorState, setEditorState,
    openImageEditor, applyEditedImage,
    flipped, setFlipped,
    zoom, setZoom,
    isFullscreen, setIsFullscreen,
    viewerRef, viewerFsRef, hasMoved,
    panning, panOffset, setPanOffset, fsPanOffset, setFsPanOffset, makePanHandlers,
    viewerFront, setViewerFront,
    viewerBack, setViewerBack,
    viewerType, setViewerType,
    sidebarOpen, setSidebarOpen,
    expandedGroups, setExpandedGroups,
    completing, setCompleting,
    toImageSrc,
  };
}
