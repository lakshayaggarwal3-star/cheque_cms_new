// =============================================================================
// File        : BatchCreatePage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Batch creation — prefilled strip + inline options form.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocations, getScanners } from '../services/locationService';
import { createBatch, updateBatch } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import type { LocationDto, ScannerDto } from '../types';

// ── Icon ─────────────────────────────────────────────────────────────────────

function Icon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1, userSelect: 'none', flexShrink: 0, ...style,
      }}
    >{name}</span>
  );
}

// ── Segmented ─────────────────────────────────────────────────────────────────

function Segmented({ options, value, onChange, disabled }: {
  options: { id: string; label: string; icon?: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)',
      border: '1px solid var(--border)', opacity: disabled ? 0.55 : 1,
    }}>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button"
            onClick={() => !disabled && onChange(o.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', fontSize: 'var(--text-sm)', fontWeight: 500,
              color: active ? 'var(--fg)' : 'var(--fg-muted)',
              background: active ? 'var(--bg-raised)' : 'transparent',
              border: 'none', borderRadius: 'calc(var(--r-md) - 3px)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: active ? 'var(--shadow-xs)' : 'none',
              fontFamily: 'inherit',
              transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
            }}>
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── ReadStat ──────────────────────────────────────────────────────────────────

function ReadStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '.04em',
        color: 'var(--fg-subtle)', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
      }}>{value}</div>
    </div>
  );
}

// ── BatchCreatePage ───────────────────────────────────────────────────────────

export function BatchCreatePage() {
  const navigate = useNavigate();
  const { user }  = useAuthStore();

  const [scanners,        setScanners]        = useState<ScannerDto[]>([]);
  const [locationDetails, setLocationDetails] = useState<LocationDto | null>(null);
  const [submitting,      setSubmitting]      = useState(false);

  // Entry mode — selectable only when user has both roles (e.g. Developer)
  const hasBothRoles = !!(user?.roles.includes('Scanner') && user?.roles.includes('MobileScanner'));
  const onlyMobile   = !!(user?.roles.includes('MobileScanner') && !user?.roles.includes('Scanner'));
  const [entryMode, setEntryMode] = useState<'scanner' | 'mobile'>(onlyMobile ? 'mobile' : 'scanner');

  // Scan options
  const [scanType, setScanType] = useState<'Scan' | 'Rescan'>('Scan');
  const [withSlip, setWithSlip] = useState<'with' | 'without'>('with');
  const [pdc,      setPdc]      = useState(false);
  const [pdcDate,  setPdcDate]  = useState('');
  const [pdcError, setPdcError] = useState('');

  // Mobile-mode fields
  const [summRefNo,    setSummRefNo]    = useState('');
  const [pif,          setPif]          = useState('');
  const [summRefError, setSummRefError] = useState('');
  const [pifError,     setPifError]     = useState('');

  // Clearing type
  const [clearingType, setClearingType] = useState('01');

  const activeScanner = scanners.find(s => s.isActive) ?? scanners[0];

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[parseInt(m) - 1]} ${y}`;
  };

  useEffect(() => {
    if (!user?.locationId) return;
    getScanners(user.locationId).then(setScanners).catch(() => {});
    getLocations().then(locs => {
      const loc = locs.find(l => l.locationID === user.locationId);
      if (loc) setLocationDetails(loc);
    }).catch(() => {});
  }, [user?.locationId]);

  useEffect(() => {
    if (entryMode === 'mobile') setWithSlip('with');
  }, [entryMode]);

  const handleCreate = async () => {
    let valid = true;
    if (pdc && !pdcDate)                        { setPdcError('PDC date is required'); valid = false; } else setPdcError('');
    if (entryMode === 'mobile' && !summRefNo.trim()) { setSummRefError('Required');    valid = false; } else setSummRefError('');
    if (entryMode === 'mobile' && !pif.trim())       { setPifError('Required');         valid = false; } else setPifError('');
    if (!valid) return;

    if (!user?.locationId) return;
    if (!activeScanner) { toast.error('No active scanner found for your location'); return; }

    setSubmitting(true);
    try {
      const batch = await createBatch({
        locationID:       user.locationId,
        scannerMappingID: activeScanner.scannerMappingID,
        pickupPointCode:  locationDetails?.locationCode,
        batchDate:        user.eodDate ?? new Date().toISOString().slice(0, 10),
        clearingType,
        isPDC:    pdc,
        pdcDate:  pdc ? pdcDate : undefined,
        totalSlips: 0,
        totalAmount: 0,
        entryMode,
        summRefNo: entryMode === 'mobile' ? summRefNo : undefined,
        pif:       entryMode === 'mobile' ? pif       : undefined,
      });

      await updateBatch(batch.batchID, {
        totalSlips: 0, totalAmount: 0,
        isPDC:    pdc,
        pdcDate:  pdc ? pdcDate : undefined,
        scanType,
        withSlip: withSlip === 'with',
        summRefNo: entryMode === 'mobile' ? summRefNo : undefined,
        pif:       entryMode === 'mobile' ? pif       : undefined,
      });

      toast.success(`Batch ${batch.batchNo} created`);
      navigate(`/scan/${batch.batchID}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Breadcrumb + title */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginBottom: 6 }}>
            <a onClick={() => navigate('/')} style={{ cursor: 'pointer', color: 'var(--fg-muted)', textDecoration: 'none' }}>Dashboard</a>
            <Icon name="chevron_right" size={14} />
            <span>New batch</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
            Create batch
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>
            Batch number is assigned after save. Most fields are inferred from your session.
          </p>
        </div>
      </div>

      {/* Prefilled strip */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        padding: '16px 20px', marginBottom: 16,
        display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 24, alignItems: 'center',
      }}>
        <ReadStat
          label="Location"
          value={user?.locationName
            ? `${user.locationName}${locationDetails?.locationCode ? ` (${locationDetails.locationCode})` : ''}`
            : '—'}
        />
        <ReadStat label="Pickup point" value={locationDetails?.locationCode ?? '—'} mono />
        <ReadStat
          label="Scanner"
          value={activeScanner ? `${activeScanner.scannerID} · Active` : '—'}
          mono
        />
        <ReadStat label="User"  value={user?.username ?? '—'} mono />
        <ReadStat label="EOD"   value={formatDate(user?.eodDate ?? '')} />
      </div>

      {/* Editable card */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        padding: 24,
      }}>

        {/* Entry mode — only for users with both Scanner + MobileScanner */}
        {hasBothRoles && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', marginBottom: 8 }}>
              Entry mode
            </div>
            <Segmented
              options={[
                { id: 'scanner', label: 'Scanner',        icon: 'document_scanner' },
                { id: 'mobile',  label: 'Mobile scanner', icon: 'smartphone' },
              ]}
              value={entryMode}
              onChange={v => setEntryMode(v as 'scanner' | 'mobile')}
            />
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
              {entryMode === 'mobile'
                ? 'Mobile scanner — enter Summary Ref No and PIF manually below.'
                : 'Scanner mode — Summary Ref No and PIF are auto-generated.'}
            </p>
          </div>
        )}

        {/* Clearing type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 720, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              Clearing type <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={clearingType}
              onChange={e => setClearingType(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', background: 'var(--bg-input)', color: 'var(--fg)',
                border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="01">Regular (01)</option>
              <option value="02">High Value (02)</option>
              <option value="03">CTS (03)</option>
              <option value="11">Non-CTS (11)</option>
            </select>
          </div>

          {/* Mobile: SummRefNo */}
          {entryMode === 'mobile' && (
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                Summary ref no <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                value={summRefNo}
                onChange={e => { setSummRefNo(e.target.value); if (e.target.value) setSummRefError(''); }}
                placeholder="Enter manually"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '9px 12px', background: 'var(--bg-input)', color: 'var(--fg)',
                  border: `1px solid ${summRefError ? 'var(--danger)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-mono)', outline: 'none',
                }}
              />
              {summRefError && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{summRefError}</p>}
            </div>
          )}
        </div>

        {/* Mobile: PIF (second row) */}
        {entryMode === 'mobile' && (
          <div style={{ maxWidth: 720, marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div />
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  PIF no <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  value={pif}
                  onChange={e => { setPif(e.target.value); if (e.target.value) setPifError(''); }}
                  placeholder="Enter manually"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '9px 12px', background: 'var(--bg-input)', color: 'var(--fg)',
                    border: `1px solid ${pifError ? 'var(--danger)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)', outline: 'none',
                  }}
                />
                {pifError && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{pifError}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Scan options */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 10 }}>
            Scan options
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <Segmented
              options={[
                { id: 'Scan',   label: 'Scan',   icon: 'document_scanner' },
                { id: 'Rescan', label: 'Rescan', icon: 'refresh' },
              ]}
              value={scanType}
              onChange={v => setScanType(v as 'Scan' | 'Rescan')}
            />
            <span style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
            <Segmented
              options={[
                { id: 'with',    label: 'With slip',    icon: 'receipt' },
                { id: 'without', label: 'Without slip', icon: 'receipt_long' },
              ]}
              value={withSlip}
              onChange={v => setWithSlip(v as 'with' | 'without')}
              disabled={entryMode === 'mobile'}
            />
            <span style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
            }}>
              <input
                type="checkbox"
                checked={pdc}
                onChange={e => setPdc(e.target.checked)}
                style={{ accentColor: 'var(--accent-500)' }}
              />
              PDC
            </label>
          </div>

          {/* PDC date */}
          {pdc && (
            <div style={{ marginTop: 16, maxWidth: 320 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                PDC date <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="date"
                value={pdcDate}
                onChange={e => { setPdcDate(e.target.value); if (e.target.value) setPdcError(''); }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '9px 12px', background: 'var(--bg-input)', color: 'var(--fg)',
                  border: `1px solid ${pdcError ? 'var(--danger)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-sans)', outline: 'none',
                }}
              />
              {pdcError && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{pdcError}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          disabled={submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '9px 16px', height: 38,
            background: 'var(--bg-raised)', color: 'var(--fg)',
            border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '9px 16px', height: 38,
            background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
            border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-600)'; }}
          onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-500)'; }}
        >
          <Icon name="play_arrow" size={16} style={{ color: 'inherit' }} />
          {submitting ? 'Creating…' : 'Create & start scanning'}
        </button>
      </div>
    </div>
  );
}
