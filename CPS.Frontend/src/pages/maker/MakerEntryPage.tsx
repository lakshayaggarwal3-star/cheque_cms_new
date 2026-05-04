// =============================================================================
// File        : MakerEntryPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Maker
// Description : High-speed data entry form for slips and cheques.
// Created     : 2026-05-03
// =============================================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSlip } from '../../services/slipService';
import { saveMakerEntry } from '../../services/makerService';
import { getBatchByNumber } from '../../services/batchService';
import { toast } from '../../store/toastStore';
import { getChequeImageUrl, getSlipImageUrl } from '../../utils/imageUtils';
import { ChequeItemDto, SlipEntryDto, BatchDto } from '../../types';

// ── Local Components to avoid barrel import issues ────────────────────────────

function Icon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-outlined" style={{
      fontSize: size,
      fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      lineHeight: 1, userSelect: 'none', flexShrink: 0,
      ...style,
    }}>{name}</span>
  );
}

function Pill({ icon, children, color, style }: { icon?: string; children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 500,
      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
      color: color || 'var(--fg-muted)',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon && <Icon name={icon} size={12} style={{ color: color || 'inherit' }} />}
      {children}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function MakerEntryPage() {
  const { batchNo, slipId } = useParams<{ batchNo: string; slipId: string }>();
  const navigate = useNavigate();
  
  const [batch, setBatch] = useState<BatchDto | null>(null);
  const [slip, setSlip] = useState<SlipEntryDto | null>(null);
  const [current, setCurrent] = useState(0); 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [fields, setFields] = useState({
    amount: '',
    beneficiary: '',
    date: new Date().toISOString().split('T')[0],
    micr1: '',
    micr2: '',
    micr3: '',
    chqNo: ''
  });

  const amountRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!batchNo || !slipId) return;
    setLoading(true);
    try {
      const b = await getBatchByNumber(batchNo);
      setBatch(b);
      const s = await getSlip(Number(slipId));
      setSlip(s);
      
      const firstPending = s.cheques?.findIndex(c => !c.makerAmount) ?? 0;
      setCurrent(firstPending >= 0 ? firstPending : 0);
    } catch {
      toast.error('Failed to load entry session');
    } finally {
      setLoading(false);
    }
  }, [batchNo, slipId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (slip && slip.cheques && slip.cheques[current]) {
      const chq = slip.cheques[current];
      setFields({
        amount: chq.makerAmount?.toString() || '',
        beneficiary: chq.makerBeneficiary || '',
        date: chq.makerDate || new Date().toISOString().split('T')[0],
        micr1: chq.micr1 || chq.rrmicr1 || chq.scanMICR1 || '',
        micr2: chq.micr2 || chq.rrmicr2 || chq.scanMICR2 || '',
        micr3: chq.micr3 || chq.rrmicr3 || chq.scanMICR3 || '',
        chqNo: chq.chqNo || chq.rrChqNo || chq.scanChqNo || ''
      });
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [current, slip]);

  const handleSave = async () => {
    if (!slip || !slip.cheques || !slip.cheques[current]) return;
    const chq = slip.cheques[current];
    
    setSaving(true);
    try {
      await saveMakerEntry(chq.chequeItemId, {
        amount: Number(fields.amount),
        beneficiary: fields.beneficiary,
        date: fields.date,
        micr1: fields.micr1,
        micr2: fields.micr2,
        micr3: fields.micr3,
        chqNo: fields.chqNo,
        complete: true,
        rowVersion: chq.rowVersion || ''
      });

      toast.success(`Cheque ${current + 1} saved`);
      
      if (current < (slip.cheques?.length || 0) - 1) {
        setCurrent(current + 1);
      } else {
        toast.info('Slip completed!');
        navigate(`/maker/${batchNo}`);
      }
    } catch {
      toast.error('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !slip) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)' }}>Loading entry form...</div>;

  const currentChq = slip.cheques?.[current];
  const enteredTotal = slip.cheques?.reduce((acc, c, idx) => {
    const val = idx === current ? Number(fields.amount) : (c.makerAmount || 0);
    return acc + Number(val);
  }, 0) || 0;
  const variance = Number(slip.slipAmount) - enteredTotal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      
      {/* Header Strip */}
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate(`/maker/${batchNo}`)} className="btn-secondary" style={{ padding: '4px 8px' }}>
            <Icon name="arrow_back" size={18} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-600)', textTransform: 'uppercase' }}>Maker Entry</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Slip: {slip.depositSlipNo || '—'} ({slip.clientName || '—'})</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Pill icon="payments" style={{ background: 'var(--bg-subtle)' }}>
            Slip Amt: ₹{Number(slip.slipAmount).toLocaleString()}
          </Pill>
          <Pill icon="calculate" style={{ 
            background: variance === 0 ? 'var(--success-bg)' : 'var(--danger-bg)', 
            color: variance === 0 ? 'var(--success)' : 'var(--danger)' 
          }}>
            Variance: ₹{variance.toLocaleString()}
          </Pill>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)' }}>
            {current + 1} of {slip.cheques?.length || 0}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        
        {/* Left: Images */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', overflowY: 'auto' }}>
          <div style={{ background: 'var(--bg)', padding: 10, flexShrink: 0 }}>
             <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--fg-faint)', textTransform: 'uppercase', marginBottom: 4 }}>Slip Image</div>
             {slip.slipItems && slip.slipItems[0] ? (
               <img 
                 src={getSlipImageUrl(slip.slipItems[0])} 
                 style={{ width: '100%', borderRadius: 4, border: '1px solid var(--border)' }} 
                 alt="slip"
               />
             ) : <div style={{ height: 100, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>No Slip Image</div>}
          </div>
          <div style={{ background: 'var(--bg)', padding: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
             <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--fg-faint)', textTransform: 'uppercase', marginBottom: 4 }}>Cheque Image — #{current + 1}</div>
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: 4, overflow: 'hidden' }}>
               {currentChq ? (
                 <img 
                   src={getChequeImageUrl(currentChq, 'front')} 
                   style={{ maxWidth: '100%', maxHeight: '100%' }} 
                   alt="cheque"
                 />
               ) : <div>No Cheque Image</div>}
             </div>
          </div>
        </div>

        {/* Right: Entry Form */}
        <div style={{ width: 400, background: 'var(--bg-raised)', borderLeft: '1px solid var(--border)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8 }}>Amount</label>
            <input 
              ref={amountRef}
              type="number"
              value={fields.amount}
              onChange={e => setFields({...fields, amount: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('maker_beneficiary')?.focus()}
              className="input-field"
              style={{ fontSize: 24, fontWeight: 700, height: 60, textAlign: 'right', padding: '0 16px', color: 'var(--accent-600)' }}
              placeholder="0.00"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8 }}>Beneficiary Name</label>
            <input 
              id="maker_beneficiary"
              type="text"
              value={fields.beneficiary}
              onChange={e => setFields({...fields, beneficiary: e.target.value.toUpperCase()})}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="input-field"
              placeholder="PAYEE NAME"
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8 }}>Instrument Date</label>
              <input 
                type="date"
                value={fields.date}
                onChange={e => setFields({...fields, date: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8 }}>Cheque No</label>
              <input 
                type="text"
                value={fields.chqNo}
                onChange={e => setFields({...fields, chqNo: e.target.value})}
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', gap: 8 }}>
               <input value={fields.micr1} onChange={e => setFields({...fields, micr1: e.target.value})} className="input-field" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} placeholder="M1" />
               <input value={fields.micr2} onChange={e => setFields({...fields, micr2: e.target.value})} className="input-field" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} placeholder="M2" />
               <input value={fields.micr3} onChange={e => setFields({...fields, micr3: e.target.value})} className="input-field" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} placeholder="M3" />
            </div>
            
            <button 
              onClick={() => handleSave()}
              disabled={saving || !fields.amount || !fields.beneficiary}
              className="btn-primary"
              style={{ height: 50, fontSize: 'var(--text-md)', fontWeight: 700 }}
            >
              {saving ? 'Saving...' : (current === (slip.cheques?.length || 1) - 1 ? 'Finish Slip' : 'Save & Next')}
            </button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button 
                disabled={current === 0} 
                onClick={() => setCurrent(current - 1)}
                className="btn-secondary" 
                style={{ flex: 1, marginRight: 8 }}
              >
                Previous
              </button>
              <button 
                disabled={current === (slip.cheques?.length || 1) - 1} 
                onClick={() => setCurrent(current + 1)}
                className="btn-secondary" 
                style={{ flex: 1 }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
