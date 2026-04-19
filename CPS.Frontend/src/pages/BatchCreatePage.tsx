// =============================================================================
// File        : BatchCreatePage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Batch creation with unconditional middle fields & generic submit.
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

  // Entry Mode
  const hasBothRoles = !!(user?.roles.includes('Scanner') && user?.roles.includes('MobileScanner'));
  const onlyMobile   = !!(user?.roles.includes('MobileScanner') && !user?.roles.includes('Scanner'));
  const [entryMode, setEntryMode] = useState<'scanner' | 'mobile'>(onlyMobile ? 'mobile' : 'scanner');

  // Form State
  const [clearingType, setClearingType] = useState('03');
  const [batchDate, setBatchDate] = useState(user?.eodDate ?? new Date().toISOString().slice(0, 10));
  
  const [summRefNo, setSummRefNo] = useState('');
  const [pif, setPif] = useState('');
  const [showHiddenFields, setShowHiddenFields] = useState(false);
  const [totalSlips, setTotalSlips] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  // Shared scan options
  const [scanType, setScanType] = useState<'Scan' | 'Rescan'>('Scan');
  const [withSlip, setWithSlip] = useState<'with' | 'without'>('with');
  const [pdc, setPdc] = useState(false);
  const [pdcDate, setPdcDate] = useState('');

  // Mobile Mode Modal state
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [modalSumm, setModalSumm] = useState('');
  const [modalPif, setModalPif] = useState('');
  const [modalSlips, setModalSlips] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

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

  // Open mobile modal automatically when mobile mode is selected
  useEffect(() => {
    if (entryMode === 'mobile') {
      setShowMobileModal(true);
      setWithSlip('with');
      setShowHiddenFields(true); // Automatically show in center when mobile
    } else {
      setShowMobileModal(false);
      setShowHiddenFields(false); // Reset to hidden in scanner mode unless toggled
    }
  }, [entryMode]);

  // Auto-fill PIF with Summary Ref No in Mobile mode
  useEffect(() => {
    if (modalSumm) setModalPif(modalSumm);
  }, [modalSumm]);

  const handleModalFill = () => {
    const newErrs: Record<string, string> = {};
    if (!modalSumm.trim()) newErrs.summ = 'Required';
    if (!modalPif.trim()) newErrs.pif = 'Required';
    if (!modalSlips || parseInt(modalSlips) <= 0) newErrs.slips = 'Required (>0)';
    if (!modalAmount || parseFloat(modalAmount) <= 0) newErrs.amount = 'Required (>0)';

    setModalErrors(newErrs);
    if (Object.keys(newErrs).length > 0) return;

    // Push inputs to form wrapper
    setSummRefNo(modalSumm);
    setPif(modalPif);
    setTotalSlips(modalSlips);
    setTotalAmount(modalAmount);
    setShowMobileModal(false);
  };

  const handleCreateAndStart = async () => {
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
    if (!activeScanner) { toast.error('No active scanner found for your location'); return; }

    setSubmitting(true);
    try {
      // Create initial batch
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
        entryMode:        entryMode,
        summRefNo:        entryMode === 'mobile' ? summRefNo : undefined,
        pif:              entryMode === 'mobile' ? pif : undefined,
      });

      // Update secondary fields including optional ones
      await updateBatch(batch.batchID, {
        totalSlips: (showHiddenFields || entryMode === 'mobile') && totalSlips ? parseInt(totalSlips) : 0,
        totalAmount: (showHiddenFields || entryMode === 'mobile') && totalAmount ? parseFloat(totalAmount) : 0,
        isPDC: pdc,
        pdcDate: pdc ? pdcDate : undefined,
        scanType,
        withSlip: withSlip === 'with',
        summRefNo: entryMode === 'mobile' ? summRefNo : batch.summRefNo,
        pif: entryMode === 'mobile' ? pif : batch.pif,
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
    <div style={{ position: 'relative', minHeight: '100%' }}>
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
            Batch number is assigned after save. Most fields below are inferred from your session.
          </p>
        </div>

        {/* Entry mode — Top right alignment */}
        {hasBothRoles && (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', marginBottom: 6, textAlign: 'right' }}>
              Entry mode (Dev)
            </div>
            <Segmented
              options={[
                { id: 'scanner', label: 'Scanner',        icon: 'document_scanner' },
                { id: 'mobile',  label: 'Mobile scanner', icon: 'smartphone' },
              ]}
              value={entryMode}
              onChange={v => setEntryMode(v as 'scanner' | 'mobile')}
            />
          </div>
        )}
      </div>

      {/* Header Prefilled section (Read-only properties + Configuration) */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        padding: '16px', marginBottom: 16,
      }}>
        {/* Prefilled Stats Row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', alignItems: 'center'
        }}>
          <ReadStat label="Location Name" value={user?.locationName ?? '—'} />
          <ReadStat label="Location Code" value={locationDetails?.locationCode ?? '—'} mono />
          <ReadStat label="Cluster" value={locationDetails?.clusterCode ?? '—'} mono />
          <ReadStat label="Scanner" value={activeScanner ? `${activeScanner.scannerID}` : '—'} mono />
          <ReadStat label="User" value={user?.username?.toUpperCase() ?? '—'} mono />
          <ReadStat label="EOD" value={formatDate(user?.eodDate ?? '')} />
        </div>

        {/* Global Configuration Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 500 }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              Clearing type <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              autoFocus
              value={clearingType}
              onChange={e => setClearingType(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 10px', background: 'var(--bg-input)', color: 'var(--fg)',
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
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              Batch Date <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="date"
              value={batchDate}
              onChange={e => setBatchDate(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '6px 10px',
                background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                color: 'var(--fg)',
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleCreateAndStart(); }}>
        {/* Main editable container */}
        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
          padding: '16px',
        }}>

        {/* Midsection Generics (BATCH NO, SUMM REF NO, PIF NO) */}
        <div style={{
          background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-md)', padding: '16px', marginBottom: 16,
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16
        }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
              Batch No <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              disabled
              style={{
                width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                background: 'transparent', border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none',
                opacity: 0.6, cursor: 'not-allowed', color: 'var(--fg)'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
              Summary Ref No <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={summRefNo}
              disabled={entryMode === 'scanner'}
              onChange={e => setSummRefNo(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                background: entryMode === 'scanner' ? 'transparent' : 'var(--bg-input)', border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none',
                opacity: entryMode === 'scanner' ? 0.6 : 1, cursor: entryMode === 'scanner' ? 'not-allowed' : 'text', color: 'var(--fg)'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
              PIF No <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={pif}
              disabled={entryMode === 'scanner'}
              onChange={e => setPif(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                background: entryMode === 'scanner' ? 'transparent' : 'var(--bg-input)', border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none',
                opacity: entryMode === 'scanner' ? 0.6 : 1, cursor: entryMode === 'scanner' ? 'not-allowed' : 'text', color: 'var(--fg)'
              }}
            />
          </div>
        </div>

        {/* Hidden Fields Toggles & Inputs */}
        <div style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease-out' }}>
          {entryMode === 'scanner' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)', cursor: 'pointer', marginBottom: 12 }}>
              <input 
                type="checkbox" 
                checked={showHiddenFields} 
                onChange={e => setShowHiddenFields(e.target.checked)} 
                style={{ accentColor: 'var(--accent-500)', width: 14, height: 14 }}
              />
              Show hidden fields (Total Slips & Amount)
            </label>
          )}

          {(showHiddenFields || entryMode === 'mobile') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640 }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
                  Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={totalSlips}
                  onChange={e => setTotalSlips(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                    background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none', color: 'var(--fg)'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
                  Total Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                    background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none', color: 'var(--fg)'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Scan Options Midsection */}
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
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 38, boxSizing: 'border-box',
                fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', cursor: 'pointer',
                padding: '0 12px', background: 'var(--bg-subtle)',
                borderRadius: pdc ? 'var(--r-md) 0 0 var(--r-md)' : 'var(--r-md)',
                border: '1px solid var(--border)',
                borderRight: pdc ? 'none' : '1px solid var(--border)'
              }}>
                <input
                  type="checkbox"
                  checked={pdc}
                  onChange={e => setPdc(e.target.checked)}
                  style={{ accentColor: 'var(--accent-500)', width: 15, height: 15 }}
                />
                PDC
              </label>

              {pdc && (
                <input
                  type="date"
                  value={pdcDate}
                  title="Select PDC Date"
                  onChange={e => setPdcDate(e.target.value)}
                  style={{
                    padding: '0 10px', height: 38, boxSizing: 'border-box',
                    background: 'var(--bg-subtle)', color: 'var(--fg)',
                    border: '1px solid var(--border)', borderRadius: '0 var(--r-md) var(--r-md) 0', 
                    fontSize: 'var(--text-sm)', outline: 'none'
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          disabled={submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 16px', height: 38,
            background: 'var(--bg-raised)', color: 'var(--fg)',
            border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '7px 20px', height: 38,
            background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
            border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
          }}
        >
          <Icon name="play_arrow" size={18} style={{ color: 'inherit' }} />
          {submitting ? 'Creating and Storing...' : 'Create & start scanning'}
        </button>
        </div>
      </form>

      {/* --------- MOBILE SCANNER MODAL --------- */}
      {entryMode === 'mobile' && showMobileModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 24, animation: 'fadeIn 0.2s ease-out'
        }}>
          <form 
            onSubmit={(e) => { e.preventDefault(); handleModalFill(); }}
            style={{
              background: 'var(--bg-raised, #fff)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl, 16px)', boxShadow: 'var(--shadow-xl)',
              width: '100%', maxWidth: 520, overflow: 'hidden',
              display: 'flex', flexDirection: 'column'
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--fg)' }}>
                  Mobile Scanner Form
                </h2>
                <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
                  Please fill all fields to populate the batch configuration.
                </div>
              </div>
              {hasBothRoles && (
                <button onClick={() => setShowMobileModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}>
                  <Icon name="close" size={24} />
                </button>
              )}
            </div>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  Summary Ref No <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  autoFocus
                  value={modalSumm} onChange={e => { setModalSumm(e.target.value); setModalErrors(prev => ({ ...prev, summ: '' })); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${modalErrors.summ ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none', color: 'var(--fg)' }}
                />
                {modalErrors.summ && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.summ}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  PIF No <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  value={modalPif} onChange={e => { setModalPif(e.target.value); setModalErrors(prev => ({ ...prev, pif: '' })); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${modalErrors.pif ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none', color: 'var(--fg)' }}
                />
                {modalErrors.pif && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.pif}</div>}
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={modalSlips} onChange={e => { setModalSlips(e.target.value); setModalErrors(prev => ({ ...prev, slips: '' })); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${modalErrors.slips ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none', color: 'var(--fg)' }}
                />
                {modalErrors.slips && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.slips}</div>}
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  Total Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={modalAmount} onChange={e => { setModalAmount(e.target.value); setModalErrors(prev => ({ ...prev, amount: '' })); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${modalErrors.amount ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none', color: 'var(--fg)' }}
                />
                {modalErrors.amount && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.amount}</div>}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              {hasBothRoles && (
                <button
                  type="button" onClick={() => setShowMobileModal(false)} disabled={submitting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '9px 16px', height: 38,
                    background: 'var(--bg-raised)', color: 'var(--fg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit" disabled={submitting}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', height: 38,
                  background: 'var(--accent-500)', color: 'var(--fg-on-accent)', border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer'
                }}
              >
                <Icon name="check_circle" size={16} />
                Confirm Details To Form
              </button>
            </div>
          </form>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
