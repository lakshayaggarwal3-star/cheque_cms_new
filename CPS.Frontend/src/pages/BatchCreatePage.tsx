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
      {/* Top Section: All batch info in responsive grid */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        padding: '12px', marginBottom: 12,
      }}>
        <div className="stat-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14, alignItems: 'start'
        }}>
          <ReadStat label="Location Name" value={form.user?.locationName ?? '—'} />
          <ReadStat label="Location Code" value={form.locationDetails?.locationCode ?? '—'} />
          <ReadStat label="Cluster code" value={form.locationDetails?.clusterCode ?? '—'} />
          <ReadStat label="Clearing type" value={form.clearingType === '01' ? 'Regular (01)' : form.clearingType === '02' ? 'High Value (02)' : form.clearingType === '03' ? 'CTS (03)' : 'Non-CTS (11)'} />
          <ReadStat label="Scanner code" value={form.activeScanner ? `${form.activeScanner.scannerID}` : '—'} />
          <ReadStat label="Batch Date" value={form.formatDate(form.batchDate)} />
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); form.handleCreateAndStart(); }}>
        {/* Main Form Container */}
        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
          padding: '12px', marginBottom: 12,
        }} className="form-container">

        {/* Scan Configuration & Options */}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {form.entryMode === 'mobile' && (
                <div>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 8 }}>
                    Summary Ref No <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.summRefNo}
                    onChange={e => form.setSummRefNo(e.target.value)}
                    placeholder="Enter reference"
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', outline: 'none',
                      color: 'var(--fg)'
                    }}
                  />
                </div>
              )}
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 8 }}>
                  Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={form.totalSlips}
                  onChange={e => form.setTotalSlips(e.target.value)}
                  placeholder="Enter total slips"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none', color: 'var(--fg)'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 8 }}>
                  Total Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  value={form.totalAmount}
                  onChange={e => form.setTotalAmount(e.target.value)}
                  placeholder="Enter total amount"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none', color: 'var(--fg)'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-muted)', display: 'block', marginBottom: 14 }}>
            Configuration
          </label>

          {/* Three controls in one row: Type, Slip Mode, PDC — responsive */}
          <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: form.entryMode === 'mobile' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 14 }}>

            {/* Scan Type */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-muted)', marginBottom: 8 }}>Scan Type</div>
              <Segmented
                options={[
                  { id: 'Scan',   label: 'Scan',   icon: 'document_scanner' },
                  { id: 'Rescan', label: 'Rescan', icon: 'refresh' },
                ]}
                value={form.scanType}
                onChange={v => form.setScanType(v as 'Scan' | 'Rescan')}
              />
            </div>

            {/* Slip Mode — only desktop/scanner mode */}
            {form.entryMode !== 'mobile' && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-muted)', marginBottom: 8 }}>Slip Mode</div>
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

            {/* PDC */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-muted)', marginBottom: 8 }}>Post-Dated Cheque</div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: 36, width: '100%' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6, height: 36, boxSizing: 'border-box',
                  fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--fg-muted)', cursor: 'pointer',
                  padding: '0 10px', background: 'var(--bg-subtle)',
                  borderRadius: form.pdc ? 'var(--r-md) 0 0 var(--r-md)' : 'var(--r-md)',
                  border: `1px solid var(--border)`,
                  borderRight: form.pdc ? 'none' : `1px solid var(--border)`, whiteSpace: 'nowrap', flexGrow: 0, flexShrink: 0
                }}>
                  <input
                    type="checkbox"
                    checked={form.pdc}
                    onChange={e => form.setPdc(e.target.checked)}
                    style={{ accentColor: 'var(--accent-500)', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                  />
                  {form.pdc ? 'PDC' : 'Enable for PDC'}
                </label>

                {form.pdc && (
                  <input
                    type="date"
                    value={form.pdcDate}
                    title="Select PDC Date"
                    onChange={e => form.setPdcDate(e.target.value)}
                    style={{
                      padding: '0 10px', height: 36, boxSizing: 'border-box', flex: 1,
                      maxWidth: 200,
                      background: 'var(--bg-input)', color: 'var(--fg)',
                      border: '1px solid var(--border)', borderRadius: '0 var(--r-md) var(--r-md) 0',
                      fontSize: 'var(--text-sm)', fontWeight: 400, outline: 'none'
                    }}
                  />
                )}
              </div>
            </div>

          </div>
        </div>
        </div>

        {/* Footer */}
        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingBottom: 48 }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={form.submitting}
            style={{
              flex: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px', height: 44,
              background: 'var(--bg-raised)', color: 'var(--fg)',
              border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
              fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
              cursor: form.submitting ? 'not-allowed' : 'pointer', opacity: form.submitting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={form.submitting}
            style={{
              flex: 2,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px', height: 44,
              background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
              border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
              fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
              cursor: form.submitting ? 'not-allowed' : 'pointer', opacity: form.submitting ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name="play_arrow" size={18} style={{ color: 'inherit' }} />
            {form.submitting ? 'Creating...' : 'Create & Scan'}
          </button>
        </div>
      </form>

      {/* --------- MOBILE SCANNER MODAL --------- */}
      {form.entryMode === 'mobile' && form.showMobileModal && (
        <MobileScannerModal
          hasBothRoles={form.hasBothRoles}
          submitting={form.submitting}
          onClose={() => { form.setShowMobileModal(false); navigate('/'); }}
          onSubmit={form.handleModalFill}
        />
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (min-width: 768px) {
          .stat-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
          }
        }

        @media (max-width: 768px) {
          .config-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
