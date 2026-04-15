// =============================================================================
// File        : BatchCreatePage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Batch creation form with location, scanner, clearing type, and PDC fields.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { getLocations, getScanners } from '../services/locationService';
import { createBatch } from '../services/batchService';
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
  totalSlips: string;
  totalAmount: string;
}

export function BatchCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [scanners, setScanners] = useState<ScannerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdBatch, setCreatedBatch] = useState<BatchDto | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BatchForm>({
    defaultValues: {
      locationID: user?.locationId?.toString() ?? '',
      batchDate: user?.eodDate ?? new Date().toISOString().slice(0, 10),
      clearingType: '01',
      isPDC: false,
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

  const onSubmit = async (data: BatchForm) => {
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
        totalSlips: parseInt(data.totalSlips),
        totalAmount: parseFloat(data.totalAmount),
      });
      setCreatedBatch(batch);
      toast.success(`Batch ${batch.batchNo} created successfully. Continue to Start Scanning.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Create New Batch</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in batch details to start scanning</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Point</label>
          <select
            {...register('pickupPointCode')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select pickup point</option>
            {locations.filter(l => l.isActive).map(l => (
              <option key={l.locationID} value={l.locationCode}>
                {l.locationName} ({l.locationCode})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Defaults to your location, but you can change it.</p>
        </div>

        {/* Total Slips + Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Slips *</label>
            <input
              {...register('totalSlips', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })}
              type="number"
              min="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.totalSlips && <p className="text-red-500 text-xs mt-1">{errors.totalSlips.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (₹) *</label>
            <input
              {...register('totalAmount', { required: 'Required', min: { value: 0.001, message: 'Must be > 0' } })}
              type="number"
              step="0.001"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.totalAmount && <p className="text-red-500 text-xs mt-1">{errors.totalAmount.message}</p>}
          </div>
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

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          PIF No, Summary Ref No and Batch No will be auto-generated after you click Create Batch.
        </div>

        {/* Create Batch button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Batch'}
          </button>
        </div>

        {/* Post-create success card */}
        {createdBatch && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-green-800">Batch created successfully</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-gray-500">Batch No</div>
                <div className="font-mono font-semibold text-gray-900 text-sm">{createdBatch.batchNo}</div>
                <div className="text-xs text-gray-400 mt-0.5">System-generated</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Summary Ref No</div>
                <div className="font-mono font-semibold text-gray-900 text-sm">{createdBatch.summRefNo}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">PIF No</div>
                <div className="font-mono font-semibold text-gray-900 text-sm">{createdBatch.pif}</div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate(`/scan/${createdBatch.batchID}`)}
                className="flex-1 bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
              >
                Start Scanning
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
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
