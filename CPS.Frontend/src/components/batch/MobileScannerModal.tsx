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
  const [modalPif, setModalPif] = useState('');
  const [pifManuallyEdited, setPifManuallyEdited] = useState(false);
  const [modalSlips, setModalSlips] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrs: Record<string, string> = {};
    if (!modalSumm.trim()) newErrs.summ = 'Required';
    if (!modalPif.trim()) newErrs.pif = 'Required';
    if (!modalSlips || parseInt(modalSlips) <= 0) newErrs.slips = 'Required (>0)';
    if (!modalAmount || parseFloat(modalAmount) <= 0) newErrs.amount = 'Required (>0)';

    setModalErrors(newErrs);
    if (Object.keys(newErrs).length > 0) return;

    onSubmit({ summ: modalSumm, pif: modalPif, slips: modalSlips, amount: modalAmount });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24, animation: 'fadeIn 0.2s ease-out'
    }}>
      <form 
        onSubmit={handleSubmit}
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
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}>
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
              value={modalSumm}
              onChange={e => {
                const val = e.target.value;
                setModalSumm(val);
                // Auto-fill PIF if user hasn't manually edited it yet
                if (!pifManuallyEdited) {
                  setModalPif(val);
                }
                setModalErrors(prev => ({ ...prev, summ: '' }));
              }}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: 'var(--bg-input)',
                border: `1px solid ${modalErrors.summ ? 'var(--danger)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)', outline: 'none', color: 'var(--fg)'
              }}
            />
            {modalErrors.summ && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.summ}</div>}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              PIF No <span style={{ color: 'var(--danger)' }}>*</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 400, marginLeft: 8 }}>(or edit if different)</span>
            </label>
            <input
              value={modalPif}
              onChange={e => {
                setModalPif(e.target.value);
                // Mark as manually edited once user changes it
                setPifManuallyEdited(true);
                setModalErrors(prev => ({ ...prev, pif: '' }));
              }}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: 'var(--bg-input)',
                border: `1px solid ${modalErrors.pif ? 'var(--danger)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)', outline: 'none', color: 'var(--fg)'
              }}
            />
            {modalErrors.pif && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.pif}</div>}
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              Total Slips <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="number"
              value={modalSlips}
              onChange={e => { setModalSlips(e.target.value); setModalErrors(prev => ({ ...prev, slips: '' })); }}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: 'var(--bg-input)',
                border: `1px solid ${modalErrors.slips ? 'var(--danger)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                outline: 'none', color: 'var(--fg)'
              }}
            />
            {modalErrors.slips && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.slips}</div>}
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
              Total Amount (₹) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="number"
              value={modalAmount}
              onChange={e => { setModalAmount(e.target.value); setModalErrors(prev => ({ ...prev, amount: '' })); }}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: 'var(--bg-input)',
                border: `1px solid ${modalErrors.amount ? 'var(--danger)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                outline: 'none', color: 'var(--fg)'
              }}
            />
            {modalErrors.amount && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{modalErrors.amount}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          {hasBothRoles && (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '9px 16px', height: 38,
                background: 'var(--bg-raised)', color: 'var(--fg)',
                border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
                fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '9px 16px', height: 38,
              background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
              border: '1px solid var(--accent-600)', borderRadius: 'var(--r-md)',
              fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer'
            }}
          >
            <Icon name="check_circle" size={16} />
            Confirm Details To Form
          </button>
        </div>
      </form>
    </div>
  );
}
