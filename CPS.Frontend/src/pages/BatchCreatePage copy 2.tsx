// =============================================================================
// File        : BatchCreatePage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Batch creation with dedicated flows for Scanner and Mobile modes.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocations, getScanners } from '../services/locationService';
import { createBatch, updateBatch } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import type { LocationDto, ScannerDto, BatchDto } from '../types';

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
  const [createdBatch,    setCreatedBatch]    = useState<BatchDto | null>(null);

  // Entry Mode
  const hasBothRoles = !!(user?.roles.includes('Scanner') && user?.roles.includes('MobileScanner'));
  const onlyMobile   = !!(user?.roles.includes('MobileScanner') && !user?.roles.includes('Scanner'));
  const [entryMode, setEntryMode] = useState<'scanner' | 'mobile'>(onlyMobile ? 'mobile' : 'scanner');

  // Scanner Mode state
  const [showHiddenFields, setShowHiddenFields] = useState(false);
  const [scannerSlips, setScannerSlips] = useState('');
  const [scannerAmount, setScannerAmount] = useState('');

  // Mobile Mode state
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileSummRefNo, setMobileSummRefNo] = useState('');
  const [mobilePif, setMobilePif] = useState('');
  const [mobileSlips, setMobileSlips] = useState('');
  const [mobileAmount, setMobileAmount] = useState('');
  // Mobile errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Shared scan options
  const [scanType, setScanType] = useState<'Scan' | 'Rescan'>('Scan');
  const [withSlip, setWithSlip] = useState<'with' | 'without'>('with');
  const [pdc, setPdc] = useState(false);
  const [pdcDate, setPdcDate] = useState('');

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
    } else {
      setShowMobileModal(false);
    }
  }, [entryMode]);

  // --- Scanner Flow Methods ---

  const handleCreateScannerBatch = async () => {
    if (!user?.locationId) return;
    if (!activeScanner) { toast.error('No active scanner found for your location'); return; }

    setSubmitting(true);
    try {
      const batch = await createBatch({
        locationID:       user.locationId,
        scannerMappingID: activeScanner.scannerMappingID,
        pickupPointCode:  locationDetails?.locationCode,
        batchDate:        user.eodDate ?? new Date().toISOString().slice(0, 10),
        clearingType:     '01',
        isPDC:            false,
        totalSlips:       0,
        totalAmount:      0,
        entryMode:        'scanner',
      });
      setCreatedBatch(batch);
      toast.success(`Batch ${batch.batchNo} created successfully.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartScannerProcess = async () => {
    if (!createdBatch) return;

    if (pdc && !pdcDate) {
      toast.error('PDC Date is required');
      return;
    }

    if (showHiddenFields) {
      if (!scannerSlips || parseInt(scannerSlips) <= 0) {
        toast.error('Total slips is required and must be > 0');
        return;
      }
      if (!scannerAmount || parseFloat(scannerAmount) <= 0) {
        toast.error('Total amount is required and must be > 0');
        return;
      }
    }

    setSubmitting(true);
    try {
      await updateBatch(createdBatch.batchID, {
        totalSlips: showHiddenFields && scannerSlips ? parseInt(scannerSlips) : 0,
        totalAmount: showHiddenFields && scannerAmount ? parseFloat(scannerAmount) : 0,
        isPDC: pdc,
        pdcDate: pdc ? pdcDate : undefined,
        scanType,
        withSlip: withSlip === 'with',
        summRefNo: createdBatch.summRefNo,
        pif: createdBatch.pif,
      });

      toast.success('Batch configured for scanning.');
      navigate(`/scan/${createdBatch.batchID}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update batch');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Mobile Flow Methods ---

  const handleStartMobileProcess = async () => {
    const newErrs: Record<string, string> = {};
    if (!mobileSummRefNo.trim()) newErrs.summ = 'Required';
    if (!mobilePif.trim()) newErrs.pif = 'Required';
    if (!mobileSlips || parseInt(mobileSlips) <= 0) newErrs.slips = 'Required (>0)';
    if (!mobileAmount || parseFloat(mobileAmount) <= 0) newErrs.amount = 'Required (>0)';
    if (pdc && !pdcDate) newErrs.pdcDate = 'Required when PDC checked';
    
    setErrors(newErrs);
    if (Object.keys(newErrs).length > 0) return;

    if (!user?.locationId) return;
    if (!activeScanner) { toast.error('No active scanner found for your location'); return; }

    setSubmitting(true);
    try {
      const batch = await createBatch({
        locationID:       user.locationId,
        scannerMappingID: activeScanner.scannerMappingID,
        pickupPointCode:  locationDetails?.locationCode,
        batchDate:        user.eodDate ?? new Date().toISOString().slice(0, 10),
        clearingType:     '01',
        isPDC:            pdc,
        pdcDate:          pdc ? pdcDate : undefined,
        totalSlips:       0,
        totalAmount:      0,
        entryMode:        'mobile',
        summRefNo:        mobileSummRefNo,
        pif:              mobilePif,
      });

      await updateBatch(batch.batchID, {
        totalSlips:       parseInt(mobileSlips),
        totalAmount:      parseFloat(mobileAmount),
        isPDC:            pdc,
        pdcDate:          pdc ? pdcDate : undefined,
        scanType:         'Scan', // Mobile ignores some desktop scan options
        withSlip:         true,   // Mobile always with slip
        summRefNo:        mobileSummRefNo,
        pif:              mobilePif,
      });

      toast.success(`Batch ${batch.batchNo} created`);
      setShowMobileModal(false);
      navigate(`/scan/${batch.batchID}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create mobile batch');
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
        </div>
      </div>

      {/* Header Prefilled section (Read-only properties) */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        padding: '16px 20px', marginBottom: 24,
        display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 20, alignItems: 'center',
      }}>
        <ReadStat label="Location" value={user?.locationName ?? '—'} />
        <ReadStat label="Pickup Location" value={locationDetails?.locationCode ?? '—'} mono />
        <ReadStat label="Scanner" value={activeScanner ? activeScanner.scannerID.toString() : '—'} mono />
        <ReadStat label="Batch Date" value={formatDate(user?.eodDate ?? '')} />
        <ReadStat label="Clearing Type" value="CTS (01)" mono />
      </div>

      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        padding: 24,
      }}>
        {/* Entry mode — only for users with both Scanner + MobileScanner */}
        {hasBothRoles && !createdBatch && (
          <div style={{ marginBottom: 24 }}>
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
          </div>
        )}

        {/* --------- SCANNER MODE FORM --------- */}
        {entryMode === 'scanner' && (
          <div>
            {!createdBatch ? (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={handleCreateScannerBatch}
                  disabled={submitting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 24px', height: 42,
                    background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
                    border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
                    fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
                    cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                  }}
                >
                  <Icon name="add_circle" size={18} style={{ color: 'inherit' }} />
                  {submitting ? 'Creating...' : 'Create Batch'}
                </button>
                <p style={{ marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
                  Click to generate the Batch Number, Summary Ref No, and PIF No automatically.
                </p>
              </div>
            ) : (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {/* Midsection Generated Data */}
                <div style={{
                  background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)',
                  borderRadius: 'var(--r-md)', padding: '16px 20px', marginBottom: 24,
                  display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20
                }}>
                  <ReadStat label="Batch No" value={createdBatch.batchNo} mono />
                  <ReadStat label="Summary Ref No" value={createdBatch.summRefNo || '—'} mono />
                  <ReadStat label="PIF No" value={createdBatch.pif || '—'} mono />
                </div>

                {/* Hidden Fields Midsection */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)', cursor: 'pointer', marginBottom: 16 }}>
                    <input 
                      type="checkbox" 
                      checked={showHiddenFields} 
                      onChange={e => setShowHiddenFields(e.target.checked)} 
                      style={{ accentColor: 'var(--accent-500)', width: 16, height: 16 }}
                    />
                    Show hidden fields (Total Slips & Amount)
                  </label>

                  {showHiddenFields && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 600, animation: 'fadeIn 0.2s ease-out' }}>
                      <div>
                        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                          Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={scannerSlips}
                          onChange={e => setScannerSlips(e.target.value)}
                          style={{
                            width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                            background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                          Total Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={scannerAmount}
                          onChange={e => setScannerAmount(e.target.value)}
                          style={{
                            width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                            background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Scan Options Midsection */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 20, marginBottom: 24 }}>
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

                    {pdc && (
                      <input
                        type="date"
                        value={pdcDate}
                        onChange={e => setPdcDate(e.target.value)}
                        style={{
                          padding: '7px 10px', background: 'var(--bg-input)', color: 'var(--fg)',
                          border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', 
                          fontSize: 'var(--text-sm)', outline: 'none', marginLeft: 8
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div>
                  <button
                    onClick={handleStartScannerProcess}
                    disabled={submitting}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px 24px', height: 42,
                      background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
                      border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
                      fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
                      cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    <Icon name="play_arrow" size={18} style={{ color: 'inherit' }} />
                    {submitting ? 'Starting...' : 'Start Scanning Process'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------- MOBILE MODE CTA --------- */}
        {entryMode === 'mobile' && !showMobileModal && (
          <div style={{ marginTop: 20 }}>
            <p style={{ marginBottom: 12, fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>
              Mobile scanner mode is selected. Required fields must be supplied manually.
            </p>
            <button
              onClick={() => setShowMobileModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 24px', height: 42,
                background: 'var(--bg-raised)', color: 'var(--accent-600)',
                border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
                fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              Open Mobile Input Form
            </button>
          </div>
        )}
      </div>

      {/* --------- MOBILE SCANNER MODAL --------- */}
      {entryMode === 'mobile' && showMobileModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 24, animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-raised, #fff)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl, 16px)', boxShadow: 'var(--shadow-xl)',
            width: '100%', maxWidth: 520, overflow: 'hidden',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--fg)' }}>
                  Mobile Scanner Checkin
                </h2>
                <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
                  Please enter all required fields to proceed.
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
                  value={mobileSummRefNo} onChange={e => { setMobileSummRefNo(e.target.value); setErrors(prev => ({ ...prev, summ: '' })); }}
                  placeholder="Enter manually"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${errors.summ ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none' }}
                />
                {errors.summ && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{errors.summ}</div>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  PIF No <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  value={mobilePif} onChange={e => { setMobilePif(e.target.value); setErrors(prev => ({ ...prev, pif: '' })); }}
                  placeholder="Enter manually"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${errors.pif ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none' }}
                />
                {errors.pif && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{errors.pif}</div>}
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={mobileSlips} onChange={e => { setMobileSlips(e.target.value); setErrors(prev => ({ ...prev, slips: '' })); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${errors.slips ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none' }}
                />
                {errors.slips && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{errors.slips}</div>}
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                  Total Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={mobileAmount} onChange={e => { setMobileAmount(e.target.value); setErrors(prev => ({ ...prev, amount: '' })); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${errors.amount ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none' }}
                />
                {errors.amount && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{errors.amount}</div>}
              </div>

              {/* Mobile PDC Options */}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginTop: 4 }}>
                 <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    fontSize: 'var(--text-sm)', color: 'var(--fg)', cursor: 'pointer'
                  }}>
                    <input type="checkbox" checked={pdc} onChange={e => setPdc(e.target.checked)} style={{ accentColor: 'var(--accent-500)' }} />
                    Post-Dated Cheque (PDC)
                  </label>
                  {pdc && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                        PDC Date <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={pdcDate} onChange={e => { setPdcDate(e.target.value); setErrors(prev => ({ ...prev, pdcDate: '' })); }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--bg-input)', border: `1px solid ${errors.pdcDate ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none' }}
                      />
                      {errors.pdcDate && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{errors.pdcDate}</div>}
                    </div>
                  )}
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
                type="button" onClick={handleStartMobileProcess} disabled={submitting}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', height: 38,
                  background: 'var(--accent-500)', color: 'var(--fg-on-accent)', border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1
                }}
              >
                <Icon name="play_arrow" size={16} />
                {submitting ? 'Creating...' : 'Start Scanning Process'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Global CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
