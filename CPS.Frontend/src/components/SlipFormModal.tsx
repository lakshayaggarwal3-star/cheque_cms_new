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
  existingSlips?: SlipEntryDto[];
  onClose: () => void;
  onSaved: (slip: SlipEntryDto) => void;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >{name}</span>
  );
}

export function SlipFormModal({ batchId, defaultPickupPoint, existingSlips = [], onClose, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientStatusWarning, setClientStatusWarning] = useState<string | null>(null);
  const [priorityClientInfo, setPriorityClientInfo] = useState<ClientAutoFillDto | null>(null);
  const [showPriorityConfirm, setShowPriorityConfirm] = useState(false);
  
  const [availableClients, setAvailableClients] = useState<ClientAutoFillDto[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SlipForm>();

  // Check if current batch is already "Priority Locked"
  const prioritySlip = existingSlips.find(s => s.clientCode && availableClients.find(ac => ac.rcmsCode === s.clientCode)?.isPriority);
  const lockedGlobalId = prioritySlip ? availableClients.find(ac => ac.rcmsCode === prioritySlip.clientCode)?.globalClientID : null;
  const lockedGlobalCode = prioritySlip ? availableClients.find(ac => ac.rcmsCode === prioritySlip.clientCode)?.globalCode : null;

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

  const uniqueClientsMap = new Map<string, ClientAutoFillDto>();
  availableClients.forEach(c => {
    if (c.rcmsCode && !uniqueClientsMap.has(c.rcmsCode)) {
      uniqueClientsMap.set(c.rcmsCode, c);
    }
  });
  const uniqueClients = Array.from(uniqueClientsMap.values());

  const filteredClients = uniqueClients
    .filter(c => {
      if (!clientSearchTerm) return true;
      const term = clientSearchTerm.toLowerCase();
      return (
        c.rcmsCode?.toLowerCase().includes(term) ||
        c.clientName.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (!clientSearchTerm) return 0;
      const term = clientSearchTerm.toLowerCase();
      const aStarts = a.rcmsCode?.toLowerCase().startsWith(term) || a.clientName.toLowerCase().startsWith(term);
      const bStarts = b.rcmsCode?.toLowerCase().startsWith(term) || b.clientName.toLowerCase().startsWith(term);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });

  const handleClientSelect = (client: ClientAutoFillDto) => {
    // Enforcement Logic
    if (lockedGlobalId && client.globalClientID !== lockedGlobalId) {
      toast.error(`This batch is exclusive to Priority Client Group: ${lockedGlobalCode}. You cannot add other clients.`);
      return;
    }
    if (!lockedGlobalId && existingSlips.length > 0 && client.isPriority) {
      toast.error(`This is a Priority Client. They must be in their own unique batch. This batch already has other slips.`);
      return;
    }

    setValue('clientCode', client.rcmsCode || '');
    setValue('clientName', client.clientName);
    
    // Auto-select pickup point if only one exists for this client
    const points = availableClients.filter(c => c.rcmsCode === client.rcmsCode);
    if (points.length === 1) {
      const displayVal = points[0].pickupPointCode
        ? `${points[0].cityCode} (${points[0].pickupPointCode} - ${points[0].pickupPointDesc || ''})`
        : points[0].cityCode || '';
      setValue('pickupPoint', displayVal);
    } else {
      setValue('pickupPoint', '');
    }

    setClientSearchTerm(client.rcmsCode || '');
    setShowClientDropdown(false);
    setClientStatusWarning(client.status === 'X' ? 'Client status is INACTIVE (X)' : null);
    
    if (client.isPriority) {
      setPriorityClientInfo(client);
      setShowPriorityConfirm(true);
    } else {
      setPriorityClientInfo(null);
    }
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
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgb(0 0 0 / 55%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 60, padding: 16,
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: 560,
        maxHeight: 'calc(100dvh - 2rem)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-lg)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
              New deposit slip
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
              Slip number is assigned on save.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid transparent',
              borderRadius: 'var(--r-md)', cursor: 'pointer',
              color: 'var(--fg-muted)',
              transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-muted)'; }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px', overflowY: 'auto', minHeight: 0 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px' }}>

              {/* Deposit Slip No */}
              <div style={{ gridColumn: 'span 1' }}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Deposit Slip No <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  autoFocus
                  {...register('depositSlipNo', { required: 'Required' })}
                  className="input-field"
                />
                {errors.depositSlipNo && (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {errors.depositSlipNo.message}
                  </p>
                )}
              </div>

              {/* Client Code search */}
              <div style={{ gridColumn: 'span 1', position: 'relative' }}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>
                  Client Code (RCMS) <span style={{ color: 'var(--danger)' }}>*</span>
                  {loadingClients && (
                    <span style={{ color: 'var(--info)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
                      loading…
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--fg-subtle)', pointerEvents: 'none', display: 'flex',
                  }}>
                    <Icon name="search" size={16} />
                  </span>
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={e => {
                      const val = e.target.value;
                      setClientSearchTerm(val);
                      setShowClientDropdown(true);
                      setSelectedIndex(0);
                      setValue('clientCode', val);
                      setValue('clientName', '');
                      setValue('pickupPoint', '');
                      setClientStatusWarning(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedIndex(prev => Math.min(prev + 1, Math.max(0, filteredClients.length - 1)));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedIndex(prev => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (showClientDropdown && filteredClients.length > 0) {
                          handleClientSelect(filteredClients[selectedIndex]);
                        } else {
                          setValue('clientCode', clientSearchTerm);
                          setShowClientDropdown(false);
                        }
                        setTimeout(() => {
                          document.getElementById('pickupPointSelect')?.focus();
                        }, 0);
                      }
                    }}
                    onFocus={() => {
                      setShowClientDropdown(true);
                      setSelectedIndex(0);
                    }}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    placeholder="Type to search RCMS…"
                    className="input-field"
                    style={{ paddingLeft: 32 }}
                  />
                </div>
                {clientStatusWarning && (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="warning" size={13} /> {clientStatusWarning}
                  </p>
                )}
                {showClientDropdown && filteredClients.length > 0 && (
                  <div style={{
                    position: 'absolute', zIndex: 10, width: '100%', top: 'calc(100% + 4px)',
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    boxShadow: 'var(--shadow-md)',
                    maxHeight: 220, overflowY: 'auto',
                  }}>
                    {filteredClients.map((client, idx) => (
                      <div
                        key={client.rcmsCode}
                        onMouseDown={e => { e.preventDefault(); handleClientSelect(client); }}
                        style={{
                          padding: '9px 12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 10,
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background var(--dur-fast) var(--ease)',
                          background: selectedIndex === idx ? 'var(--bg-subtle)' : 'var(--bg-raised)',
                          borderLeft: selectedIndex === idx ? '3px solid var(--accent-500)' : '3px solid transparent',
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: client.status === 'X' ? 'var(--warning)' : 'var(--success)',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>
                            {client.rcmsCode}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.clientName}
                          </div>
                        </div>
                        {client.status === 'X' && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)', fontWeight: 500, flexShrink: 0 }}>
                            Inactive
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Client Name (read-only) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Client Name</label>
                <div style={{
                  width: '100%', padding: '9px 12px', minHeight: 38,
                  background: 'var(--bg-subtle)', color: 'var(--fg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                  fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center',
                  boxSizing: 'border-box',
                }}>
                  {watch('clientName')
                    ? <span style={{ fontWeight: 500 }}>{watch('clientName')}</span>
                    : <span style={{ color: 'var(--fg-faint)' }}>—</span>}
                </div>
              </div>

              {/* Pickup Point (dynamic dropdown) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Pickup Point Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  id="pickupPointSelect"
                  {...register('pickupPoint', { required: 'Selection required' })}
                  className="input-field"
                  disabled={!watch('clientCode')}
                  style={{ cursor: watch('clientCode') ? 'pointer' : 'not-allowed', opacity: watch('clientCode') ? 1 : 0.6 }}
                >
                  {!watch('clientCode') && <option value="">Select a client code first</option>}
                  {watch('clientCode') && (
                    <>
                      <option value="">----Select----</option>
                      {availableClients
                        .filter(c => c.rcmsCode === watch('clientCode'))
                        .map(c => {
                          const displayVal = c.pickupPointCode
                            ? `${c.pickupPointCode}${c.pickupPointDesc ? ' - ' + c.pickupPointDesc : ''}`
                            : c.cityCode || '';
                          return (
                            <option key={displayVal} value={displayVal}>
                              {displayVal || 'Default Location'}
                            </option>
                          );
                        })}
                    </>
                  )}
                </select>
                {errors.pickupPoint && (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="error" size={13} /> {errors.pickupPoint.message}
                  </p>
                )}
              </div>

              {/* Total Instruments */}
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>
                  Total Instruments <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  {...register('totalInstruments', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })}
                  type="number" min="1"
                  className="input-field"
                />
                {errors.totalInstruments && (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {errors.totalInstruments.message}
                  </p>
                )}
              </div>

              {/* Slip Amount */}
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Total Slip Amount(₹) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--fg-muted)', fontSize: 'var(--text-sm)', fontWeight: 500, pointerEvents: 'none',
                  }}>₹</span>
                  <input
                    {...register('slipAmount', { required: 'Required', min: { value: 0.001, message: 'Must be > 0' } })}
                    type="number" step="0.001" min="0"
                    className="input-field"
                    style={{ paddingLeft: 26 }}
                  />
                </div>
                {errors.slipAmount && (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {errors.slipAmount.message}
                  </p>
                )}
              </div>

              {/* Remarks */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Remarks</label>
                <input
                  {...register('remarks')}
                  placeholder="Optional"
                  className="input-field"
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 24 }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                <Icon name="save" size={16} />
                {submitting ? 'Saving…' : 'Save slip'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Priority Warning Modal Overlay */}
        {showPriorityConfirm && priorityClientInfo && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'var(--bg-raised)',
            zIndex: 100, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center'
          }}>
            <div style={{ 
              width: 64, height: 64, borderRadius: '50%', background: 'var(--warning-bg)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              color: 'var(--warning)'
            }}>
              <Icon name="priority_high" size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', fontWeight: 600 }}>Priority Client Detected</h3>
            <p style={{ margin: '0 0 24px', fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{priorityClientInfo.clientName}</span> is part of the <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{priorityClientInfo.globalCode}</span> priority group.<br/>
              By proceeding, this batch will be <span style={{ color: 'var(--warning)', fontWeight: 600 }}>exclusive</span> to this client group.
            </p>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <button 
                className="btn-secondary" style={{ flex: 1 }}
                onClick={() => {
                  setShowPriorityConfirm(false);
                  setValue('clientCode', '');
                  setValue('clientName', '');
                  setClientSearchTerm('');
                }}
              >
                Go Back
              </button>
              <button 
                className="btn-primary" style={{ flex: 1, background: 'var(--warning)', borderColor: 'var(--warning)' }}
                onClick={() => setShowPriorityConfirm(false)}
              >
                I Understand
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
