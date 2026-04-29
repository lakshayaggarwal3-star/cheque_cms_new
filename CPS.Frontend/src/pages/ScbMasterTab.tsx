// =============================================================================
// File        : ScbMasterTab.tsx
// Project     : CPS — Cheque Processing System
// Module      : Admin / SCB Master
// Description : Dashboard for CHM XML upload and master data viewing.
// Created     : 2026-04-25
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../components/scan';
import { toast } from '../store/toastStore';

// ── Types ────────────────────────────────────────────────────────────────────
interface ScbMasterStatus {
  sectionName: string;
  lastUpdatedAt: string | null;
  recordCount: number;
  version: string | null;
  updatedByUserName: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ScbMasterTab() {
  const [statuses, setStatuses] = useState<ScbMasterStatus[]>([]);
  
  // Data Viewer state
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [viewData, setViewData] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/scb-master/status');
      const data = await res.json();
      if (data.success) {
        setStatuses(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch SCB Master status', err);
    }
  };

  const fetchSectionData = async (section: string, pageNum: number, query: string) => {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/scb-master/data/${section}?q=${encodeURIComponent(query)}&page=${pageNum}&pageSize=15`);
      const data = await res.json();
      if (data.success) {
        setViewData(data.data.items);
        setTotalCount(data.data.totalCount);
        setPage(data.data.page);
      }
    } catch (err) {
      console.error('Failed to fetch section data', err);
    } finally {
      setViewLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (selectedSection) {
      fetchSectionData(selectedSection, 1, search);
    }
  }, [selectedSection, search]);


  const sections = [
    { id: 'Bank',            label: 'Banks',             icon: 'account_balance' },
    { id: 'Branch',          label: 'Branches',          icon: 'location_on' },
    { id: 'ReturnReason',    label: 'Return Reasons',    icon: 'assignment_return' },
    { id: 'Session',         label: 'Sessions',          icon: 'schedule' },
    { id: 'City',            label: 'City Master',       icon: 'apartment' },
    { id: 'TranslationRule', label: 'Translation Rules', icon: 'swap_horiz' },
  ];

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      
      {/* Left Column: Status List */}
      <div style={{ 
        width: 320, 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 20, 
        borderRight: '1px solid var(--border)',
        paddingRight: 20
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map(sec => {
            const status = statuses.find(s => s.sectionName === sec.id);
            const active = selectedSection === sec.id;
            return (
              <div 
                key={sec.id} 
                onClick={() => setSelectedSection(sec.id)}
                style={{
                  padding: '16px 20px',
                  background: active ? 'var(--accent-50)' : 'var(--bg-raised)',
                  borderRadius: 'var(--r-md)',
                  border: `1px solid ${active ? 'var(--accent-300)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'all 0.2s ease',
                  color: active ? 'var(--accent-900)' : 'var(--fg)'
                }}
              >
                <span className="material-symbols-outlined" style={{ 
                  color: active ? 'var(--accent-600)' : 'var(--fg-muted)',
                  fontSize: 22
                }}>
                  {sec.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'inherit' }}>{sec.label}</div>
                  <div style={{ fontSize: 11, color: active ? 'var(--accent-700)' : 'var(--fg-subtle)' }}>
                    {status ? `${status.recordCount.toLocaleString()} records • v${status.version || '1.0'}` : 'Not loaded'}
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? 'var(--accent-400)' : 'var(--fg-faint)' }}>chevron_right</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Data Viewer */}
      {selectedSection && (
        <div style={{ 
          flex: 1, 
          background: 'var(--bg-raised)', 
          borderRadius: 'var(--r-lg)', 
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600 }}>{sections.find(s => s.id === selectedSection)?.label} Data</h3>
            
            <div style={{ flex: 1, position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--fg-faint)' }}>search</span>
              <input 
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={async () => {
                  if (window.confirm(`PERMANENTLY DELETE all ${selectedSection} data?`)) {
                    try {
                      const res = await fetch(`/api/masters/clear/scb-master?section=${selectedSection}`, { method: 'POST' });
                      if (res.ok) { toast.success(`${selectedSection} Cleared`); fetchStatus(); fetchSectionData(selectedSection, 1, search); }
                    } catch { toast.error('Clear failed'); }
                  }
                }}
                className="btn-secondary" 
                style={{ height: 32, color: 'var(--error)', fontSize: 12, padding: '0 12px' }}
              >
                <Icon name="delete_sweep" size={16} /> Clear
              </button>
              <button 
                onClick={() => window.open(`/api/masters/export/scb-master?section=${selectedSection}`, '_blank')}
                className="btn-secondary" 
                style={{ height: 32, color: 'var(--accent-600)', fontSize: 12, padding: '0 12px' }}
              >
                <Icon name="download" size={16} /> Export
              </button>
            </div>

            <button 
              onClick={() => setSelectedSection(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-muted)' }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 'var(--text-xs)' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-subtle)', zIndex: 1 }}>
                <tr>
                  {viewData[0] && Object.keys(viewData[0]).filter(k => k !== 'id' && k !== 'createdAt').map(k => (
                    <th key={k} style={{ 
                      textAlign: 'left', 
                      padding: '14px 16px', 
                      borderBottom: '2px solid var(--border)', 
                      color: 'var(--fg-muted)', 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em',
                      background: 'var(--bg-subtle)'
                    }}>
                      {k.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewLoading ? (
                  Array(10).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={10} style={{ padding: '12px 16px' }}><div className="skeleton" style={{ height: 12, width: '100%' }} /></td></tr>
                  ))
                ) : (
                  viewData.map((row, i) => (
                    <tr key={i} className="hover-row" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {Object.entries(row).filter(([k]) => k !== 'id' && k !== 'createdAt').map(([k, v]: any) => (
                        <td key={k} style={{ padding: '12px 16px', color: 'var(--fg-subtle)' }}>{v === true ? 'Yes' : v === false ? 'No' : (v || '—')}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!viewLoading && viewData.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-faint)' }}>No records found</div>
            )}
          </div>

          {/* Pagination */}
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
            <span style={{ color: 'var(--fg-muted)' }}>Showing {((page - 1) * 15) + 1} to {Math.min(page * 15, totalCount)} of {totalCount.toLocaleString()}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                disabled={page === 1} 
                onClick={() => fetchSectionData(selectedSection!, page - 1, search)}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >Previous</button>
              <button 
                disabled={page * 15 >= totalCount} 
                onClick={() => fetchSectionData(selectedSection!, page + 1, search)}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', cursor: page * 15 >= totalCount ? 'not-allowed' : 'pointer' }}
              >Next</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { border-radius: 50%; }
        .skeleton { background: var(--border-subtle); border-radius: 4px; animation: pulse 1.5s infinite ease-in-out; }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 0.8; } 100% { opacity: 0.5; } }
        .hover-row:hover { background: var(--bg-subtle) !important; }
      `}</style>
    </div>
  );
}
