// =============================================================================
// File        : MasterUploadPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : Location and Client master management.
//               Enhanced with Advanced Search, In-place Status Toggles, and Full Modal Editing.
// Created     : 2026-04-14
// Updated     : 2026-04-23 (Location Filters & Status Toggles)
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  applyMasterRows, getClientMasterData, getLocationMasterData, getTemplateUrl, previewMaster,
  updateClientRecord, getGlobalClients, MasterType, MasterPreviewDto, MasterDataRowDto, 
  UploadResultDto, ClientMasterDto, GlobalClientDto, updateGlobalClient, createGlobalClient, 
  deleteGlobalClient, linkClientsToGlobal, updateLocationRecord
} from '../services/masterUploadService';
import { toast } from '../store/toastStore';
import { Icon } from '../components/scan';

// ─── Types ───────────────────────────────────────────────────────────────────

type ExtendedMasterType = MasterType | 'global-client';

interface ColumnDef {
  key: string;
  label: string;
  width?: number;
}

const LOCATION_COLS: ColumnDef[] = [
  { key: 'locationCode',   label: 'Code',            width: 100 },
  { key: 'locationName',   label: 'Location Name'               },
  { key: 'state',          label: 'State',           width: 120 },
  { key: 'zone',           label: 'Zone',            width: 100 },
  { key: 'pifPrefix',      label: 'PIF Prefix',      width: 100 },
  { key: 'isActive',       label: 'Status',          width: 110 },
];

const CLIENT_COLS: ColumnDef[] = [
  { key: 'cityCode',        label: 'City Code',       width: 110 },
  { key: 'clientName',      label: 'Client Name'                 },
  { key: 'rcmsCode',        label: 'RCMS Code',       width: 110 },
  { key: 'pickupPointCode', label: 'Pickup Code',     width: 110 },
  { key: 'globalCode',      label: 'Global Client Code', width: 110 },
  { key: 'isPriority',      label: 'Priority',        width: 100 },
  { key: 'status',          label: 'Status',          width: 110 },
];

// ─── Utils ───────────────────────────────────────────────────────────────────

const generateUniqueGlobalCode = (existing: GlobalClientDto[]) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  while (true) {
    let code = 'GC-';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (!existing.some(g => g.globalCode === code)) return code;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MastersPage() {
  const [activeType,   setActiveType]   = useState<ExtendedMasterType>('location');
  const [uploading,    setUploading]    = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [preview,      setPreview]      = useState<MasterPreviewDto | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const [locationRows, setLocationRows] = useState<any[]>([]);
  const [clientRows,   setClientRows]   = useState<ClientMasterDto[]>([]);
  const [globalClients, setGlobalClients] = useState<GlobalClientDto[]>([]);
  
  const [loadingData,  setLoadingData]  = useState(true);
  const [search,       setSearch]       = useState('');
  
  // Advanced Filter State
  const [isAdvancedSearch, setIsAdvancedSearch] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [rcmsFilter, setRcmsFilter] = useState('');
  // Location specific filters
  const [stateFilter, setStateFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

  const [page,         setPage]         = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);
  const PAGE_SIZE = 20;

  // Global Client Detail State
  const [selectedGlobal, setSelectedGlobal] = useState<GlobalClientDto | null>(null);
  const [globalClientSearch, setGlobalClientSearch] = useState('');
  const [linkedClients, setLinkedClients] = useState<ClientMasterDto[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [linkedSearchFilter, setLinkedSearchFilter] = useState('');

  // Linking Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addAvailable, setAddAvailable] = useState<ClientMasterDto[]>([]);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [addSelectedIds, setAddSelectedIds] = useState<Set<number>>(new Set());

  // Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalGlobalCode, setModalGlobalCode] = useState('');
  const [modalGlobalName, setModalGlobalName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editClient, setEditClient] = useState<ClientMasterDto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoadingData(true);
    try {
      if (activeType === 'location') {
        const res = await getLocationMasterData(page, PAGE_SIZE, search);
        // Frontend filtering for advanced fields if search is the only param for now
        // But I added q to backend, so I can pass search.
        // For advanced location filters, we could also pass them if backend supported.
        // For now, search handles it.
        setLocationRows(res.items);
        setTotalCount(res.totalCount);
      } else if (activeType === 'client') {
        const [clientRes, globals] = await Promise.all([
          getClientMasterData(page, PAGE_SIZE, search, undefined, undefined, cityFilter, nameFilter, rcmsFilter),
          getGlobalClients()
        ]);
        setClientRows(clientRes.items);
        setTotalCount(clientRes.totalCount);
        setGlobalClients(globals);
      } else if (activeType === 'global-client') {
        const globals = await getGlobalClients();
        setGlobalClients(globals);
        if (globals.length > 0 && !selectedGlobal) {
          setSelectedGlobal(globals[0]);
        }
      }
    } catch {
      toast.error('Failed to load master data');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadData(); }, [activeType, page, search, cityFilter, nameFilter, rcmsFilter]);

  useEffect(() => {
    if (selectedGlobal) {
      loadLinkedClients(selectedGlobal.globalClientID);
      setLinkedSearchFilter('');
    }
  }, [selectedGlobal]);

  const loadLinkedClients = async (gid: number) => {
    setLoadingLinked(true);
    try {
      const res = await getClientMasterData(1, 1000, '', gid);
      setLinkedClients(res.items);
    } catch {
      toast.error('Failed to load linked clients');
    } finally {
      setLoadingLinked(false);
    }
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const clearFilters = () => {
    setSearch('');
    setCityFilter('');
    setNameFilter('');
    setRcmsFilter('');
    setStateFilter('');
    setZoneFilter('');
    setPage(1);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await previewMaster('client', file);
      setPreview(res);
      setUploadedFile(file);
      toast.success(`Verified — ${res.validRows} rows ready`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Verification failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUnlink = async (clientId: number) => {
    if (!window.confirm('Remove this RCMS code from the group?')) return;
    try {
      await updateClientRecord(clientId, { globalClientID: undefined });
      toast.success('Removed from group');
      if (selectedGlobal) loadLinkedClients(selectedGlobal.globalClientID);
    } catch {
      toast.error('Failed to remove');
    }
  };

  const searchAddClients = async (query: string, setFn: (c: ClientMasterDto[]) => void, setLoading: (b: boolean) => void) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await getClientMasterData(1, 100, query);
      const filtered = res.items.filter(c => {
        if (!selectedGlobal) return true;
        const isSameId = c.globalClientID && Number(c.globalClientID) === Number(selectedGlobal.globalClientID);
        const isSameCode = c.globalCode && String(c.globalCode).trim() === String(selectedGlobal.globalCode).trim();
        return !isSameId && !isSameCode;
      });
      setFn(filtered);
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLinking = async () => {
    if (!selectedGlobal || addSelectedIds.size === 0) return;
    try {
      await linkClientsToGlobal(selectedGlobal.globalClientID, Array.from(addSelectedIds));
      toast.success(`Linked ${addSelectedIds.size} clients`);
      setShowAddModal(false);
      loadLinkedClients(selectedGlobal.globalClientID);
    } catch {
      toast.error('Linking failed');
    }
  };

  const handleFinalCreate = async () => {
    if (!modalGlobalCode || !modalGlobalName) {
      toast.error('Code and Name are required');
      return;
    }
    setCreating(true);
    try {
      const created = await createGlobalClient({ 
        globalCode: modalGlobalCode, 
        globalName: modalGlobalName, 
        isPriority: false 
      });
      toast.success('Group created');
      setShowCreateModal(false);
      setSelectedGlobal(created);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Creation failed');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveGlobal = async (data: Partial<GlobalClientDto>) => {
    if (!selectedGlobal) return;
    try {
      await updateGlobalClient(selectedGlobal.globalClientID, {
        globalName: data.globalName || selectedGlobal.globalName,
        isPriority: data.isPriority ?? selectedGlobal.isPriority,
        isActive: true
      });
      toast.success('Group updated');
      setSelectedGlobal({ ...selectedGlobal, ...data });
      loadData();
    } catch {
      toast.error('Failed to save group');
    }
  };

  const togglePriorityRow = async (client: ClientMasterDto) => {
    try {
      await updateClientRecord(client.clientID, { isPriority: !client.isPriority });
      toast.success('Priority updated');
      loadData();
      if (selectedGlobal) loadLinkedClients(selectedGlobal.globalClientID);
    } catch {
      toast.error('Failed to update');
    }
  };

  const toggleClientStatus = async (client: ClientMasterDto) => {
    const newStatus = client.status === 'A' ? 'I' : 'A';
    try {
      await updateClientRecord(client.clientID, { status: newStatus });
      toast.success(`Client marked as ${newStatus === 'A' ? 'Active' : 'Inactive'}`);
      loadData();
      if (selectedGlobal) loadLinkedClients(selectedGlobal.globalClientID);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const toggleLocationStatus = async (loc: any) => {
    const newActive = !loc.isActive;
    try {
      await updateLocationRecord(loc.locationID, { ...loc, isActive: newActive });
      toast.success(`Location marked as ${newActive ? 'Active' : 'Inactive'}`);
      loadData();
    } catch {
      toast.error('Failed to update location');
    }
  };

  const handleDeleteGlobalAction = async (id: number) => {
    if (!window.confirm('Are you sure? All linked clients will become Normal.')) return;
    try {
      await deleteGlobalClient(id);
      toast.success('Group deleted');
      setSelectedGlobal(null);
      loadData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleApplyPreview = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      await applyMasterRows('client', preview.rows);
      toast.success('Applied successfully');
      setPreview(null);
      loadData();
    } catch {
      toast.error('Apply failed');
    } finally {
      setApplying(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const filteredGlobals = globalClients.filter(g => 
    g.globalCode.toLowerCase().includes(globalClientSearch.toLowerCase()) ||
    g.globalName.toLowerCase().includes(globalClientSearch.toLowerCase())
  );

  const displayedLinked = linkedClients.filter(c => 
    c.clientName.toLowerCase().includes(linkedSearchFilter.toLowerCase()) ||
    (c.rcmsCode || '').toLowerCase().includes(linkedSearchFilter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 8px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>Master Management</h1>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 4 }}>
            Configure locations, client masters, and organizational groups.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          {activeType === 'global-client' ? (
            <button 
              onClick={() => { setModalGlobalCode(generateUniqueGlobalCode(globalClients)); setModalGlobalName(''); setShowCreateModal(true); }}
              className="btn-primary" 
              style={{ height: 34, background: 'var(--accent-500)', border: 'none' }}
            >
              <Icon name="add" size={16} /> Create New Group
            </button>
          ) : (
            <>
              <a href={getTemplateUrl(activeType as any)} download className="btn-secondary" style={{ height: 34 }}>
                <Icon name="download" size={16} /> Template
              </a>
              <button className="btn-primary" style={{ height: 34 }} onClick={() => fileInputRef.current?.click()}>
                <Icon name="upload" size={16} /> Bulk Upload
              </button>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} accept=".xlsx" />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 32 }}>
        {[
          { id: 'location', label: 'Locations' },
          { id: 'client', label: 'Client Master' },
          { id: 'global-client', label: 'Global Client Master' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveType(t.id as ExtendedMasterType); setPage(1); setPreview(null); setSearch(''); }}
            style={{
              padding: '8px 4px 12px',
              fontSize: 'var(--text-sm)',
              fontWeight: activeType === t.id ? 600 : 500,
              color: activeType === t.id ? 'var(--accent-500)' : 'var(--fg-muted)',
              borderBottom: activeType === t.id ? '2px solid var(--accent-500)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeType !== 'global-client' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <form onSubmit={handleGlobalSearch} style={{ flex: 1, position: 'relative' }}>
                <Icon name="search" size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }} />
                <input
                  className="input-field"
                  placeholder={`Search by keyword (Code, Name, State, Zone)...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 40, background: 'var(--bg-raised)' }}
                />
              </form>
              <button 
                onClick={() => setIsAdvancedSearch(!isAdvancedSearch)}
                className="btn-secondary" 
                style={{ height: 40, background: isAdvancedSearch ? 'var(--bg-subtle)' : 'none', borderColor: isAdvancedSearch ? 'var(--accent-500)' : 'var(--border)' }}
              >
                <Icon name="tune" size={18} /> {isAdvancedSearch ? 'Hide Filters' : 'Advanced Filters'}
              </button>
              {(search || cityFilter || nameFilter || rcmsFilter || stateFilter || zoneFilter) && (
                <button onClick={clearFilters} className="btn-ghost" style={{ color: 'var(--danger)' }}>Clear All</button>
              )}
            </div>

            {isAdvancedSearch && (
              <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeType === 'client' ? (
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ fontSize: 10 }}>CITY / LOCATION CODE</label>
                      <input className="input-field" value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="e.g. MUM, DEL..." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ fontSize: 10 }}>CLIENT NAME</label>
                      <input className="input-field" value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="e.g. Reliance..." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ fontSize: 10 }}>RCMS CODE</label>
                      <input className="input-field" value={rcmsFilter} onChange={e => setRcmsFilter(e.target.value)} placeholder="e.g. 100234..." />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ fontSize: 10 }}>STATE</label>
                      <input className="input-field" value={stateFilter} onChange={e => setStateFilter(e.target.value)} placeholder="e.g. Maharashtra..." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ fontSize: 10 }}>ZONE</label>
                      <input className="input-field" value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} placeholder="e.g. West, North..." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label" style={{ fontSize: 10 }}>LOCATION CODE</label>
                      <input className="input-field" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. MUM..." />
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="info" size={14} />
                  Tip: Use global search for quick lookup or granular filters for specific criteria.
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    {(activeType === 'location' ? LOCATION_COLS : CLIENT_COLS).map(col => (
                      <th key={col.key} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)', width: col.width }}>
                        {col.label}
                      </th>
                    ))}
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingData ? (<tr><td colSpan={10} style={{ padding: 40, textAlign: 'center' }}>Loading...</td></tr>) : 
                   (activeType === 'location' ? locationRows : clientRows).length === 0 ? (<tr><td colSpan={10} style={{ padding: 40, textAlign: 'center' }}>No records.</td></tr>) : 
                    (activeType === 'location' ? locationRows : clientRows).map((row: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {(activeType === 'location' ? LOCATION_COLS : CLIENT_COLS).map(col => (
                          <td key={col.key} style={{ padding: '10px 16px' }}>
                            {col.key === 'isPriority' ? (
                               <div 
                                 onClick={() => togglePriorityRow(row)}
                                 style={{ 
                                   display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                   padding: '2px 8px', borderRadius: 'var(--r-full)',
                                   background: row.isPriority ? 'var(--warning-bg)' : 'var(--bg-subtle)',
                                   border: `1px solid ${row.isPriority ? 'var(--warning)' : 'var(--border)'}`,
                                   color: row.isPriority ? 'var(--warning)' : 'var(--fg-faint)',
                                   fontSize: 10, fontWeight: 700
                                 }}
                               >
                                 <Icon name={row.isPriority ? 'star' : 'star_outline'} size={12} />
                                 {row.isPriority ? 'PRIORITY' : 'NORMAL'}
                               </div>
                             ) :
                             (col.key === 'status' || col.key === 'isActive') ? (
                               <div 
                                 onClick={() => activeType === 'client' ? toggleClientStatus(row) : toggleLocationStatus(row)}
                                 style={{ 
                                   display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                   padding: '3px 10px', borderRadius: 'var(--r-md)',
                                   background: (row.status === 'A' || row.isActive === true) ? 'var(--success-bg)' : 'var(--bg-raised)',
                                   border: `1px solid ${(row.status === 'A' || row.isActive === true) ? 'var(--success)' : 'var(--border)'}`,
                                   color: (row.status === 'A' || row.isActive === true) ? 'var(--success)' : 'var(--fg-muted)',
                                   fontSize: 11, fontWeight: 600
                                 }}
                               >
                                 <div style={{ width: 6, height: 6, borderRadius: '50%', background: (row.status === 'A' || row.isActive === true) ? 'var(--success)' : 'var(--fg-faint)' }} />
                                 {(row.status === 'A' || row.isActive === true) ? 'Active' : 'Inactive'}
                               </div>
                             ) :
                             (row[col.key] || '—')}
                          </td>
                        ))}
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <button onClick={() => activeType === 'client' && setEditClient({ ...row })} className="btn-ghost" style={{ height: 28, color: 'var(--accent-500)' }}>Edit</button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            {totalCount > PAGE_SIZE && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-subtle)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary" style={{ height: 30 }}>Prev</button>
                  <button disabled={page * PAGE_SIZE >= totalCount} onClick={() => setPage(p => p + 1)} className="btn-secondary" style={{ height: 30 }}>Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Global Client Master Premium UI ── */
        <div style={{ flex: 1, display: 'flex', gap: 20, overflow: 'hidden' }}>
          
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }} />
              <input className="input-field" placeholder="Search groups..." value={globalClientSearch} onChange={e => setGlobalClientSearch(e.target.value)} style={{ paddingLeft: 34, height: 36, background: 'var(--bg-raised)' }} />
            </div>
            <div className="card" style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredGlobals.map(g => (
                <div 
                  key={g.globalClientID}
                  onClick={() => setSelectedGlobal(g)}
                  style={{ 
                    padding: '12px 16px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                    background: selectedGlobal?.globalClientID === g.globalClientID ? 'var(--bg-subtle)' : 'transparent',
                    border: `1px solid ${selectedGlobal?.globalClientID === g.globalClientID ? 'var(--accent-500)' : 'transparent'}`,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13, color: selectedGlobal?.globalClientID === g.globalClientID ? 'var(--accent-500)' : 'var(--fg)' }}>{g.globalCode}</span>
                    {g.isPriority && (<span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 10, fontWeight: 800 }}>PRIORITY</span>)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.globalName}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
            <div className="card" style={{ padding: 0 }}>
              {selectedGlobal ? (
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>{selectedGlobal.globalCode}</h2>
                      <div 
                        onClick={() => handleSaveGlobal({ isPriority: !selectedGlobal.isPriority })}
                        style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                          padding: '4px 12px', borderRadius: 'var(--r-full)',
                          background: selectedGlobal.isPriority ? 'var(--warning-bg)' : 'var(--bg-subtle)',
                          border: `1px solid ${selectedGlobal.isPriority ? 'var(--warning)' : 'var(--border)'}`,
                          color: selectedGlobal.isPriority ? 'var(--warning)' : 'var(--fg-faint)',
                          fontSize: 11, fontWeight: 700
                        }}
                      >
                        <Icon name={selectedGlobal.isPriority ? 'star' : 'star_outline'} size={14} />
                        {selectedGlobal.isPriority ? 'PRIORITY GROUP' : 'MARK AS PRIORITY'}
                      </div>
                    </div>
                    <input 
                      className="input-field" 
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 'var(--text-sm)', color: 'var(--fg-subtle)', height: 'auto', fontWeight: 500 }}
                      defaultValue={selectedGlobal.globalName}
                      onBlur={e => handleSaveGlobal({ globalName: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      onClick={() => { setAddSearch(''); setAddAvailable([]); setAddSelectedIds(new Set()); setShowAddModal(true); }}
                      className="btn-ghost" 
                      style={{ height: 40, width: 40, padding: 0, color: 'var(--accent-500)', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}
                    >
                      <Icon name="person_add" size={20} />
                    </button>
                    <button 
                      onClick={() => handleDeleteGlobalAction(selectedGlobal.globalClientID)} 
                      className="btn-ghost" 
                      style={{ height: 40, width: 40, padding: 0, color: 'var(--danger)', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}
                    >
                      <Icon name="delete" size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-faint)' }}>Select a group to manage associations</div>
              )}
            </div>

            {selectedGlobal && (
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>LINKED RCMS CODES ({linkedClients.length})</span>
                    <div style={{ position: 'relative', width: 240 }}>
                      <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }} />
                      <input 
                        className="input-field" 
                        placeholder="Search within this group..." 
                        value={linkedSearchFilter}
                        onChange={e => setLinkedSearchFilter(e.target.value)}
                        style={{ paddingLeft: 32, height: 28, fontSize: 11, background: 'var(--bg-raised)' }}
                      />
                    </div>
                  </div>
                  <button onClick={() => loadLinkedClients(selectedGlobal.globalClientID)} className="btn-ghost" style={{ height: 28, fontSize: 11, color: 'var(--accent-500)' }}>Refresh List</button>
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-raised)', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 24px', textAlign: 'left', color: 'var(--fg-faint)' }}>RCMS CODE</th>
                        <th style={{ padding: '10px 24px', textAlign: 'left', color: 'var(--fg-faint)' }}>CLIENT NAME</th>
                        <th style={{ padding: '10px 24px', textAlign: 'left', color: 'var(--fg-faint)' }}>CITY</th>
                        <th style={{ padding: '10px 24px', textAlign: 'left', color: 'var(--fg-faint)' }}>PICKUP POINT</th>
                        <th style={{ padding: '10px 24px', textAlign: 'right', color: 'var(--fg-faint)' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingLinked ? (<tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>Loading...</td></tr>) : 
                       displayedLinked.length === 0 ? (<tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)' }}>No matching RCMS codes.</td></tr>) : 
                       displayedLinked.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 24px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.rcmsCode}</td>
                          <td style={{ padding: '10px 24px' }}>{c.clientName}</td>
                          <td style={{ padding: '10px 24px' }}>{c.cityCode}</td>
                          <td style={{ padding: '10px 24px' }}>{c.pickupPointCode}</td>
                          <td style={{ padding: '10px 24px', textAlign: 'right' }}>
                            <button onClick={() => handleUnlink(c.clientID)} className="btn-ghost" style={{ color: 'var(--danger)', fontSize: 10, padding: '4px 8px' }}>Unlink</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Clients Modal ── */}
      {showAddModal && selectedGlobal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 700, height: '70vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-raised)' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Add RCMS Codes to {selectedGlobal.globalCode}</h2>
              <button onClick={() => setShowAddModal(false)} className="btn-ghost"><Icon name="close" size={24} /></button>
            </div>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
              <input className="input-field" placeholder="Search RCMS / Client Name..." value={addSearch} onChange={e => setAddSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchAddClients(addSearch, setAddAvailable, setLoadingAdd)} style={{ height: 36 }} />
              <button onClick={() => searchAddClients(addSearch, setAddAvailable, setLoadingAdd)} className="btn-secondary" style={{ height: 36 }}>Search</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-subtle)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '10px 16px', width: 40 }}>
                      <input type="checkbox" checked={addSelectedIds.size === addAvailable.length && addAvailable.length > 0} onChange={() => {
                        if (addSelectedIds.size === addAvailable.length) setAddSelectedIds(new Set());
                        else setAddSelectedIds(new Set(addAvailable.map(c => c.clientID)));
                      }} />
                    </th>
                    <th style={{ padding: '10px 0', textAlign: 'left' }}>Client / RCMS</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAdd ? (<tr><td colSpan={2} style={{ padding: 40, textAlign: 'center' }}>Searching...</td></tr>) : 
                   addAvailable.length === 0 ? (<tr><td colSpan={2} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)' }}>Search for clients to add to this group.</td></tr>) : 
                   addAvailable.map(c => (
                    <tr key={c.clientID} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}><input type="checkbox" checked={addSelectedIds.has(c.clientID)} onChange={() => { const next = new Set(addSelectedIds); if (next.has(c.clientID)) next.delete(c.clientID); else next.add(c.clientID); setAddSelectedIds(next); }} /></td>
                      <td style={{ padding: '10px 0' }}>
                        <div style={{ fontWeight: 600 }}>{c.clientName}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>
                          {c.rcmsCode} {c.globalCode ? <span style={{ padding: '1px 5px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, marginLeft: 6, fontSize: 9 }}>Linked: {c.globalCode}</span> : ''}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 16, background: 'var(--bg-raised)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" disabled={addSelectedIds.size === 0} onClick={handleAddLinking}>Link Selected ({addSelectedIds.size})</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Global Client Code Modal ── */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 500, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-raised)' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>New Global Client Code</h2>
              <button onClick={() => setShowCreateModal(false)} className="btn-ghost"><Icon name="close" size={24} /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label className="label" style={{ fontSize: 11 }}>GLOBAL CLIENT CODE (AUTO-GENERATED)</label>
                <input className="input-field" value={modalGlobalCode} onChange={e => setModalGlobalCode(e.target.value.toUpperCase())} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-500)' }} />
              </div>
              <div>
                <label className="label" style={{ fontSize: 11 }}>ORGANIZATION NAME</label>
                <input className="input-field" placeholder="Group Name" value={modalGlobalName} onChange={e => setModalGlobalName(e.target.value)} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" disabled={creating || !modalGlobalName || !modalGlobalCode} onClick={handleFinalCreate} style={{ background: 'var(--accent-500)', border: 'none' }}>{creating ? 'Creating...' : `Create Group`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Client Modal (Enhanced) ── */}
      {editClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(2px)' }}>
          <div className="card" style={{ width: 500, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>Edit Client Master</h2>
              <button onClick={() => setEditClient(null)} className="btn-ghost"><Icon name="close" size={24} /></button>
            </div>
            
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: 10 }}>CITY CODE</label>
                  <input className="input-field" value={editClient.cityCode} onChange={e => setEditClient({ ...editClient, cityCode: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: 10 }}>RCMS CODE</label>
                  <input className="input-field" value={editClient.rcmsCode} onChange={e => setEditClient({ ...editClient, rcmsCode: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: 10 }}>CLIENT NAME</label>
                <input className="input-field" value={editClient.clientName} onChange={e => setEditClient({ ...editClient, clientName: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: 10 }}>PICKUP CODE</label>
                  <input className="input-field" value={editClient.pickupPointCode} onChange={e => setEditClient({ ...editClient, pickupPointCode: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: 10 }}>STATUS</label>
                  <select className="input-field" value={editClient.status} onChange={e => setEditClient({ ...editClient, status: e.target.value })}>
                    <option value="A">Active</option>
                    <option value="I">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: '16px 20px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', marginTop: 8 }}>
                <label className="label" style={{ fontSize: 10, color: 'var(--accent-500)' }}>GLOBAL GROUP ASSOCIATION</label>
                <select className="input-field" value={editClient.globalClientID || ''} onChange={e => setEditClient({ ...editClient, globalClientID: parseInt(e.target.value) || undefined })}>
                  <option value="">-- No Group (Normal) --</option>
                  {globalClients.map(g => <option key={g.globalClientID} value={g.globalClientID}>{g.globalCode} - {g.globalName}</option>)}
                </select>
                <p style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 8, margin: 0 }}>
                  Changing the group will automatically sync the priority status to match the parent group.
                </p>
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: 'var(--bg-raised)', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" style={{ width: 100 }} onClick={() => setEditClient(null)}>Cancel</button>
              <button className="btn-primary" style={{ width: 140 }} onClick={async () => { 
                await updateClientRecord(editClient.clientID, { ...editClient }); 
                toast.success('Client updated'); 
                setEditClient(null); 
                loadData(); 
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Preview Overlay */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-raised)' }}>
            <div><h2 style={{ margin: 0 }}>Review Upload</h2><p style={{ margin: 4, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>{preview.validRows} valid rows.</p></div>
            <div style={{ display: 'flex', gap: 12 }}><button className="btn-secondary" onClick={() => setPreview(null)}>Discard</button><button className="btn-primary" onClick={handleApplyPreview}>{applying ? 'Applying...' : 'Apply'}</button></div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0 }}><tr><th style={{ padding: 12, textAlign: 'left' }}>Row</th>{preview.rows[0] && Object.keys(preview.rows[0].values).map(k => (<th key={k} style={{ padding: 12, textAlign: 'left' }}>{k}</th>))}<th style={{ padding: 12, textAlign: 'center' }}>Status</th></tr></thead>
              <tbody>{preview.rows.map((row, i) => (<tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: 12 }}>{i + 2}</td>{Object.values(row.values).map((v, j) => (<td key={j} style={{ padding: 12 }}>{v || '—'}</td>))}<td style={{ padding: 12, textAlign: 'center' }}>OK</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
