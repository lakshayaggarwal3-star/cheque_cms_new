// =============================================================================
// File        : BatchCreatePage.tsx (REFACTORED)
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : Batch creation with unconditional middle fields & generic submit.
//               REFACTORED: Components and logic extracted to separate files.
// Created     : 2026-04-14
// Refactored  : 2026-04-19
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { useBatchForm } from '../hooks/useBatchForm';
import {
  Icon, Segmented, ReadStat,
  MobileScannerModal,
} from '../components/batch';

// ── BatchCreatePage ───────────────────────────────────────────────────────────

export function BatchCreatePage() {
  const navigate = useNavigate();
  const form = useBatchForm();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {/* Breadcrumb + title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexDirection: 'column' }}>
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginBottom: 6, flexWrap: 'wrap' }}>
            <span onClick={() => navigate('/')} style={{ cursor: 'pointer', color: 'var(--fg-muted)', textDecoration: 'none' }}>Dashboard</span>
            <Icon name="chevron_right" size={14} />
            <span>New batch</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
            Create batch
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>
            Batch number is assigned after save. Most fields below are inferred from your session.
          </p>
        </div>

        {/* Scanning mode — Full width on mobile, top right on desktop */}
        {form.hasBothRoles && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', marginBottom: 6 }}>
              Scanning method
            </div>
            <Segmented
              options={[
                { id: 'scanner', label: 'Scanner device',     icon: 'document_scanner' },
                { id: 'mobile',  label: 'Mobile device',      icon: 'smartphone' },
              ]}
              value={form.entryMode}
              onChange={v => form.setEntryMode(v as 'scanner' | 'mobile')}
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
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', alignItems: 'center'
        }}>
          <ReadStat label="Location Name" value={form.user?.locationName ?? '—'} />
          <ReadStat label="Location Code" value={form.locationDetails?.locationCode ?? '—'} mono />
          <ReadStat label="Cluster" value={form.locationDetails?.clusterCode ?? '—'} mono />
          <ReadStat label="Scanner" value={form.activeScanner ? `${form.activeScanner.scannerID}` : '—'} mono />
          <ReadStat label="User" value={form.user?.username?.toUpperCase() ?? '—'} mono />
          <ReadStat label="EOD" value={form.formatDate(form.user?.eodDate ?? '')} />
        </div>

        {/* Global Configuration Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              Clearing type <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              autoFocus
              value={form.clearingType}
              onChange={e => form.setClearingType(e.target.value)}
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
              value={form.batchDate}
              onChange={e => form.setBatchDate(e.target.value)}
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

      <form onSubmit={(e) => { e.preventDefault(); form.handleCreateAndStart(); }}>
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
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16
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
              value={form.summRefNo}
              disabled={form.entryMode === 'scanner'}
              onChange={e => form.setSummRefNo(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                background: form.entryMode === 'scanner' ? 'transparent' : 'var(--bg-input)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none',
                opacity: form.entryMode === 'scanner' ? 0.6 : 1,
                cursor: form.entryMode === 'scanner' ? 'not-allowed' : 'text',
                color: 'var(--fg)'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
              PIF No <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={form.pif}
              disabled={form.entryMode === 'scanner'}
              onChange={e => form.setPif(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                background: form.entryMode === 'scanner' ? 'transparent' : 'var(--bg-input)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none',
                opacity: form.entryMode === 'scanner' ? 0.6 : 1,
                cursor: form.entryMode === 'scanner' ? 'not-allowed' : 'text',
                color: 'var(--fg)'
              }}
            />
          </div>
        </div>

        {/* Hidden Fields Toggles & Inputs */}
        <div style={{ marginBottom: 16, animation: 'fadeIn 0.2s ease-out' }}>
          {form.entryMode === 'scanner' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)', cursor: 'pointer', marginBottom: 12 }}>
              <input 
                type="checkbox" 
                checked={form.showHiddenFields} 
                onChange={e => form.setShowHiddenFields(e.target.checked)} 
                style={{ accentColor: 'var(--accent-500)', width: 14, height: 14 }}
              />
              Show hidden fields (Total Slips & Amount)
            </label>
          )}

          {(form.showHiddenFields || form.entryMode === 'mobile') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
                  Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={form.totalSlips}
                  onChange={e => form.setTotalSlips(e.target.value)}
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
                  value={form.totalAmount}
                  onChange={e => form.setTotalAmount(e.target.value)}
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
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 12 }}>
            Scan options
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: 6, fontWeight: 500 }}>Type</div>
              <Segmented
                options={[
                  { id: 'Scan',   label: 'Scan',   icon: 'document_scanner' },
                  { id: 'Rescan', label: 'Rescan', icon: 'refresh' },
                ]}
                value={form.scanType}
                onChange={v => form.setScanType(v as 'Scan' | 'Rescan')}
              />
            </div>

            {form.entryMode !== 'mobile' && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: 6, fontWeight: 500 }}>Slip Mode</div>
                <Segmented
                  options={[
                    { id: 'with',    label: 'With slip',    icon: 'receipt' },
                    { id: 'without', label: 'Without slip', icon: 'receipt_long' },
                  ]}
                  value={form.withSlip}
                  onChange={v => form.setWithSlip(v as 'with' | 'without')}
                />
              </div>
            )}

            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: 6, fontWeight: 500 }}>PDC (if applicable)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 38, boxSizing: 'border-box',
                  fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', cursor: 'pointer',
                  padding: '0 12px', background: 'var(--bg-subtle)',
                  borderRadius: form.pdc ? 'var(--r-md) 0 0 var(--r-md)' : 'var(--r-md)',
                  border: '1px solid var(--border)',
                  borderRight: form.pdc ? 'none' : '1px solid var(--border)', flex: form.pdc ? 0 : 1
                }}>
                  <input
                    type="checkbox"
                    checked={form.pdc}
                    onChange={e => form.setPdc(e.target.checked)}
                    style={{ accentColor: 'var(--accent-500)', width: 15, height: 15 }}
                  />
                  {form.pdc ? 'PDC' : 'Enable PDC'}
                </label>

                {form.pdc && (
                  <input
                    type="date"
                    value={form.pdcDate}
                    title="Select PDC Date"
                    onChange={e => form.setPdcDate(e.target.value)}
                    style={{
                      padding: '0 10px', height: 38, boxSizing: 'border-box',
                      background: 'var(--bg-subtle)', color: 'var(--fg)',
                      border: '1px solid var(--border)', borderRadius: '0 var(--r-md) var(--r-md) 0',
                      fontSize: 'var(--text-sm)', outline: 'none', flex: 1, minWidth: 0
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          disabled={form.submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 16px', height: 38,
            background: 'var(--bg-raised)', color: 'var(--fg)',
            border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            cursor: form.submitting ? 'not-allowed' : 'pointer', opacity: form.submitting ? 0.5 : 1,
            flex: '0 1 auto', minWidth: 'auto'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={form.submitting}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '7px 20px', height: 38,
            background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
            border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            cursor: form.submitting ? 'not-allowed' : 'pointer', opacity: form.submitting ? 0.7 : 1,
            flex: '0 1 auto', minWidth: 'auto'
          }}
        >
          <Icon name="play_arrow" size={18} style={{ color: 'inherit' }} />
          {form.submitting ? 'Creating...' : 'Create & start'}
        </button>
        </div>
      </form>

      {/* --------- MOBILE SCANNER MODAL --------- */}
      {form.entryMode === 'mobile' && form.showMobileModal && (
        <MobileScannerModal
          hasBothRoles={form.hasBothRoles}
          submitting={form.submitting}
          onClose={() => form.setShowMobileModal(false)}
          onSubmit={form.handleModalFill}
        />
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
