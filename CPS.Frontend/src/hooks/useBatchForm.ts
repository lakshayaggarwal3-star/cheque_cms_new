// =============================================================================
// File        : useBatchForm.ts
// Project     : CPS — Cheque Processing System
// Module      : Batch — Form Logic Hook
// Description : Custom hook for batch creation form state and logic
// Created     : 2026-04-19
// =============================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocations, getScanners } from '../services/locationService';
import { createBatch, updateBatch } from '../services/batchService';
import { setUserSetting } from '../services/userSettingService';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';
import type { LocationDto, ScannerDto } from '../types';

export function useBatchForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { entryMode: storedEntryMode, withSlipDefault, setWithSlipDefault } = useSettingsStore();

  const [scanners, setScanners] = useState<ScannerDto[]>([]);
  const [locationDetails, setLocationDetails] = useState<LocationDto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Entry Mode — driven by Settings; strictly follow roles
  const isDev = !!user?.isDeveloper;
  const isMobileScanner = !!user?.roles?.includes('Mobile Scanner');
  const isScanner = !!user?.roles?.includes('Scanner');
  const hasBothRoles = (isMobileScanner && isScanner) || isDev;

  const entryMode = useMemo(() => {
    if (isDev || hasBothRoles) return storedEntryMode;
    if (isMobileScanner) return 'mobile';
    return 'scanner';
  }, [isDev, hasBothRoles, isMobileScanner, storedEntryMode]);

  // Form State
  const [clearingType, setClearingType] = useState('03');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [summRefNo, setSummRefNo] = useState('');
  const [pif, setPif] = useState('');
  const [showHiddenFields, setShowHiddenFields] = useState(false);
  const [totalSlips, setTotalSlips] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  // Shared scan options
  const [scanType, setScanType] = useState<'Scan' | 'Rescan'>('Scan');
  const [withSlip, setWithSlip] = useState<'with' | 'without'>(withSlipDefault);
  const [pdc, setPdc] = useState(false);
  const [pdcDate, setPdcDate] = useState('');

  // Mobile Mode Modal state
  const [showMobileModal, setShowMobileModal] = useState(false);

  const activeScanner = scanners.find(s => s.isActive) ?? scanners[0];

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[parseInt(m) - 1]} ${y}`;
  };

  // Load scanners and location details
  useEffect(() => {
    if (!user?.locationId) return;
    getScanners(user.locationId).then(setScanners).catch(() => {});
    getLocations().then(locs => {
      const loc = locs.find(l => l.locationID === user.locationId);
      if (loc) setLocationDetails(loc);
    }).catch(() => {});
  }, [user?.locationId]);

  // Open mobile modal automatically when mobile mode is selected
  useEffect(() => {
    if (entryMode === 'mobile') {
      setShowMobileModal(true);
      setWithSlip('with');
      setShowHiddenFields(true);
    } else {
      setShowMobileModal(false);
      setShowHiddenFields(false);
    }
  }, [entryMode]);

  const handleModalFill = useCallback((data: { summ: string; pif: string; slips: string; amount: string }) => {
    setSummRefNo(data.summ);
    // In mobile mode: auto-fill PIF same as summRefNo initially
    setPif(data.pif || data.summ);
    setTotalSlips(data.slips);
    setTotalAmount(data.amount);
    setShowMobileModal(false);
  }, []);

  const handleCreateAndStart = useCallback(async () => {
    // Validate Scanner mode hidden fields if checked
    if (entryMode === 'scanner' && showHiddenFields) {
       if (!totalSlips || parseInt(totalSlips) <= 0) {
         toast.error('Total slips is required and must be > 0 when hidden fields are active');
         return;
       }
       if (!totalAmount || parseFloat(totalAmount) <= 0) {
         toast.error('Total amount is required and must be > 0 when hidden fields are active');
         return;
       }
    }

    if (pdc && !pdcDate) {
      toast.error('PDC Date is required');
      return;
    }

    if (!user?.locationId) return;
    if (!activeScanner) {
      toast.error('No active scanner found for your location');
      return;
    }

    setSubmitting(true);
    try {
      // Create initial batch (PIF = Summary Ref)
      const batch = await createBatch({
        locationID:       user.locationId,
        scannerMappingID: activeScanner.scannerMappingID,
        pickupPointCode:  locationDetails?.locationCode,
        batchDate:        batchDate,
        clearingType:     clearingType,
        isPDC:            pdc,
        pdcDate:          pdc ? pdcDate : undefined,
        totalSlips:       0,
        totalAmount:      0,
        summRefNo:        summRefNo || undefined,
        pif:              summRefNo || undefined,
      });

      // Update secondary fields including optional ones
      await updateBatch(batch.batchID, {
        totalSlips: (showHiddenFields || entryMode === 'mobile') && totalSlips ? parseInt(totalSlips) : 0,
        totalAmount: (showHiddenFields || entryMode === 'mobile') && totalAmount ? parseFloat(totalAmount) : 0,
        isPDC: pdc,
        pdcDate: pdc ? pdcDate : undefined,
        scanType,
        withSlip: withSlip === 'with',
        summRefNo: summRefNo || batch.summRefNo,
        pif: summRefNo || batch.pif,
      });

      // Persist WithSlip preference so next batch creation defaults to same choice
      setWithSlipDefault(withSlip);
      setUserSetting('WithSlip', withSlip === 'with' ? 'true' : 'false').catch(() => {});

      toast.success(`Batch ${batch.batchNo} created`);
      navigate(`/scan/${batch.batchNo}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  }, [entryMode, showHiddenFields, totalSlips, totalAmount, pdc, pdcDate, user?.locationId, activeScanner, locationDetails?.locationCode, batchDate, clearingType, summRefNo, pif, scanType, withSlip, setWithSlipDefault, navigate]);

  return {
    user,
    scanners,
    locationDetails,
    submitting,
    hasBothRoles,
    entryMode,
    clearingType,
    batchDate,
    summRefNo,
    pif,
    showHiddenFields,
    totalSlips,
    totalAmount,
    scanType,
    withSlip,
    pdc,
    pdcDate,
    showMobileModal,
    activeScanner,
    setShowMobileModal,
    setClearingType,
    setBatchDate,
    setSummRefNo,
    setPif,
    setShowHiddenFields,
    setTotalSlips,
    setTotalAmount,
    setScanType,
    setWithSlip,
    setPdc,
    setPdcDate,
    formatDate,
    handleModalFill,
    handleCreateAndStart,
  };
}
