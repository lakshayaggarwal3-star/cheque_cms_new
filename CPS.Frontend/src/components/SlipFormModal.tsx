// =============================================================================
// File        : SlipFormModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Modal slip entry form with client code auto-fill from API.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { createSlip, getClientAutoFill, generateNextSlipNo, getClientsByLocation } from '../services/slipService';
import { toast } from '../store/toastStore';
import type { SlipDto, ClientAutoFillDto } from '../types';

interface SlipForm {
  slipNo: string;
  clientCode: string;
  clientName: string;
  depositSlipNo: string;
  pickupPoint: string;
  totalInstruments: string;
  slipAmount: string;
  remarks: string;
}

interface Props {
  batchId: number;
  defaultPickupPoint?: string;
  onClose: () => void;
  onSaved: (slip: SlipDto) => void;
}

export function SlipFormModal({ batchId, defaultPickupPoint, onClose, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [generatingSlipNo, setGeneratingSlipNo] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientStatusWarning, setClientStatusWarning] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [availableClients, setAvailableClients] = useState<ClientAutoFillDto[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SlipForm>();

  // Get user's location from session/storage (you may need to adjust this based on your auth setup)
  const userLocationId = sessionStorage.getItem('userLocationId');

  useEffect(() => {
    // Load available clients for location
    const loadClients = async () => {
      try {
        setLoadingClients(true);
        const clients = await getClientsByLocation();
        setAvailableClients(clients);
      } catch (err: any) {
        toast.warning('Could not load available clients');
        setAvailableClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    loadClients();

    if (defaultPickupPoint) {
      setValue('pickupPoint', defaultPickupPoint);
    }

    // Set placeholder for slip number - will be generated on submit
    setValue('slipNo', '(Auto-generated on save)');
  }, [batchId, defaultPickupPoint, setValue]);

  const handleClientCodeBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const code = e.target.value.trim().toUpperCase();
    if (!code) return;
    // Update the field value to uppercase for consistency
    e.target.value = code;
    setValue('clientCode', code);
    setAutoFilling(true);
    setClientStatusWarning(null);
    setLocationWarning(null);
    
    try {
      const data = await getClientAutoFill(code);
      if (data) {
        setValue('clientName', data.clientName);
        setValue('pickupPoint', data.pickupPointCode ?? '');
        
        // Check client status
        if (data.status === 'X') {
          setClientStatusWarning(`⚠️ Client status is INACTIVE (X)`);
        }
        
        // Check location match (compare city code with user's location)
        // Note: You may need to adjust this logic based on how location is stored
        if (userLocationId && data.cityCode) {
          // You might need to fetch location details to get the city code
          // For now, we'll just show the city code for manual verification
          setLocationWarning(`ℹ️ Client City Code: ${data.cityCode}`);
        }
      } else {
        toast.warning(`Client '${code}' not found in system`);
      }
    } finally {
      setAutoFilling(false);
    }
  };

  const onSubmit = async (data: SlipForm) => {
    setSubmitting(true);
    try {
      let slipNo = data.slipNo;

      // Generate slip number only when creating (if not yet generated)
      if (!slipNo || slipNo === '(Auto-generated on save)') {
        try {
          setGeneratingSlipNo(true);
          slipNo = await generateNextSlipNo(batchId);
          setGeneratingSlipNo(false);
        } catch (err: any) {
          toast.error(err?.response?.data?.message ?? 'Failed to generate Slip No');
          setSubmitting(false);
          return;
        }
      }

      const slip = await createSlip({
        batchID: batchId,
        slipNo: slipNo,
        clientCode: data.clientCode?.toUpperCase() || undefined,
        clientName: data.clientName || undefined,
        depositSlipNo: data.depositSlipNo || undefined,
        pickupPoint: data.pickupPoint || undefined,
        totalInstruments: parseInt(data.totalInstruments),
        slipAmount: parseFloat(data.slipAmount),
        remarks: data.remarks || undefined,
      });
      onSaved(slip);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save slip');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <div className="p-6 pb-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Slip Entry</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto min-h-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Slip No {generatingSlipNo && <span className="text-blue-500">(generating...)</span>}
                </label>
                <input
                  {...register('slipNo', { required: 'Required' })}
                  readOnly
                  className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:outline-none"
                />
                {errors.slipNo && <p className="text-red-500 text-xs mt-1">{errors.slipNo.message}</p>}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Deposit Slip No <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('depositSlipNo', { required: 'Deposit Slip No is required' })}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.depositSlipNo && <p className="text-red-500 text-xs mt-1">{errors.depositSlipNo.message}</p>}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Client Code (RCMS Code) {loadingClients && <span className="text-blue-500">(loading...)</span>}
                </label>
                <select
                  {...register('clientCode')}
                  onChange={(e) => {
                    const code = e.target.value;
                    setValue('clientCode', code);
                    if (code) {
                      // Find and populate client details
                      const client = availableClients.find(c => c.rcmsCode === code);
                      if (client) {
                        setValue('clientName', client.clientName);
                        // Format: CityCode (PickupCode - Description)
                        const pickupDisplay = client.pickupPointCode
                          ? `${client.cityCode} (${client.pickupPointCode} - ${client.pickupPointDesc || ''})`
                          : client.cityCode || '';
                        setValue('pickupPoint', pickupDisplay);
                        setClientStatusWarning(null);
                        if (client.status === 'X') {
                          setClientStatusWarning(`⚠️ Client status is INACTIVE (X)`);
                        }
                      }
                    } else {
                      setValue('clientName', '');
                      setValue('pickupPoint', '');
                      setClientStatusWarning(null);
                    }
                  }}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Select Client --</option>
                  {availableClients.map((client) => (
                    <option key={client.rcmsCode} value={client.rcmsCode}>
                      {client.clientName} ({client.rcmsCode})
                    </option>
                  ))}
                </select>
                {clientStatusWarning && (
                  <p className="text-orange-600 text-xs mt-1">{clientStatusWarning}</p>
                )}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
                <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-900">
                  {watch('clientName') ? (
                    <span>
                      {watch('clientName')} <span className="text-gray-600">({watch('clientCode') || 'N/A'})</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Pickup Point Code - Description</label>
                <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-900">
                  {watch('pickupPoint') ? (
                    <span>
                      {watch('pickupPoint')}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Instruments *</label>
                  <input
                    {...register('totalInstruments', { required: 'Required', min: { value: 1, message: '>0' } })}
                    type="number"
                    min="1"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.totalInstruments && <p className="text-red-500 text-xs mt-1">{errors.totalInstruments.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Slip Amount (₹) *</label>
                  <input
                    {...register('slipAmount', { required: 'Required', min: { value: 0.001, message: '>0' } })}
                    type="number"
                    step="0.001"
                    min="0"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.slipAmount && <p className="text-red-500 text-xs mt-1">{errors.slipAmount.message}</p>}
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  {...register('remarks')}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-blue-700 text-white py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Slip'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
