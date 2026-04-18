// =============================================================================
// File        : SlipFormModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : Slip entry modal — always shown first per slip regardless of WithSlip mode.
// Created     : 2026-04-17
// =============================================================================

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { createSlipEntry, getClientsByLocation } from '../services/slipService';
import { toast } from '../store/toastStore';
import type { SlipEntryDto, ClientAutoFillDto } from '../types';

interface SlipForm {
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
  onSaved: (slip: SlipEntryDto) => void;
}

export function SlipFormModal({ batchId, defaultPickupPoint, onClose, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientStatusWarning, setClientStatusWarning] = useState<string | null>(null);
  const [availableClients, setAvailableClients] = useState<ClientAutoFillDto[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SlipForm>();

  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoadingClients(true);
        const clients = await getClientsByLocation();
        setAvailableClients(clients.sort((a, b) => {
          const aActive = a.status !== 'X';
          const bActive = b.status !== 'X';
          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;
          return a.clientName.localeCompare(b.clientName);
        }));
      } catch {
        toast.warning('Could not load available clients');
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
    if (defaultPickupPoint) setValue('pickupPoint', defaultPickupPoint);
  }, [batchId, defaultPickupPoint, setValue]);

  const filteredClients = availableClients
    .filter(c => {
      if (!clientSearchTerm) return true;
      const term = clientSearchTerm.toLowerCase();
      return (
        c.clientName.toLowerCase().includes(term) ||
        c.rcmsCode?.toLowerCase().includes(term) ||
        c.pickupPointCode?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (!clientSearchTerm) return 0;
      const term = clientSearchTerm.toLowerCase();
      const aFirst = a.clientName.toLowerCase().startsWith(term) || a.rcmsCode?.toLowerCase().startsWith(term);
      const bFirst = b.clientName.toLowerCase().startsWith(term) || b.rcmsCode?.toLowerCase().startsWith(term);
      if (aFirst && !bFirst) return -1;
      if (!aFirst && bFirst) return 1;
      return 0;
    });

  const handleClientSelect = (client: ClientAutoFillDto) => {
    setValue('clientCode', client.rcmsCode || '');
    setValue('clientName', client.clientName);
    const pickupDisplay = client.pickupPointCode
      ? `${client.cityCode} (${client.pickupPointCode} - ${client.pickupPointDesc || ''})`
      : client.cityCode || '';
    setValue('pickupPoint', pickupDisplay);
    setClientSearchTerm(`${client.clientName} (${client.rcmsCode})`);
    setShowClientDropdown(false);
    setClientStatusWarning(client.status === 'X' ? 'Client status is INACTIVE (X)' : null);
  };

  const onSubmit = async (data: SlipForm) => {
    setSubmitting(true);
    try {
      const slip = await createSlipEntry({
        batchId,
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
      toast.error(err?.response?.data?.message ?? 'Failed to save slip entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <div className="p-6 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Slip Entry</h2>
            <p className="text-xs text-gray-500 mt-0.5">Slip No will be auto-generated on save</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 pt-4 overflow-y-auto min-h-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">

              {/* Deposit Slip No */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Deposit Slip No <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('depositSlipNo', { required: 'Required' })}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.depositSlipNo && <p className="text-red-500 text-xs mt-1">{errors.depositSlipNo.message}</p>}
              </div>

              {/* Client search */}
              <div className="col-span-2 sm:col-span-1 relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Client Code (RCMS) {loadingClients && <span className="text-blue-400">(loading…)</span>}
                </label>
                <input
                  type="text"
                  value={clientSearchTerm}
                  onChange={e => {
                    setClientSearchTerm(e.target.value);
                    setShowClientDropdown(true);
                    setValue('clientCode', '');
                    setValue('clientName', '');
                    setValue('pickupPoint', '');
                    setClientStatusWarning(null);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  placeholder="Type to search clients…"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {clientStatusWarning && (
                  <p className="text-orange-600 text-xs mt-1">⚠ {clientStatusWarning}</p>
                )}
                {showClientDropdown && filteredClients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {filteredClients.map(client => (
                      <div
                        key={client.rcmsCode}
                        onMouseDown={e => { e.preventDefault(); handleClientSelect(client); }}
                        className="px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${client.status === 'X' ? 'bg-orange-500' : 'bg-green-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{client.clientName}</div>
                          <div className="text-xs text-gray-500">{client.rcmsCode} {client.pickupPointCode && `• ${client.pickupPointCode}`}</div>
                        </div>
                        {client.status === 'X' && <span className="text-xs text-orange-600 font-medium shrink-0">Inactive</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Name (read-only display) */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
                <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-900 min-h-[38px]">
                  {watch('clientName')
                    ? <span>{watch('clientName')}</span>
                    : <span className="text-gray-400">—</span>}
                </div>
              </div>

              {/* Pickup Point (read-only display) */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Pickup Point</label>
                <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-900 min-h-[38px]">
                  {watch('pickupPoint') || <span className="text-gray-400">—</span>}
                </div>
              </div>

              {/* Total Instruments + Slip Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Instruments <span className="text-red-500">*</span></label>
                <input
                  {...register('totalInstruments', { required: 'Required', min: { value: 1, message: '>0' } })}
                  type="number" min="1"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.totalInstruments && <p className="text-red-500 text-xs mt-1">{errors.totalInstruments.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Slip Amount (₹) <span className="text-red-500">*</span></label>
                <input
                  {...register('slipAmount', { required: 'Required', min: { value: 0.001, message: '>0' } })}
                  type="number" step="0.001" min="0"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors.slipAmount && <p className="text-red-500 text-xs mt-1">{errors.slipAmount.message}</p>}
              </div>

              {/* Remarks */}
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
                {submitting ? 'Saving…' : 'Save Slip Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
