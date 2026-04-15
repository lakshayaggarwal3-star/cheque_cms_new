// =============================================================================
// File        : SlipFormModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Modal slip entry form with client code auto-fill from API.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { createSlip, getClientAutoFill } from '../services/slipService';
import { toast } from '../store/toastStore';
import type { SlipDto } from '../types';

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

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SlipForm>();

  useEffect(() => {
    if (defaultPickupPoint) {
      setValue('pickupPoint', defaultPickupPoint);
    }
  }, [defaultPickupPoint, setValue]);

  const handleClientCodeBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const code = e.target.value.trim();
    if (!code) return;
    setAutoFilling(true);
    try {
      const data = await getClientAutoFill(code);
      if (data) {
        setValue('clientName', data.clientName);
        setValue('pickupPoint', data.pickupPointCode ?? '');
      } else {
        toast.error(`Client '${code}' not found or inactive`);
      }
    } finally {
      setAutoFilling(false);
    }
  };

  const onSubmit = async (data: SlipForm) => {
    setSubmitting(true);
    try {
      const slip = await createSlip({
        batchID: batchId,
        slipNo: data.slipNo,
        clientCode: data.clientCode || undefined,
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Slip No *</label>
                <input
                  {...register('slipNo', { required: 'Required' })}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.slipNo && <p className="text-red-500 text-xs mt-1">{errors.slipNo.message}</p>}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Deposit Slip No</label>
                <input
                  {...register('depositSlipNo')}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Client Code (RCMS Code) {autoFilling && <span className="text-blue-500">(loading...)</span>}
                </label>
                <input
                  {...register('clientCode')}
                  onBlur={handleClientCodeBlur}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
                <input
                  {...register('clientName')}
                  readOnly
                  className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:outline-none"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Pickup Point</label>
                <input
                  {...register('pickupPoint')}
                  readOnly
                  className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:outline-none"
                />
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
