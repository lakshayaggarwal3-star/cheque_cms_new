// =============================================================================
// File        : MobileScannerModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Batch — Mobile Scanner Modal
// Description : Modal for mobile scanner batch details input
// Created     : 2026-04-19
// =============================================================================

import { useState } from 'react';
import { Icon } from './BatchFormUI';

interface MobileScannerModalProps {
  hasBothRoles: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: { summ: string; pif: string; slips: string; amount: string }) => void;
}

export function MobileScannerModal({ hasBothRoles, submitting, onClose, onSubmit }: MobileScannerModalProps) {
  const [modalSumm, setModalSumm] = useState('');
  const [modalSlips, setModalSlips] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrs: Record<string, string> = {};
    if (!modalSumm.trim()) newErrs.summ = 'Required';
    if (!modalSlips || parseInt(modalSlips) <= 0) newErrs.slips = 'Required (>0)';
    if (!modalAmount || parseFloat(modalAmount) <= 0) newErrs.amount = 'Required (>0)';

    setModalErrors(newErrs);
    if (Object.keys(newErrs).length > 0) return;

    onSubmit({ summ: modalSumm, pif: modalSumm, slips: modalSlips, amount: modalAmount });
  };

  return (
    <div className="modal-overlay-container" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px', animation: 'fadeIn 0.2s ease-out',
      overflowY: 'auto'
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--bg-raised, #fff)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl, 16px)', boxShadow: 'var(--shadow-xl)',
          width: '100%', maxWidth: 460, overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--fg)' }}>
              Batch Details
            </h2>
            <div style={{ marginTop: 2, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
              Fill all fields to proceed
            </div>
          </div>
          {hasBothRoles && (
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}>
              <Icon name="close" size={24} />
            </button>
          )}
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              Summary Ref No <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              autoFocus
              value={modalSumm}
              onChange={e => {
                const val = e.target.value;
                setModalSumm(val);
                setModalErrors(prev => ({ ...prev, summ: '' }));
              }}
              placeholder="Enter reference no"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: 'var(--bg-input)',
                border: `1px solid ${modalErrors.summ ? 'var(--danger)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)', outline: 'none', color: 'var(--fg)'
              }}
            />
            {modalErrors.summ && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.summ}</div>}
          </div>

          <div className="slip-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={{ opacity: !modalSumm.trim() ? 0.6 : 1, transition: 'opacity 0.2s var(--ease)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="number"
                disabled={!modalSumm.trim()}
                value={modalSlips}
                placeholder="Enter total slips"
                onChange={e => { setModalSlips(e.target.value); setModalErrors(prev => ({ ...prev, slips: '' })); }}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                  background: 'var(--bg-input)',
                  border: `1px solid ${modalErrors.slips ? 'var(--danger)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                  outline: 'none', color: 'var(--fg)',
                  cursor: !modalSumm.trim() ? 'not-allowed' : 'text'
                }}
              />
              {modalErrors.slips && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.slips}</div>}
            </div>

            <div style={{ opacity: (!modalSlips || parseInt(modalSlips) <= 0) ? 0.6 : 1, transition: 'opacity 0.2s var(--ease)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
                Total Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="number"
                disabled={!modalSlips || parseInt(modalSlips) <= 0}
                value={modalAmount}
                onChange={e => { setModalAmount(e.target.value); setModalErrors(prev => ({ ...prev, amount: '' })); }}
                placeholder="Enter total amount"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                  background: 'var(--bg-input)',
                  border: `1px solid ${modalErrors.amount ? 'var(--danger)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                  outline: 'none', color: 'var(--fg)',
                  cursor: (!modalSlips || parseInt(modalSlips) <= 0) ? 'not-allowed' : 'text'
                }}
              />
              {modalErrors.amount && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.amount}</div>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          {/* Submit button logic: only active if all fields are valid */}
          {(() => {
            const isValid = modalSumm.trim() && (parseInt(modalSlips) > 0) && (parseFloat(modalAmount) > 0);
            return (
              <button
                type="submit"
                disabled={submitting || !isValid}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 16px', minHeight: 40,
                  background: isValid ? 'var(--accent-500)' : 'var(--bg-active)',
                  color: isValid ? 'var(--fg-on-accent)' : 'var(--fg-muted)',
                  border: `1px solid ${isValid ? 'var(--accent-600)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  cursor: (submitting || !isValid) ? 'not-allowed' : 'pointer',
                  width: '100%',
                  opacity: (submitting || !isValid) ? 0.6 : 1,
                  transition: 'all 0.2s var(--ease)'
                }}
              >
                <Icon name="check_circle" size={16} />
                Fill Details
              </button>
            );
          })()}
          {hasBothRoles && (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '11px 16px', minHeight: 40,
                background: 'var(--bg-raised)', color: 'var(--fg)',
                border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
                fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer', width: '100%'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
