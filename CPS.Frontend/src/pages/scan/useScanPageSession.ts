// =============================================================================
// File        : useScanPageSession.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Hook for session loading, initialisation and scan-step
//               transitions (SlipEntry → SlipScan → ChequeScan).
// =============================================================================

import { useCallback } from 'react';
import { getScanSession, startScan, completeSlipPhase, completeChequePhase } from '../../services/scanService';
import { getBatch, getBatchByNumber } from '../../services/batchService';
import { toast } from '../../store/toastStore';
import { BatchStatus, type ScanSessionDto } from '../../types';
import { ScanStep, sessionInitBatchIds } from './ScanPage.types';
import { type ScanPageState } from './useScanPageState';

interface Deps {
  state: ScanPageState;
  scanner: any;
}

export function useScanPageSession({ state, scanner }: Deps) {
  const {
    id, setId,
    setSession, setBatchDetails, setPickupPointCode,
    setLoading, setShowSlipForm, setShowStartModal,
    setActiveSlipEntryId, setActiveSlipNo,
    setNextSlipItemOrder, setNextChqSeq,
    setScanStep,
    setFrontFile, setFrontPreview,
    clearCameraFiles,
  } = state;

  // ── Load/refresh session ──────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    try {
      const [s, batch] = await Promise.all([getScanSession(id), getBatch(id)]);
      setSession(s);
      setBatchDetails(batch);
      setPickupPointCode(batch.pickupPointCode ?? '');
      const rs = s.resumeState;
      if (rs.activeSlipEntryId) {
        setActiveSlipEntryId(rs.activeSlipEntryId);
        setActiveSlipNo(rs.activeSlipNo ?? '');
        setNextSlipItemOrder(rs.nextSlipItemOrder);
        setNextChqSeq(rs.nextChqSeq);
      }
    } catch {
      toast.error('Failed to load scan session');
    } finally {
      setLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply resume state ────────────────────────────────────────────────────

  const applyResumeState = (s: ScanSessionDto, _withSlip: boolean) => {
    if (!sessionInitBatchIds.has(id)) sessionInitBatchIds.add(id);
    const rs = s.resumeState;
    if (rs.activeSlipEntryId) {
      setActiveSlipEntryId(rs.activeSlipEntryId);
      setActiveSlipNo(rs.activeSlipNo ?? '');
      setNextSlipItemOrder(rs.nextSlipItemOrder);
      setNextChqSeq(rs.nextChqSeq);
      const step = (rs.resumeStep as ScanStep) ?? 'SlipEntry';
      setScanStep(step);
      if (step === 'ChequeScan') scanner.setScannerChoice('Ranger');
    } else {
      setScanStep('SlipEntry');
      setShowSlipForm(true);
    }
  };

  // ── Initialise on mount (runs once per batchNo change) ───────────────────

  const init = async (batchNo: string) => {
    setLoading(true);
    setSession(null);
    setBatchDetails(null);
    try {
      const batch = await getBatchByNumber(batchNo);
      const batchId = batch.batchID;
      setId(batchId);

      const [s] = await Promise.all([getScanSession(batchId), Promise.resolve(batch)]);
      setSession(s);
      setBatchDetails(batch);
      setPickupPointCode(batch.pickupPointCode ?? '');

      const isStartable =
        s.batchStatus === BatchStatus.Created ||
        s.batchStatus === BatchStatus.ScanningPending ||
        s.batchStatus === BatchStatus.ScanningInProgress;

      if (isStartable) {
        try {
          await startScan(batchId, s.withSlip!, s.scanType || 'Scan');
          const fresh = await getScanSession(batchId);
          setSession(fresh);
          applyResumeState(fresh, s.withSlip!);
        } catch (err: any) {
          toast.error(err?.response?.data?.message ?? 'Failed to resume scan session');
          setShowStartModal(true);
        }
      } else {
        const rs = s.resumeState;
        if (rs.activeSlipEntryId) {
          setActiveSlipEntryId(rs.activeSlipEntryId);
          setActiveSlipNo(rs.activeSlipNo ?? '');
          setNextSlipItemOrder(rs.nextSlipItemOrder);
          setNextChqSeq(rs.nextChqSeq);
          setScanStep(rs.resumeStep as ScanStep ?? 'ChequeScan');
        }
      }
    } catch {
      toast.error('Failed to load scan session');
    } finally {
      setLoading(false);
    }
  };

  // ── Cleanup (called on unmount) ───────────────────────────────────────────

  const cleanup = () => {
    scanner.cleanup();
  };

  // ── Step transitions ──────────────────────────────────────────────────────

  const moveToSlipScan = () => {
    setScanStep('SlipScan');
    scanner.setScannerChoice(null);
    scanner.setScanRoundActive(false);
  };

  const moveToChequeScan = async (overrideId?: number) => {
    const targetId = overrideId ?? state.activeSlipEntryId;
    if (targetId === null) return;
    try {
      await completeSlipPhase(id, targetId);
      setScanStep('ChequeScan');
      scanner.setScannerChoice('Ranger');
      scanner.setScanRoundActive(false);
      setFrontFile(null);
      setFrontPreview(null);
    } catch {
      toast.error('Failed to complete slip scanning phase');
    }
  };

  const startNewSlip = async (activeGroup: any) => {
    const { activeSlipEntryId } = state;

    // Block if current slip has nothing scanned yet
    if (activeSlipEntryId !== null && activeGroup) {
      const hasScans = (activeGroup.slipItems?.length ?? 0) > 0 || (activeGroup.cheques?.length ?? 0) > 0;
      if (!hasScans) {
        toast.warning('Scan at least one item for the current slip before creating a new one.');
        return;
      }
      try {
        await completeChequePhase(id, activeSlipEntryId);
      } catch {
        toast.error('Failed to complete cheque scanning phase');
        return;
      }
    }

    // Refresh session so resumeState.activeSlipEntryId reflects null — without
    // this the stale value causes the "Viewing history" gate to fire instead of
    // showing the new "Slip entry required" prompt.
    try {
      const fresh = await getScanSession(id);
      setSession(fresh);
    } catch { /* non-critical — UI gate fix below handles it */ }

    state.setNewSlipSaved(false);
    setActiveSlipEntryId(null);
    setActiveSlipNo('');
    setNextSlipItemOrder(1);
    // nextChqSeq is now batch-wide, so we don't reset it here.
    setScanStep('SlipEntry');
    scanner.setScanRoundActive(false);
    scanner.setFeedRunning({ Cheque: false, Slip: false });
    scanner.setCurrentSlipScan(null);
    scanner.setCurrentCheque(null);
    scanner.setMockPreview(null);
    clearCameraFiles();
    setShowSlipForm(true);
  };

  return { loadSession, init, cleanup, applyResumeState, moveToSlipScan, moveToChequeScan, startNewSlip };
}
