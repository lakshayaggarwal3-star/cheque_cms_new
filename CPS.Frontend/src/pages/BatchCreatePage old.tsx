// =============================================================================
// File        : BatchCreatePage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Batch creation form with location, scanner, clearing type, and PDC fields.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { getLocations, getScanners } from '../services/locationService';
import { createBatch, getBatch, updateBatch } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import type { BatchDto, LocationDto, ScannerDto } from '../types';

interface BatchForm {
  locationID: string;
  scannerMappingID: string;
  pickupPointCode: string;
  batchDate: string;
  clearingType: string;
  isPDC: boolean;
  pdcDate: string;
  summRefNo: string;
  pif: string;
  totalSlips: string;
  totalAmount: string;
  scanType: string;
  withSlip: boolean;
}

export function BatchCreatePage() {
  const navigate = useNavigate();
  const { batchId: batchIdParam } = useParams<{ batchId: string }>();
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [scanners, setScanners] = useState<ScannerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdBatch, setCreatedBatch] = useState<BatchDto | null>(null);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [selectedScanType, setSelectedScanType] = useState<'Scan' | 'Rescan'>('Scan');
  const [selectedWithSlip, setSelectedWithSlip] = useState<boolean | null>(true);
  const [entryMode, setEntryMode] = useState<'scanner' | 'mobile' | null>(null);
  const [showHiddenFields, setShowHiddenFields] = useState(false);

  // Determine mode: 'create' or 'details'
  const mode = batchIdParam ? 'details' : 'create';

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BatchForm>({
    defaultValues: {
      locationID: user?.locationId?.toString() ?? '',
      batchDate: user?.eodDate ?? new Date().toISOString().slice(0, 10),
      clearingType: '01',
      isPDC: false,
      scanType: 'Scan',
      withSlip: false,
    }
  });

  const isPDC = watch('isPDC');
  const selectedLocation = watch('locationID');
  const selectedLocationDetails = locations.find(
    l => l.locationID === (selectedLocation ? parseInt(selectedLocation) : -1)
  );

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch(() => toast.error('Failed to load locations'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.locationId) return;
    setValue('locationID', user.locationId.toString(), { shouldValidate: true });
  }, [user?.locationId, setValue]);

  useEffect(() => {
    if (!selectedLocation) {
      setScanners([]);
      setValue('scannerMappingID', '', { shouldValidate: true });
      return;
    }

    getScanners(parseInt(selectedLocation))
      .then((list) => {
        setScanners(list);
        const preferred = list.find(s => s.isActive) ?? list[0];
        setValue('scannerMappingID', preferred ? preferred.scannerMappingID.toString() : '', { shouldValidate: true });
      })
      .catch(() => setScanners([]));
  }, [selectedLocation, setValue]);

  useEffect(() => {
    if (selectedLocationDetails?.locationCode) {
      setValue('pickupPointCode', selectedLocationDetails.locationCode, { shouldValidate: true });
    }
  }, [selectedLocationDetails?.locationCode, setValue]);

  // Determine entry mode based on user roles
  useEffect(() => {
    if (!user) return;
    const isScanner = user.roles.includes('Scanner');
    const isMobileScanner = user.roles.includes('MobileScanner');
    
    if (isScanner && isMobileScanner) {
      // User has both roles - will ask them to choose
      setEntryMode(null);
    } else if (isMobileScanner) {
      setEntryMode('mobile');
      setSelectedWithSlip(true); // Mobile mode always uses With Slip
    } else if (isScanner) {
      setEntryMode('scanner');
    }
  }, [user]);

  // Load existing batch data if in details mode
  useEffect(() => {
    if (mode === 'details' && batchIdParam) {
      const loadBatchDetails = async () => {
        try {
          const batchData = await getBatch(parseInt(batchIdParam));
          setCreatedBatch(batchData);
          setShowScanOptions(true);
          
          // Pre-fill form with batch data
          setValue('locationID', batchData.locationID.toString());
          setValue('scannerMappingID', batchData.scannerMappingID?.toString() || '');
          setValue('pickupPointCode', batchData.pickupPointCode || '');
          setValue('batchDate', batchData.batchDate);
          setValue('clearingType', batchData.clearingType);
          setValue('isPDC', batchData.isPDC);
          setValue('pdcDate', batchData.pdcDate || '');
          setValue('summRefNo', batchData.summRefNo || '');
          setValue('pif', batchData.pif || '');
          setValue('totalSlips', batchData.totalSlips > 0 ? batchData.totalSlips.toString() : '');
          setValue('totalAmount', batchData.totalAmount > 0 ? batchData.totalAmount.toString() : '');
          
          // Show hidden fields if they have values in details mode
          if (batchData.totalSlips > 0 || batchData.totalAmount > 0) {
            setShowHiddenFields(true);
          }
          
          // Pre-fill scan type and slip mode if they exist
          if (batchData.scanType) {
            setSelectedScanType(batchData.scanType as 'Scan' | 'Rescan');
          }
          if (batchData.withSlip !== null && batchData.withSlip !== undefined) {
            setSelectedWithSlip(batchData.withSlip);
          }
        } catch (err: any) {
          toast.error(err?.response?.data?.message ?? 'Failed to load batch details');
          navigate('/');
        } finally {
          setLoading(false);
        }
      };
      
      loadBatchDetails();
    }
  }, [mode, batchIdParam, setValue, navigate]);

  useEffect(() => {
    if (createdBatch && mode === 'create') {
      setValue('summRefNo', createdBatch.summRefNo || '');
      setValue('pif', createdBatch.pif || '');
    }
  }, [createdBatch, setValue, mode]);

  // Auto-fill PIF with SummRefNo value for mobile scanner mode
  const summRefNoValue = watch('summRefNo');
  useEffect(() => {
    if (entryMode === 'mobile' && summRefNoValue && mode === 'create') {
      setValue('pif', summRefNoValue);
    }
  }, [summRefNoValue, entryMode, setValue, mode]);

  const onSubmit = async (data: BatchForm) => {
    if (mode === 'create') {
      setSubmitting(true);
      try {
        const batch = await createBatch({
          locationID: parseInt(data.locationID),
          scannerMappingID: parseInt(data.scannerMappingID),
          pickupPointCode: data.pickupPointCode || undefined,
          batchDate: data.batchDate,
          clearingType: data.clearingType,
          isPDC: data.isPDC,
          pdcDate: data.isPDC ? data.pdcDate : undefined,
          totalSlips: 0,
          totalAmount: 0,
          entryMode: entryMode || 'scanner',
          // In mobile mode, SummRefNo and PIF will be provided after batch creation via update
          summRefNo: undefined,
          pif: undefined,
        });
        setCreatedBatch(batch);
        setShowScanOptions(true);
        toast.success(`Batch ${batch.batchNo} created successfully. Enter total slips and amount below.`);
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Failed to create batch');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSaveAndNavigate = async () => {
    if (!createdBatch) return;

    const totalSlipsStr = watch('totalSlips');
    const totalAmountStr = watch('totalAmount');
    const totalSlips = totalSlipsStr ? parseInt(totalSlipsStr) : 0;
    const totalAmount = totalAmountStr ? parseFloat(totalAmountStr) : 0;
    const isPDCValue = watch('isPDC');
    const pdcDateValue = watch('pdcDate');
    const summRefNoValue = watch('summRefNo');
    const pifValue = watch('pif');

    // Total Slips and Amount are REQUIRED in mobile mode, optional in scanner mode
    if (entryMode === 'mobile') {
      if (!totalSlipsStr || totalSlips <= 0) {
        toast.error('Total Slips is required in mobile scanner mode');
        return;
      }
      if (!totalAmountStr || totalAmount <= 0) {
        toast.error('Total Amount is required in mobile scanner mode');
        return;
      }
    } else {
      // In scanner mode, only validate if provided
      if (totalSlipsStr && totalSlips <= 0) {
        toast.error('Total Slips must be greater than 0 if provided');
        return;
      }
      if (totalAmountStr && totalAmount <= 0) {
        toast.error('Total Amount must be greater than 0 if provided');
        return;
      }
    }
    if (isPDCValue && !pdcDateValue) {
      toast.error('PDC Date is required');
      return;
    }
    if (!summRefNoValue?.trim()) {
      toast.error('Summary Ref No is required');
      return;
    }
    if (!pifValue?.trim()) {
      toast.error('PIF No is required');
      return;
    }
    if (selectedWithSlip === null) {
      toast.error('Please select With Slip or Without Slip mode');
      return;
    }

    setSubmitting(true);
    try {
      await updateBatch(createdBatch.batchID, {
        totalSlips,
        totalAmount,
        isPDC: isPDCValue,
        pdcDate: isPDCValue ? pdcDateValue : undefined,
        summRefNo: summRefNoValue,
        pif: pifValue,
        scanType: selectedScanType,
        withSlip: selectedWithSlip
      });
      toast.success('Batch details saved');
      navigate(`/scan/${createdBatch.batchID}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save batch details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!createdBatch) {
      navigate('/');
      return;
    }

    // Save data even on cancel
    const totalSlips = parseInt(watch('totalSlips') || '0');
    const totalAmount = parseFloat(watch('totalAmount') || '0');
    
    if (totalSlips > 0 && totalAmount > 0) {
      setSubmitting(true);
      try {
        await updateBatch(createdBatch.batchID, {
          totalSlips,
          totalAmount,
          isPDC: watch('isPDC'),
          pdcDate: watch('isPDC') ? watch('pdcDate') : undefined,
          summRefNo: watch('summRefNo'),
          pif: watch('pif')
        });
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Failed to save batch details');
      } finally {
        setSubmitting(false);
      }
    }
    
    navigate('/');
  };

  if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading...</div>;

  // Show entry mode selection if user has both roles
  if (mode === 'create' && user?.roles.includes('Scanner') && user?.roles.includes('MobileScanner') && entryMode === null && !createdBatch) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select Entry Mode</h2>
            <p className="text-sm text-gray-600">
              You have both Scanner and Mobile Scanner roles. How will you process this batch?
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setEntryMode('scanner')}
              className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="font-semibold text-gray-900 mb-1">🖥️ Scanner Mode</div>
              <div className="text-xs text-gray-600">
                SummRefNo and PIF are auto-generated by the system. Suitable for desktop scanner workflow.
              </div>
            </button>

            <button
              onClick={() => { setEntryMode('mobile'); setSelectedWithSlip(true); }}
              className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all"
            >
              <div className="font-semibold text-gray-900 mb-1">📱 Mobile Scanner Mode</div>
              <div className="text-xs text-gray-600">
                You manually type both SummRefNo and PIF. Nothing is auto-generated.
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {mode === 'details' ? 'Batch Details' : 'Create New Batch'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'details'
            ? 'Review and update batch details. All fields are editable.'
            : 'Fill in batch details to start scanning'}
        </p>
        {mode === 'details' && selectedLocationDetails && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Location:</span> {selectedLocationDetails.locationName}
            </p>
          </div>
        )}
        {mode === 'create' && entryMode && (
          <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            entryMode === 'mobile' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {entryMode === 'mobile' ? '📱 Mobile Scanner Mode' : '🖥️ Scanner Mode'}
            {(user?.roles.includes('Scanner') && user?.roles.includes('MobileScanner')) && (
              <button
                onClick={() => { setEntryMode(null); setCreatedBatch(null); }}
                className="ml-1 hover:underline"
              >
                (Change)
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-sm p-6 space-y-5">
        {/* Location + Scanner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <select
              {...register('locationID', { required: 'Location is required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select location</option>
              {locations.filter(l => l.isActive).map(l => (
                <option key={l.locationID} value={l.locationID}>{l.locationName}</option>
              ))}
            </select>
            {errors.locationID && <p className="text-red-500 text-xs mt-1">{errors.locationID.message}</p>}
            <p className="text-xs text-gray-500 mt-1">Defaults from your assigned location, but you can change it.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scanner *</label>
            <select
              {...register('scannerMappingID', { required: 'Scanner is required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select scanner</option>
              {scanners.filter(s => s.isActive).map(s => (
                <option key={s.scannerMappingID} value={s.scannerMappingID}>
                  {s.scannerID} {s.scannerModel ? `(${s.scannerModel})` : ''}
                </option>
              ))}
            </select>
            {errors.scannerMappingID && <p className="text-red-500 text-xs mt-1">{errors.scannerMappingID.message}</p>}
            <p className="text-xs text-gray-500 mt-1">Defaults to first active scanner for selected location.</p>
          </div>
        </div>

        {/* Batch Date + Clearing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch Date *</label>
            <input
              {...register('batchDate', { required: 'Batch date is required' })}
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.batchDate && <p className="text-red-500 text-xs mt-1">{errors.batchDate.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clearing Type *</label>
            <select
              {...register('clearingType', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="01">CTS (01)</option>
              <option value="11">Non-CTS (11)</option>
            </select>
          </div>
        </div>

        {/* Pickup Point */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location (Location Name - Location Code - Cluster Code)</label>
          <select
            {...register('pickupPointCode')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select pickup location</option>
            {locations.filter(l => l.isActive).map(l => (
              <option key={l.locationID} value={l.locationCode}>
                {l.locationName} ({l.locationCode}){l.clusterCode ? ` - ${l.clusterCode}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Shows: Location Name (Location Code) - Cluster Code. Defaults to your location.</p>
        </div>

        {/* PDC */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register('isPDC')}
              type="checkbox"
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">Post-Dated Cheque (PDC)</span>
          </label>

          {isPDC && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">PDC Date *</label>
              <input
                {...register('pdcDate', { required: isPDC ? 'PDC date is required' : false })}
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.pdcDate && <p className="text-red-500 text-xs mt-1">{errors.pdcDate.message}</p>}
            </div>
          )}
        </div>

        {/* Create Batch and Cancel Buttons */}
        {!createdBatch && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Batch'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Post-create success card */}
        {createdBatch && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-4">
            <p className="text-sm font-semibold text-green-800">Batch created successfully</p>
            
            {/* Batch Info (Non-editable) */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Batch No</label>
                <input
                  type="text"
                  value={createdBatch.batchNo}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono font-semibold"
                />
              </div>

              {/* SummRefNo and PIF - Editable */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Summary Ref No
                    {entryMode === 'mobile' && <span className="text-orange-600 ml-1">*</span>}
                  </label>
                  <input
                    {...register('summRefNo', { required: entryMode === 'mobile' ? 'Summary Ref No is required' : false })}
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={entryMode === 'mobile' ? "Enter manually" : "Auto-generated (editable)"}
                    readOnly={entryMode === 'scanner'}
                  />
                  {errors.summRefNo && <p className="text-red-500 text-xs mt-1">{errors.summRefNo.message}</p>}
                  {entryMode === 'scanner' && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      ℹ️ Auto-generated by system. You can edit if needed.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    PIF No
                    {entryMode === 'mobile' && <span className="text-orange-600 ml-1">*</span>}
                  </label>
                  <input
                    {...register('pif', { required: entryMode === 'mobile' ? 'PIF No is required' : false })}
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={entryMode === 'mobile' ? "Auto-filled from Summary Ref" : "Auto-generated (editable)"}
                    readOnly={entryMode === 'scanner'}
                  />
                  {errors.pif && <p className="text-red-500 text-xs mt-1">{errors.pif.message}</p>}
                  {entryMode === 'scanner' && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      ℹ️ Auto-generated by system. You can edit if needed.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Total Slips + Amount + PDC */}
            <div className="border-t border-green-200 pt-4 space-y-4">
              {/* Show hidden fields checkbox for scanner mode */}
              {entryMode === 'scanner' && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHiddenFields}
                      onChange={(e) => setShowHiddenFields(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Show hidden fields (Total Slips & Amount)</span>
                  </label>
                </div>
              )}

              {/* Total Slips and Amount - shown in mobile mode or when checkbox is checked in scanner mode */}
              {(entryMode === 'mobile' || showHiddenFields) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Slips
                      {entryMode === 'mobile' && <span className="text-orange-600 ml-1">*</span>}
                    </label>
                    <input
                      {...register('totalSlips', { 
                        required: entryMode === 'mobile' ? 'Required' : false,
                        min: { value: 1, message: 'Must be > 0' } 
                      })}
                      type="number"
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                    {errors.totalSlips && <p className="text-red-500 text-xs mt-1">{errors.totalSlips.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Amount (₹)
                      {entryMode === 'mobile' && <span className="text-orange-600 ml-1">*</span>}
                    </label>
                    <input
                      {...register('totalAmount', { 
                        required: entryMode === 'mobile' ? 'Required' : false,
                        min: { value: 0.001, message: 'Must be > 0' } 
                      })}
                      type="number"
                      step="0.001"
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                    {errors.totalAmount && <p className="text-red-500 text-xs mt-1">{errors.totalAmount.message}</p>}
                  </div>
                </div>
              )}

              {/* PDC - REMOVED FROM HERE, ONLY SHOW BEFORE CREATE BATCH */}

            </div>

            {/* Start Scanning Buttons */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scan Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedScanType('Scan')}
                    className={`py-2 rounded text-sm font-medium ${selectedScanType === 'Scan' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedScanType('Rescan')}
                    className={`py-2 rounded text-sm font-medium ${selectedScanType === 'Rescan' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    Rescan
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Slip Mode</label>
                {entryMode === 'mobile' ? (
                  <div className="py-2 px-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                    ✓ With Slip (Always enabled in mobile scanner mode)
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWithSlip(true)}
                      className={`py-2 rounded text-sm font-medium ${selectedWithSlip === true ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      With Slip
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWithSlip(false)}
                      className={`py-2 rounded text-sm font-medium ${selectedWithSlip === false ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      Without Slip
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleSaveAndNavigate}
                disabled={submitting}
                className="flex-1 bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Start Scanning'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

          </div>
        )}
      </form>
    </div>
  );
}
