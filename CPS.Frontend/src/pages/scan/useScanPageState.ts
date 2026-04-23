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
  nextSlipScanOrder: number;
  setNextSlipScanOrder: React.Dispatch<React.SetStateAction<number>>;
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
  backFile: File | null;
  setBackFile: (f: File | null) => void;
  frontPreview: string | null;
  setFrontPreview: (v: string | null) => void;
  backPreview: string | null;
  setBackPreview: (v: string | null) => void;
  clearCameraFiles: () => void;

  // Image editor
  editorState: { file: File; target: EditableImageTarget; title: string } | null;
  setEditorState: (v: { file: File; target: EditableImageTarget; title: string } | null) => void;
  openImageEditor: (file: File, target: EditableImageTarget) => void;
  applyEditedImage: (target: EditableImageTarget, file: File, previewUrl: string) => void;

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
  makePanHandlers: (scrollRef: React.RefObject<HTMLDivElement | null>) => {
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
  const [nextSlipScanOrder, setNextSlipScanOrder] = useState(1);
  const [nextChqSeq, setNextChqSeq] = useState(1);
  const [newSlipSaved, setNewSlipSaved] = useState(false);

  // Scan step
  const [scanStep, setScanStep] = useState<ScanStep>('SlipEntry');
  const scanStepRef = useRef<ScanStep>('SlipEntry');
  scanStepRef.current = scanStep;

  // Camera / preview files
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const clearCameraFiles = useCallback(() => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setFrontFile(null); setBackFile(null);
    setFrontPreview(null); setBackPreview(null);
  }, [frontPreview, backPreview]);

  // Image editor
  const [editorState, setEditorState] = useState<{
    file: File; target: EditableImageTarget; title: string;
  } | null>(null);

  const openImageEditor = (file: File, target: EditableImageTarget) => {
    const titleMap: Record<EditableImageTarget, string> = {
      'slip-front': 'Edit slip image',
      'cheque-front': 'Edit cheque front image',
      'cheque-back': 'Edit cheque back image',
    };
    setEditorState({ file, target, title: titleMap[target] });
  };

  const applyEditedImage = (target: EditableImageTarget, file: File, previewUrl: string) => {
    if (target === 'slip-front' || target === 'cheque-front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file); setFrontPreview(previewUrl);
      return;
    }
    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackFile(file); setBackPreview(previewUrl);
  };

  // Cheque viewer
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pan / drag
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerFsRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const hasMoved = useRef(false);
  const [panning, setPanning] = useState(false);

  const makePanHandlers = (scrollRef: React.RefObject<HTMLDivElement | null>) => ({
    onMouseDown: (e: React.MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      hasMoved.current = false;
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
      setPanning(true);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!panRef.current.active) return;
      const el = scrollRef.current;
      if (!el) return;
      e.preventDefault();
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      el.scrollLeft = panRef.current.scrollLeft - dx;
      el.scrollTop = panRef.current.scrollTop - dy;
    },
    onMouseUp: () => { panRef.current.active = false; setPanning(false); },
    onMouseLeave: () => { panRef.current.active = false; setPanning(false); },
  });

  // Viewer override (click-to-view)
  const [viewerFront, setViewerFront] = useState<string | null>(null);
  const [viewerBack, setViewerBack] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);

  // UI layout
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState(false);

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
    nextSlipScanOrder, setNextSlipScanOrder,
    nextChqSeq, setNextChqSeq,
    newSlipSaved, setNewSlipSaved,
    scanStep, setScanStep,
    scanStepRef,
    frontFile, setFrontFile,
    backFile, setBackFile,
    frontPreview, setFrontPreview,
    backPreview, setBackPreview,
    clearCameraFiles,
    editorState, setEditorState,
    openImageEditor, applyEditedImage,
    flipped, setFlipped,
    zoom, setZoom,
    isFullscreen, setIsFullscreen,
    viewerRef, viewerFsRef, hasMoved,
    panning, makePanHandlers,
    viewerFront, setViewerFront,
    viewerBack, setViewerBack,
    viewerType, setViewerType,
    sidebarOpen, setSidebarOpen,
    expandedGroups, setExpandedGroups,
    completing, setCompleting,
    toImageSrc,
  };
}
