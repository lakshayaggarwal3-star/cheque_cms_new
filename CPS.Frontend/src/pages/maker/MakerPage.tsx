// =============================================================================
// File        : MakerPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Maker
// Description : Maker (L1) batch overview and slip entry dispatch.
// Created     : 2026-05-03
// =============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBatchByNumber, updateBatchStatus } from '../../services/batchService';
import { getSlipsByBatch } from '../../services/slipService';
import { getMakerItems } from '../../services/makerService';
import { BatchDto, SlipEntryDto, BatchStatus, ChequeItemDto, SlipItemDto } from '../../types';
import { toast } from '../../store/toastStore';
import { SlipMappingModal } from './SlipMappingModal';

// ── Components ───────────────────────────────────────────────────────────────

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

function Badge({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', background: 'var(--bg-subtle)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      fontSize: '11px', color: 'var(--fg-muted)',
      whiteSpace: 'nowrap',
    }}>
      <Icon name={icon} size={14} style={{ opacity: 0.6 }} />
      <span style={{ fontWeight: 500 }}>{label}:</span>
      <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{value || '—'}</span>
    </div>
  );
}

function KpiCard({ label, value, icon, iconBg }: { label: string; value: string | number; icon: string; iconBg: string }) {
  return (
    <div style={{
      flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20,
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--r-md)',
        background: iconBg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon name={icon} size={24} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: '10px', color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg)' }}>{value}</span>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function MakerPage() {
  const { batchNo } = useParams<{ batchNo: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchDto | null>(null);
  const [slips, setSlips] = useState<SlipEntryDto[]>([]);
  const [allCheques, setAllCheques] = useState<ChequeItemDto[]>([]);
  const [globalSlipImages, setGlobalSlipImages] = useState<SlipItemDto[]>([]);
  const [globalSlipEntryId, setGlobalSlipEntryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mappingOpen, setMappingOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const load = useCallback(async () => {
    if (!batchNo) return;
    setLoading(true);
    try {
      const b = await getBatchByNumber(batchNo);
      setBatch(b);
      
      const [allSlipsRaw, c] = await Promise.all([
        getSlipsByBatch(b.batchID),
        getMakerItems(b.batchID)
      ]);

      setAllCheques(c);
      
      const gSlip = allSlipsRaw.find(s => s.slipNo === 'GLOBAL' || s.depositSlipNo === 'GLOBAL');
      const globalImages = gSlip?.slipItems || [];
      setGlobalSlipEntryId(gSlip?.slipEntryId ?? null);

      // Filter out "GLOBAL" placeholder slips from the main table view
      const filteredSlips = allSlipsRaw.filter(slip =>
        slip.slipNo !== 'GLOBAL' && slip.depositSlipNo !== 'GLOBAL'
      );
      setSlips(filteredSlips);
      setGlobalSlipImages(globalImages);

      // Auto-open mapping modal only on the very first load, not on subsequent refreshes
      if (globalImages.length > 0 && !autoOpenedRef.current) {
        autoOpenedRef.current = true;
        setMappingOpen(true);
      }
    } catch {
      toast.error('Failed to load batch details');
    } finally {
      setLoading(false);
    }
  }, [batchNo]);

  useEffect(() => { load(); }, [load]);

  const handleCompleteBatch = async () => {
    if (!batch) return;
    try {
      await updateBatchStatus(batch.batchID, BatchStatus.MakerCompleted);
      toast.success('Batch marked as Maker Completed');
      navigate('/maker');
    } catch {
      toast.error('Failed to complete batch');
    }
  };

  if (loading || !batch) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)' }}>Loading batch...</div>;
  }

  const totalChequesInBatch = slips.reduce((acc, s) => acc + (s.cheques?.length || 0), 0);
  const totalInstrumentsExpected = slips.reduce((acc, s) => acc + s.totalInstruments, 0);
  const totalAmount = slips.reduce((acc, s) => acc + Number(s.slipAmount), 0);
  
  const isAllComplete = slips.length > 0 && slips.every(s => 
    s.totalInstruments > 0 && 
    (s.cheques?.length || 0) === s.totalInstruments && 
    s.cheques.every(c => c.makerAmount !== null && c.makerAmount !== undefined)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      
      {/* ── Theme-Aware Header ─────────────────────────────────────────────── */}
      <header style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 60, background: 'var(--bg-raised)', color: 'var(--fg)',
        borderBottom: '1px solid var(--border)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={() => navigate('/maker')}
            style={{ 
              width: 32, height: 32, borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <Icon name="arrow_back" size={18} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge label="Batch" value={batch.batchNo} icon="tag" />
            <Badge label="Sum Ref" value={batch.summRefNo || '—'} icon="receipt_long" />
            <Badge label="Loc" value={batch.locationCode} icon="location_on" />
            <Badge label="Cluster" value={batch.clusterCode || '—'} icon="hub" />
            <Badge label="Scanner ID" value={batch.scannerID || '—'} icon="developer_board" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
             onClick={() => setMappingOpen(true)}
             className="btn-secondary"
             style={{ height: 36, padding: '0 16px', fontSize: 13 }}
          >
             <Icon name="link" size={18} style={{ marginRight: 6 }} />
             Map Slip
          </button>

          <button
            onClick={handleCompleteBatch}
            disabled={!isAllComplete}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 36, padding: '0 20px', borderRadius: 'var(--r-md)',
              background: isAllComplete ? 'var(--accent-600)' : 'var(--bg-subtle)',
              color: isAllComplete ? '#fff' : 'var(--fg-faint)',
              border: 'none', fontWeight: 600, cursor: isAllComplete ? 'pointer' : 'not-allowed',
              fontSize: 13,
              transition: 'all 0.2s var(--ease)',
              boxShadow: isAllComplete ? 'var(--shadow-md)' : 'none'
            }}
          >
            <Icon name="verified" size={18} />
            Complete batch
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        
        {/* KPI Cards */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
          <KpiCard 
            label="Total Slips" 
            value={slips.length} 
            icon="description" 
            iconBg="rgba(217, 119, 87, 0.15)" 
          />
          <KpiCard 
            label="Cheques Processed" 
            value={`${totalChequesInBatch} / ${totalInstrumentsExpected}`} 
            icon="payments" 
            iconBg="rgba(217, 119, 87, 0.15)" 
          />
          <KpiCard 
            label="Total Batch Amount" 
            value={`₹${totalAmount.toLocaleString('en-IN')}`} 
            icon="currency_rupee" 
            iconBg="rgba(217, 119, 87, 0.15)" 
          />
        </div>

        {/* Slips Table */}
        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)', overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Slips in Batch
            </h3>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 20px', fontWeight: 500, color: 'var(--fg-subtle)', width: 60 }}>#</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, color: 'var(--fg-subtle)' }}>Slip No / Deposit No</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, color: 'var(--fg-subtle)' }}>Client</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, color: 'var(--fg-subtle)', textAlign: 'center' }}>Cheques</th>
                <th style={{ padding: '12px 20px', fontWeight: 500, color: 'var(--fg-subtle)', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px 20px', width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {slips.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-faint)' }}>No active slips found in this batch.</td>
                </tr>
              ) : slips.map((s, idx) => {
                const chqCount = s.cheques?.length || 0;
                const isComplete = chqCount >= s.totalInstruments && s.totalInstruments > 0;
                return (
                  <tr key={s.slipEntryId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '16px 20px', color: 'var(--fg-muted)', fontWeight: 500 }}>{idx + 1}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{s.depositSlipNo || '—'}</span>
                        <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>Slip: {s.slipNo}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--fg-muted)' }}>
                      {s.clientName || s.clientCode || '—'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: 'var(--fg)', fontWeight: 600 }}>
                          {chqCount} / {s.totalInstruments}
                        </span>
                        <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, (chqCount / (s.totalInstruments || 1)) * 100)}%`, 
                            height: '100%', 
                            background: 'var(--fg-muted)' 
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500 }}>
                      ₹{Number(s.slipAmount).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/maker/${batchNo}/slip/${s.slipEntryId}`)}
                        style={{
                          padding: '6px 14px', borderRadius: 'var(--r-md)',
                          background: isComplete ? 'var(--bg-subtle)' : 'var(--accent-600)',
                          color: isComplete ? 'var(--fg-muted)' : '#fff',
                          border: isComplete ? '1px solid var(--border)' : 'none',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          transition: 'all 0.2s var(--ease)',
                        }}
                      >
                        {isComplete ? 'Edit' : 'Start Entry'}
                        <Icon name="arrow_forward" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SlipMappingModal
        isOpen={mappingOpen}
        onClose={() => setMappingOpen(false)}
        onSuccess={load}
        batchNo={batch.batchNo}
        allCheques={allCheques}
        globalSlips={globalSlipImages}
        globalSlipEntryId={globalSlipEntryId}
        slips={slips}
      />
    </div>
  );
}
