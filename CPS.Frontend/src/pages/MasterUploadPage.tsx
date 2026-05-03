// =============================================================================
// File        : MasterUploadPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : Location and Client master management.
//               Enhanced with Advanced Search, In-place Status Toggles, and Full Modal Editing.
// Created     : 2026-04-14
// Updated     : 2026-04-23 (Location Filters & Status Toggles)
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  getClientMasterData, getLocationMasterData, getTemplateUrl,
  updateClientRecord, getGlobalClients, MasterType, MasterPreviewDto, 
  ClientMasterDto, GlobalClientDto, updateGlobalClient, createGlobalClient, 
  deleteGlobalClient, linkClientsToGlobal, updateLocationRecord,
  getInternalBankData, getCaptureRuleData,
  clearMaster, uploadMaster, getJobStatus, cancelJob, deleteJob, getUserJobs, JobStatusDto
} from '../services/masterUploadService';
import { toast } from '../store/toastStore';
import { Icon } from '../components/scan';
import ScbMasterTab from './ScbMasterTab';

// ─── Types ───────────────────────────────────────────────────────────────────

type ExtendedMasterType = MasterType | 'global-client' | 'scb-master' | 'internal-bank' | 'capture-rule';

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

const BANK_COLS: ColumnDef[] = [
  { key: 'ebank',    label: 'EBANK',    width: 100 },
  { key: 'sortcode', label: 'SORTCODE', width: 100 },
  { key: 'name',     label: 'Name'                 },
  { key: 'fullname', label: 'Full Name'             },
  { key: 'branch',   label: 'Branch',   width: 120 },
];

const RULE_COLS: ColumnDef[] = [
  { key: 'ceid',       label: 'CEID',        width: 100 },
  { key: 'clientCode', label: 'ClientCode',  width: 120 },
  { key: 'fieldName1', label: 'FieldName1'             },
  { key: 'fieldName2', label: 'FieldName2'             },
  { key: 'fieldName3', label: 'FieldName3'             },
  { key: 'fieldName4', label: 'FieldName4'             },
  { key: 'fieldName5', label: 'FieldName5'             },
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

const getJobDisplayName = (type: string) => {
  switch (type.toLowerCase()) {
    case 'location': return 'Location Master';
    case 'client': return 'Client Master';
    case 'internal-bank': return 'RCMS Bank Code Master';
    case 'capture-rule': return 'Enrichment Master';
    case 'scb-master': return 'CMH Master';
    default: return type;
  }
};

const formatToIST = (date: string | Date) => {
  if (!date) return '—';
  const d = new Date(date);
  // If the date is missing the 'Z' (UTC indicator), append it to ensure correct local conversion
  const utcDate = typeof date === 'string' && !date.endsWith('Z') ? new Date(date + 'Z') : d;
  
  return utcDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MastersPage() {
  const [activeType,   setActiveType]   = useState<ExtendedMasterType>('location');
  const [applying,     setApplying]     = useState(false);
  const [verifying,    setVerifying]    = useState(false);
  const [preview,      setPreview]      = useState<MasterPreviewDto | null>(null);
  const [pendingFile,  setPendingFile]  = useState<File | null>(null);
  
  const [locationRows, setLocationRows] = useState<any[]>([]);
  const [clientRows,   setClientRows]   = useState<ClientMasterDto[]>([]);
  const [globalClients, setGlobalClients] = useState<GlobalClientDto[]>([]);
  const [bankRows,     setBankRows]      = useState<any[]>([]);
  const [ruleRows,     setRuleRows]      = useState<any[]>([]);
  
  // Drawer state for recent jobs
  const [showJobsDrawer, setShowJobsDrawer] = useState(false);
  const [recentJobs,   setRecentJobs]    = useState<JobStatusDto[]>([]);
  
  const [loadingData,  setLoadingData]  = useState(true);
  const [search,       setSearch]       = useState('');

  // Background Job State
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusDto | null>(null);
  
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
  const [editLocation, setEditLocation] = useState<any | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (activeType === 'location') {
        const res = await getLocationMasterData(page, PAGE_SIZE, search);
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
      } else if (activeType === 'internal-bank') {
        const res = await getInternalBankData(page, PAGE_SIZE, search);
        setBankRows(res.items);
        setTotalCount(res.totalCount);
      } else if (activeType === 'capture-rule') {
        const res = await getCaptureRuleData(page, PAGE_SIZE, search);
        setRuleRows(res.items);
        setTotalCount(res.totalCount);
      }
    } catch {
      toast.error('Failed to load master data');
    } finally {
      setLoadingData(false);
    }
  }, [activeType, page, search, cityFilter, nameFilter, rcmsFilter, selectedGlobal]);

  const fetchJobs = async () => {
    try {
      const jobs = await getUserJobs();
      setRecentJobs(jobs);
    } catch {
      toast.error('Failed to load recent jobs.');
    }
  };

  useEffect(() => {
    let intervalId: any;
    if (showJobsDrawer) {
      fetchJobs(); // Fetch immediately when opened
      intervalId = setInterval(() => {
        fetchJobs();
      }, 10000); // And every 10s
    }
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showJobsDrawer]);

  useEffect(() => { loadData(); }, [activeType, page, search, cityFilter, nameFilter, rcmsFilter, loadData]);

  // Manual Job Refresh Function
  const refreshJobStatus = useCallback(async () => {
    if (!activeJobId) return;
    try {
      const status = await getJobStatus(activeJobId);
      setJobStatus(status);
      if (status.status === 'Completed' || status.status === 'Failed' || status.status === 'Cancelled') {
        if (status.status === 'Completed') {
          toast.success(`Upload completed! ${status.insertedCount} inserted, ${status.updatedCount} updated.`);
          loadData();
        } else if (status.status === 'Failed') {
          toast.error(`Upload failed: ${status.errorMessage}`);
        }
      }
    } catch (err) {
      console.error('Refresh error', err);
    }
  }, [activeJobId, loadData]);

  useEffect(() => {
    let intervalId: any;
    if (activeJobId && (!jobStatus || jobStatus.status === 'Processing' || jobStatus.status === 'Pending')) {
      intervalId = setInterval(() => {
        refreshJobStatus();
      }, 10000);
    }
    return () => clearInterval(intervalId);
  }, [activeJobId, jobStatus, refreshJobStatus]);

  // Initial fetch only
  useEffect(() => {
    if (activeJobId) {
      refreshJobStatus();
    } else {
      setJobStatus(null);
    }
  }, [activeJobId, refreshJobStatus]);


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

  const REQUIRED_HEADERS: Record<string, string[]> = {
    location: ['SrNo', 'Grid', 'State', 'LocationName', 'Location Code', 'Cluster CODE', 'Zone', 'ScannerID', 'BOFD', 'PreTrun', 'DepositAc', 'IFSC', 'LocType', 'PIF Number'],
    client: ['CITY_CODE', 'NAME', 'ADDRESS1', 'ADDRESS2', 'ADDRESS3', 'ADDRESS4', 'ADDRESS5', 'PICKUP_POINT_CODE', 'PICKUPPOINT_DESCRIPTION', 'RCMS_CODE', 'STATUS', 'STATUS_DATE'],
    'internal-bank': ['EBANK', 'SORTCODE', 'NAME', 'FULLNAME', 'BRANCH'],
    'capture-rule': ['CEID', 'ClientCode', 'FieldName1', 'FieldName2', 'FieldName3', 'FieldName4', 'FieldName5']
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // For CHM XML, we skip local Excel validation and go straight to upload
    if (activeType === 'scb-master') {
      try {
        setVerifying(true);
        const res = await uploadMaster('scb-master', file);
        toast.success('CHM XML Upload started in background');
        setActiveJobId(res.jobId);
        setShowJobsDrawer(true);
      } catch (err: any) {
        toast.error('Upload failed');
      } finally {
        setVerifying(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }
    
    setVerifying(true);
    setPendingFile(file);
    
        const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Use the range to get the total row count efficiently
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const totalExcelRows = Math.max(0, range.e.r); // e.r is the last row index (0-indexed)
        
        // Only parse the first 100 rows for the preview grid to keep it fast
        const previewData = XLSX.utils.sheet_to_json(ws, { header: 1, range: { s: { r: 0, c: 0 }, e: { r: 100, c: 50 } } }) as any[][];
        
        if (previewData.length === 0) throw new Error('File is empty');
        
        const headers = (previewData[0] || []).map(h => String(h || '').trim());
        const required = REQUIRED_HEADERS[activeType] || [];
        const missing = required.filter(h => !headers.some(actual => actual.toUpperCase() === h.toUpperCase()));
        
        const previewDto: MasterPreviewDto = {
          masterType: activeType,
          totalRows: totalExcelRows,
          validRows: missing.length === 0 ? totalExcelRows : 0,
          errorRows: missing.length === 0 ? 0 : totalExcelRows,
          rows: previewData.slice(1).map(rowArr => ({
            values: headers.reduce((acc, h, i) => {
              acc[h] = String(rowArr[i] || '');
              return acc;
            }, {} as any)
          })),
          errors: missing.map(m => ({ rowNumber: 1, field: 'Header', message: `Missing required column: ${m}` })),
          parsingLogs: [
            `Local Preview: ${file.name} loaded.`,
            `Found ${totalExcelRows} total data rows.`,
            missing.length > 0 
              ? `CRITICAL: Missing ${missing.length} headers.` 
              : `Headers verified successfully.`
          ]
        };

        setPreview(previewDto);
        if (missing.length > 0) {
          toast.error(`Invalid format: ${missing.length} headers missing`);
        } else {
          toast.success(`Verified locally — ready to apply`);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to read file');
      } finally {
        setVerifying(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      toast.error('File reading failed');
      setVerifying(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearMaster = async () => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE all ${activeType} data? This action cannot be undone.`)) return;
    try {
      await clearMaster(activeType as any);
      toast.success(`${activeType.charAt(0).toUpperCase() + activeType.slice(1)} data cleared successfully.`);
      loadData();
    } catch (err: any) {
      toast.error('Clear failed');
    }
  };

  const handleExportMaster = async () => {
    try {
      const url = `/api/masters/export/${activeType}`;
      // Note: for scb-master, the controller handles the default section
      window.open(url, '_blank');
    } catch {
      toast.error('Export failed');
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
    const s = (client.status || '').trim().toUpperCase();
    const isCurrentlyActive = !['I', 'X', '0', 'INACTIVE', 'DELETED'].includes(s);
    const newStatus = isCurrentlyActive ? 'I' : 'A';
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
    if (!pendingFile) return;
    setApplying(true);
    try {
      const res = await uploadMaster(activeType as any, pendingFile);
      setActiveJobId(res.jobId);
      toast.success('Upload job created and queued.');
      setPreview(null);
      setPendingFile(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJobId) return;
    try {
      await cancelJob(activeJobId);
      toast.success('Cancellation requested');
    } catch {
      toast.error('Failed to cancel');
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
              {activeType !== 'scb-master' && (
                <>
                  <button className="btn-secondary" style={{ height: 34, color: 'var(--error)' }} onClick={handleClearMaster}>
                    <Icon name="delete_sweep" size={16} /> Clear All
                  </button>
                  <button className="btn-secondary" style={{ height: 34, color: 'var(--accent-500)', borderColor: 'var(--accent-500)' }} onClick={handleExportMaster}>
                    <Icon name="download" size={16} /> Export
                  </button>
                </>
              )}
              <button className="btn-secondary" style={{ height: 34, color: 'var(--accent-500)', borderColor: 'var(--accent-500)' }} onClick={() => setShowJobsDrawer(true)}>
                <Icon name="history" size={16} /> Jobs
              </button>
              {activeType !== 'scb-master' && (
                <a href={getTemplateUrl(activeType as any)} download className="btn-secondary" style={{ height: 34 }}>
                  <Icon name="description" size={16} /> Template
                </a>
              )}
              <button className="btn-primary" style={{ height: 34 }} onClick={() => fileInputRef.current?.click()} disabled={verifying}>
                {verifying ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="spinner-xs" /> Verifying...
                  </div>
                ) : (
                  <>
                    <Icon name="upload" size={16} /> {activeType === 'scb-master' ? 'Upload XML' : 'Bulk Upload'}
                  </>
                )}
              </button>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} accept={activeType === 'scb-master' ? '.xml' : '.xlsx'} />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 32 }}>
        {[
          { id: 'location', label: 'Locations' },
          { id: 'client', label: 'Client Master' },
          { id: 'global-client', label: 'Global Client Master' },
          { id: 'internal-bank', label: 'RCMS Bank Code' },
          { id: 'capture-rule', label: 'Enrichment Master' },
          { id: 'scb-master', label: 'Clearing House Master' }
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

      {(activeType === 'location' || activeType === 'client' || activeType === 'internal-bank' || activeType === 'capture-rule') ? (
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

            {isAdvancedSearch && (activeType === 'location' || activeType === 'client') && (
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
                    {(activeType === 'location' ? LOCATION_COLS : 
                      activeType === 'client' ? CLIENT_COLS :
                      activeType === 'internal-bank' ? BANK_COLS :
                      RULE_COLS).map(col => (
                      <th key={col.key} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)', width: col.width }}>
                        {col.label}
                      </th>
                    ))}
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingData ? (<tr><td colSpan={10} style={{ padding: 40, textAlign: 'center' }}>Loading...</td></tr>) : 
                   (activeType === 'location' ? locationRows : 
                    activeType === 'client' ? clientRows :
                    activeType === 'internal-bank' ? bankRows :
                    ruleRows).length === 0 ? (<tr><td colSpan={10} style={{ padding: 40, textAlign: 'center' }}>No records.</td></tr>) : 
                    (activeType === 'location' ? locationRows : 
                     activeType === 'client' ? clientRows :
                     activeType === 'internal-bank' ? bankRows :
                     ruleRows).map((row: any, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {(activeType === 'location' ? LOCATION_COLS : 
                          activeType === 'client' ? CLIENT_COLS :
                          activeType === 'internal-bank' ? BANK_COLS :
                          RULE_COLS).map(col => (
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
                                   background: (() => {
                                     if (row.isActive === true) return 'var(--success-bg)';
                                     if (activeType === 'client') {
                                       const s = (row.status || '').trim().toUpperCase();
                                       if (['I', 'X', '0', 'INACTIVE', 'DELETED'].includes(s)) return 'var(--bg-raised)';
                                       return 'var(--success-bg)';
                                     }
                                     return row.isActive ? 'var(--success-bg)' : 'var(--bg-raised)';
                                   })(),
                                   border: `1px solid ${(() => {
                                     if (row.isActive === true) return 'var(--success)';
                                     if (activeType === 'client') {
                                       const s = (row.status || '').trim().toUpperCase();
                                       if (['I', 'X', '0', 'INACTIVE', 'DELETED'].includes(s)) return 'var(--border)';
                                       return 'var(--success)';
                                     }
                                     return row.isActive ? 'var(--success)' : 'var(--border)';
                                   })()}`,
                                   color: (() => {
                                     if (row.isActive === true) return 'var(--success)';
                                     if (activeType === 'client') {
                                       const s = (row.status || '').trim().toUpperCase();
                                       if (['I', 'X', '0', 'INACTIVE', 'DELETED'].includes(s)) return 'var(--fg-muted)';
                                       return 'var(--success)';
                                     }
                                     return row.isActive ? 'var(--success)' : 'var(--fg-muted)';
                                   })(),
                                   fontSize: 11, fontWeight: 600
                                 }}
                               >
                                 <div style={{ 
                                   width: 6, height: 6, borderRadius: '50%', 
                                   background: (() => {
                                     if (row.isActive === true) return 'var(--success)';
                                     if (activeType === 'client') {
                                       const s = (row.status || '').trim().toUpperCase();
                                       if (['I', 'X', '0', 'INACTIVE', 'DELETED'].includes(s)) return 'var(--fg-faint)';
                                       return 'var(--success)';
                                     }
                                     return row.isActive ? 'var(--success)' : 'var(--fg-faint)';
                                   })() 
                                 }} />
                                 {(() => {
                                   if (row.isActive === true) return 'Active';
                                   if (activeType === 'client') {
                                     const s = (row.status || '').trim().toUpperCase();
                                     if (['I', 'X', '0', 'INACTIVE', 'DELETED'].includes(s)) return 'Inactive';
                                     return 'Active';
                                   }
                                   return row.isActive ? 'Active' : 'Inactive';
                                 })()}
                               </div>
                             ) :
                             (row[col.key] || '—')}
                          </td>
                        ))}
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          {(activeType === 'client' || activeType === 'location') && (
                            <button onClick={() => activeType === 'client' ? setEditClient({ ...row }) : setEditLocation({ ...row })} className="btn-ghost" style={{ height: 28, color: 'var(--accent-500)' }}>Edit</button>
                          )}
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
      ) : activeType === 'global-client' ? (
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
      ) : activeType === 'scb-master' ? (
        <ScbMasterTab />
      ) : null}

      {showAddModal && selectedGlobal && (
        <div className="modal-overlay-container" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', 
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999, 
          padding: '40px 20px', overflowY: 'auto' 
        }}>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-[32px] shadow-2xl w-full max-w-3xl flex flex-col mb-10 overflow-hidden">
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

      {showCreateModal && (
        <div className="modal-overlay-container" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, 
          padding: 20 
        }}>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
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

      {editClient && (
        <div className="modal-overlay-container" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', 
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999, 
          padding: '40px 20px', overflowY: 'auto' 
        }}>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-[32px] shadow-2xl w-full max-w-lg flex flex-col mb-10 overflow-hidden">
            <div style={{ padding: '16px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>Edit Client Master</h2>
              <button onClick={() => setEditClient(null)} className="btn-ghost"><Icon name="close" size={24} /></button>
            </div>
            
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {editLocation && (
        <div className="modal-overlay-container" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', 
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999, 
          padding: '40px 20px', overflowY: 'auto' 
        }}>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-[32px] shadow-2xl w-full max-w-lg flex flex-col mb-10 overflow-hidden">
            <div style={{ padding: '16px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>Edit Location Master</h2>
              <button onClick={() => setEditLocation(null)} className="btn-ghost"><Icon name="close" size={24} /></button>
            </div>
            
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <div>
                <label className="label" style={{ fontSize: 10 }}>LOCATION NAME</label>
                <input className="input-field" value={editLocation.locationName} onChange={e => setEditLocation({ ...editLocation, locationName: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: 10 }}>STATE</label>
                  <input className="input-field" value={editLocation.state} onChange={e => setEditLocation({ ...editLocation, state: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ fontSize: 10 }}>ZONE</label>
                  <input className="input-field" value={editLocation.zone} onChange={e => setEditLocation({ ...editLocation, zone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label" style={{ fontSize: 10 }}>STATUS</label>
                <select className="input-field" value={editLocation.isActive ? 'true' : 'false'} onChange={e => setEditLocation({ ...editLocation, isActive: e.target.value === 'true' })}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: 'var(--bg-raised)', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" style={{ width: 100 }} onClick={() => setEditLocation(null)}>Cancel</button>
              <button className="btn-primary" style={{ width: 140 }} onClick={async () => { 
                await updateLocationRecord(editLocation.locationID, { ...editLocation }); 
                toast.success('Location updated'); 
                setEditLocation(null); 
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
            <div>
              <h2 style={{ margin: 0 }}>Review Upload</h2>
              <p style={{ margin: 4, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
                {preview.validRows} valid rows found out of {preview.totalRows} total. 
                {preview.totalRows > 100 && <span style={{ color: 'var(--accent-500)', marginLeft: 8 }}> Showing first 100 rows only.</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}><button className="btn-secondary" onClick={() => setPreview(null)}>Discard</button><button className="btn-primary" onClick={handleApplyPreview}>{applying ? 'Applying...' : 'Apply'}</button></div>
          </div>
          
          {preview.parsingLogs && preview.parsingLogs.length > 0 && (
            <div style={{ padding: '12px 32px', background: 'var(--bg-subtle)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-muted)', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Icon name="terminal" size={14} /> <span>System Parsing Logs</span>
              </div>
              {preview.parsingLogs.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ color: 'var(--accent-500)', opacity: 0.7 }}>➜</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
              <thead style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0 }}><tr><th style={{ padding: 12, textAlign: 'left' }}>Row</th>{preview.rows[0] && Object.keys(preview.rows[0].values).map(k => (<th key={k} style={{ padding: 12, textAlign: 'left' }}>{k}</th>))}<th style={{ padding: 12, textAlign: 'center' }}>Status</th></tr></thead>
              <tbody>{preview.rows.map((row, i) => (<tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}><td style={{ padding: 12 }}>{i + 2}</td>{Object.values(row.values).map((v, j) => (<td key={j} style={{ padding: 12 }}>{v || '—'}</td>))}<td style={{ padding: 12, textAlign: 'center' }}>OK</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
      {jobStatus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: 16 }}>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-xl p-6 sm:p-8 flex flex-col gap-6 overflow-y-auto max-h-[90vh]">
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--accent-500)' }}>
                {jobStatus.status === 'Processing' ? 'Processing Upload...' : 
                 jobStatus.status === 'Pending' ? 'Waiting in Queue...' : 
                 jobStatus.status === 'Completed' ? 'Upload Complete!' : 
                 jobStatus.status === 'Cancelled' ? 'Upload Cancelled' : 'Upload Failed'}
              </h2>
              <p style={{ margin: '8px 0 0', color: 'var(--fg-subtle)' }}>
                {getJobDisplayName(activeType)} — {jobStatus.totalRows > 0 ? `${jobStatus.processedRows} of ${jobStatus.totalRows} rows` : 'Reading file...'}
              </p>
            </div>

            <div style={{ height: 12, background: 'var(--bg-subtle)', borderRadius: 6, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}>
              <div style={{ 
                height: '100%', 
                width: `${jobStatus.progressPercent}%`, 
                background: 'linear-gradient(90deg, var(--accent-600), var(--accent-400))', 
                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 15px var(--accent-500)'
              }} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Processed', value: jobStatus.processedRows, color: 'var(--fg)' },
                { label: 'Inserted', value: jobStatus.insertedCount, color: '#4caf50' },
                { label: 'Updated', value: jobStatus.updatedCount, color: '#2196f3' },
                { label: 'Failed', value: jobStatus.failedCount, color: '#f44336' }
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-raised)', padding: '12px 8px', borderRadius: 'var(--r-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {jobStatus.errors && jobStatus.errors.length > 0 && (
              <div style={{ maxHeight: 150, overflow: 'auto', background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Recent Errors</div>
                {jobStatus.errors.slice(-5).map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#f85149', marginBottom: 4, display: 'flex', gap: 8 }}>
                    <span style={{ opacity: 0.7 }}>Row {e.rowNumber}:</span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={refreshJobStatus}>
                <Icon name="refresh" size={18} /> Refresh Status
              </button>
              {(jobStatus.status === 'Processing' || jobStatus.status === 'Pending') && (
                <button className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={handleCancelJob}>
                  <Icon name="cancel" size={18} /> Cancel Process
                </button>
              )}
              {(jobStatus.status === 'Completed' || jobStatus.status === 'Failed' || jobStatus.status === 'Cancelled') && (
                <button className="btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={async () => {
                  if (window.confirm('Are you sure you want to delete this job record?')) {
                    try {
                      await deleteJob(activeJobId!);
                      toast.success('Job deleted.');
                      setActiveJobId(null);
                      setJobStatus(null);
                    } catch (err) {
                      toast.error('Failed to delete job.');
                    }
                  }
                }}>
                  <Icon name="delete" size={18} /> Delete Job
                </button>
              )}
              <button className="btn-primary" onClick={() => setActiveJobId(null)}>
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}




      {/* ── Jobs Drawer Overlay ── */}
      {showJobsDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(2px)' }}>
          <div style={{ width: 450, background: 'var(--bg-raised)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)', animation: 'slideInRight 0.3s ease' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="history" size={24} style={{ color: 'var(--accent-500)' }} />
                Recent Uploads
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={fetchJobs} className="btn-ghost" style={{ padding: 8 }}><Icon name="refresh" size={20} /></button>
                <button onClick={() => setShowJobsDrawer(false)} className="btn-ghost" style={{ padding: 8 }}><Icon name="close" size={20} /></button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recentJobs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', marginTop: 40 }}>
                  <Icon name="inbox" size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <p>No recent jobs found.</p>
                </div>
              ) : recentJobs.map(job => (
                <div key={job.id} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-base)' }}>{getJobDisplayName(job.jobType)} <span style={{ color: 'var(--fg-subtle)', fontSize: 12, fontWeight: 400 }}>#{job.id}</span></div>
                      <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 4 }}>{formatToIST(job.createdAt)}</div>
                    </div>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: job.status === 'Completed' ? 'rgba(76, 175, 80, 0.1)' : job.status === 'Failed' ? 'rgba(244, 67, 54, 0.1)' : 'var(--bg-raised)',
                      color: job.status === 'Completed' ? '#4caf50' : job.status === 'Failed' ? '#f44336' : 'var(--accent-500)'
                    }}>{job.status}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-raised)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${job.progressPercent}%`, height: '100%', background: 'var(--accent-500)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', width: 40, textAlign: 'right' }}>{job.progressPercent}%</span>
                  </div>

                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--fg-muted)', marginBottom: 16, padding: '8px 12px', background: 'var(--bg-raised)', borderRadius: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>Inserted</span><strong style={{ color: '#4caf50' }}>{job.insertedCount}</strong></div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>Updated</span><strong style={{ color: '#2196f3' }}>{job.updatedCount}</strong></div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>Failed</span><strong style={{ color: '#f44336' }}>{job.failedCount}</strong></div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setShowJobsDrawer(false); setActiveJobId(job.id); refreshJobStatus(); }} className="btn-secondary" style={{ height: 32, fontSize: 12 }}>View Details</button>
                    <button onClick={async () => {
                      if (window.confirm('Delete this job record permanently?')) {
                        try {
                          await deleteJob(job.id);
                          toast.success('Job deleted.');
                          fetchJobs();
                        } catch {
                          toast.error('Failed to delete job.');
                        }
                      }
                    }} className="btn-ghost" style={{ height: 32, fontSize: 12, color: 'var(--danger)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
