// =============================================================================
// File        : MasterUploadPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : Location and Client master management — view records, row editing, Excel bulk upload.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  applyMasterRows, getClientMasterData, getLocationMasterData, getTemplateUrl, previewMaster,
  MasterType, MasterPreviewDto, MasterDataRowDto, UploadResultDto,
} from '../services/masterUploadService';
import { toast } from '../store/toastStore';

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  /** Show in the read-only table */
  tableVisible?: boolean;
}

const LOCATION_COLS: ColumnDef[] = [
  { key: 'LocationCode',   label: 'Code',            tableVisible: true  },
  { key: 'LocationName',   label: 'Location Name',   tableVisible: true  },
  { key: 'State',          label: 'State',           tableVisible: true  },
  { key: 'Zone',           label: 'Zone',            tableVisible: true  },
  { key: 'Grid',           label: 'Grid'                                  },
  { key: 'ClusterCode',    label: 'Cluster Code'                          },
  { key: 'LocType',        label: 'Location Type'                         },
  { key: 'PIFPrefix',      label: 'PIF Prefix',      tableVisible: true  },
  { key: 'ScannerID',      label: 'Scanner ID'                            },
  { key: 'BOFD',           label: 'BOFD'                                  },
  { key: 'PreTrun',        label: 'PreTrun'                               },
  { key: 'DepositAccount', label: 'Deposit Account'                       },
  { key: 'IFSC',           label: 'IFSC'                                  },
];

const CLIENT_COLS: ColumnDef[] = [
  { key: 'CityCode',        label: 'City Code',       tableVisible: true  },
  { key: 'ClientName',      label: 'Client Name',     tableVisible: true  },
  { key: 'Status',          label: 'Status',          tableVisible: true  },
  { key: 'PickupPointCode', label: 'Pickup Code',     tableVisible: true  },
  { key: 'PickupPointDesc', label: 'Pickup Description'                   },
  { key: 'Address1',        label: 'Address Line 1'                       },
  { key: 'Address2',        label: 'Address Line 2'                       },
  { key: 'Address3',        label: 'Address Line 3'                       },
  { key: 'Address4',        label: 'Address Line 4'                       },
  { key: 'Address5',        label: 'Address Line 5'                       },
  { key: 'RCMSCode',        label: 'RCMS Code'                            },
  { key: 'StatusDate',      label: 'Status Date'                          },
];

const MASTER_TABS = [
  {
    key: 'location' as MasterType,
    label: 'Location Master',
    subtitle: 'Branch locations, scanners, and finance details.',
    cols: LOCATION_COLS,
  },
  {
    key: 'client' as MasterType,
    label: 'Client Master',
    subtitle: 'Client records keyed by City Code. Existing records are updated on apply.',
    cols: CLIENT_COLS,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function MastersPage() {
  const [activeType,   setActiveType]   = useState<MasterType>('location');
  const [uploading,    setUploading]    = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [result,       setResult]       = useState<UploadResultDto | null>(null);
  const [preview,      setPreview]      = useState<MasterPreviewDto | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [locationRows, setLocationRows] = useState<MasterDataRowDto[]>([]);
  const [clientRows,   setClientRows]   = useState<MasterDataRowDto[]>([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [editRow,      setEditRow]      = useState<{ index: number; values: Record<string, string> } | null>(null);
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [uploadedFilePage, setUploadedFilePage] = useState(1);
  const [totalDbRows,  setTotalDbRows]  = useState(0);
  const PAGE_SIZE = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTab  = MASTER_TABS.find(t => t.key === activeType)!;
  const activeRows = activeType === 'location' ? locationRows : clientRows;
  const tableCols  = activeTab.cols.filter(c => c.tableVisible);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredRows = search.trim()
    ? activeRows.filter(row =>
        Object.values(row.values).some(v =>
          (v ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : activeRows;

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadMasterData = async () => {
    setLoadingData(true);
    try {
      const [locationsRes, clientsRes] = await Promise.all([
        getLocationMasterData(page, PAGE_SIZE),
        getClientMasterData(page, PAGE_SIZE),
      ]);

      setLocationRows(locationsRes.items.map(l => ({
        values: {
          Grid:           l.grid            ?? '',
          State:          l.state           ?? '',
          LocationName:   l.locationName    ?? '',
          LocationCode:   l.locationCode    ?? '',
          ClusterCode:    l.clusterCode     ?? '',
          Zone:           l.zone            ?? '',
          ScannerID:      l.scanners?.[0]?.scannerID ?? '',
          BOFD:           l.finance?.bofd   ?? '',
          PreTrun:        l.finance?.preTrun ?? '',
          DepositAccount: l.finance?.depositAccount ?? '',
          IFSC:           l.finance?.ifsc   ?? '',
          LocType:        l.locType         ?? '',
          PIFPrefix:      l.pifPrefix       ?? '',
        },
      })));

      setClientRows(clientsRes.items.map(c => ({
        values: {
          CityCode:        c.cityCode        ?? '',
          ClientName:      c.clientName      ?? '',
          Address1:        c.address1        ?? '',
          Address2:        c.address2        ?? '',
          Address3:        '',
          Address4:        '',
          Address5:        '',
          PickupPointCode: c.pickupPointCode ?? '',
          PickupPointDesc: c.pickupPointDesc ?? '',
          RCMSCode:        c.rcmsCode        ?? '',
          Status:          c.status          ?? 'A',
          StatusDate:      '',
        },
      })));
      // Use the larger total count from either response
      setTotalDbRows(Math.max(locationsRes.totalCount, clientsRes.totalCount));
    } catch {
      toast.error('Failed to load master data');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadMasterData(); }, [page]); // Reload when page changes

  // ── Tab switch ────────────────────────────────────────────────────────────
  const switchTab = (type: MasterType) => {
    setActiveType(type);
    setResult(null);
    setPreview(null);
    setUploadedFile(null);
    setSearch('');
    setEditRow(null);
    setPage(1);
    setUploadedFilePage(1);
  };

  // ── Row edit modal ────────────────────────────────────────────────────────
  const openEdit = (globalIndex: number) => {
    setEditRow({
      index: globalIndex,
      values: { ...activeRows[globalIndex].values } as Record<string, string>,
    });
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    setApplying(true);
    try {
      // Build updated rows: replace only the edited row
      const updated = activeRows.map((r, i) =>
        i === editRow.index ? { values: { ...editRow.values } } : r
      );
      const res = await applyMasterRows(activeType, [{ values: editRow.values }]);
      if (res.errorRows === 0) {
        toast.success('Record saved');
        if (activeType === 'location') setLocationRows(updated);
        else setClientRows(updated);
        setEditRow(null);
      } else {
        toast.error(`Save failed: ${res.errors[0]?.message ?? 'unknown error'}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save record');
    } finally {
      setApplying(false);
    }
  };

  // ── Excel upload ──────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Only .xlsx files are supported');
      return;
    }
    setUploading(true);
    setResult(null);
    setPreview(null);
    setUploadedFilePage(1);
    try {
      const res = await previewMaster(activeType, file);
      setPreview(res);
      setUploadedFile(file);
      if (res.errorRows === 0) toast.success(`Verified — ${res.validRows} row(s) ready to apply`);
      else toast.warning(`${res.errorRows} error(s) found — review before applying`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Verification failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyPreview = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const res = await applyMasterRows(activeType, preview.rows);
      setResult(res);
      if (res.errorRows === 0) toast.success(`Applied ${res.successRows} rows successfully`);
      else toast.error(`Applied with ${res.errorRows} error(s)`);
      setPreview(null);
      setUploadedFile(null);
      await loadMasterData();
      setPage(1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Bulk apply failed');
    } finally {
      setApplying(false);
    }
  };

  const clearUpload = () => {
    setPreview(null);
    setUploadedFile(null);
    setUploadedFilePage(1);
  };

  // ── Pagination helpers ────────────────────────────────────────────────────
  const paginatedRows = filteredRows;
  const totalDbPages = Math.ceil(totalDbRows / PAGE_SIZE);

  const paginatedPreviewRows = preview ? preview.rows.slice(
    (uploadedFilePage - 1) * PAGE_SIZE,
    uploadedFilePage * PAGE_SIZE
  ) : [];
  const totalPreviewPages = preview ? Math.ceil(preview.rows.length / PAGE_SIZE) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Master Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage Location and Client master records.
        </p>
      </div>

      {/* ── Tab switcher ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {MASTER_TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              activeType === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Excel bulk upload (MOVED TO TOP) ─────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {/* Card header */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <span className="text-sm font-semibold text-gray-900">{activeTab.label}</span>
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {loadingData ? 'Loading…' : `${totalDbRows.toLocaleString()} total records`}
            </span>
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search records…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none
                focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>
        </div>

        {/* Table body with pagination */}
        {loadingData ? (
          <div className="py-16 text-center">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <svg className="mx-auto w-10 h-10 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            <p className="text-sm font-medium text-gray-500">
              {search ? 'No records match your search.' : 'No records yet.'}
            </p>
            {!search && (
              <p className="text-xs text-gray-400 mt-1">Upload an Excel file above to add records.</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {tableCols.map(col => (
                      <th key={col.key}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRows.map((row, i) => {
                    // find original index in activeRows for edit
                    const globalIndex = activeRows.indexOf(row);
                    return (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        {tableCols.map(col => (
                          <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {col.key === 'Status' ? (
                              <StatusBadge value={row.values[col.key] ?? ''} />
                            ) : (
                              <span className={row.values[col.key] ? '' : 'text-gray-300 italic text-xs'}>
                                {row.values[col.key] || '—'}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(globalIndex)}
                            className="text-xs font-medium text-blue-700 hover:text-blue-900"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        
            {/* Pagination footer */}
            {totalDbPages > 1 && (
              <div className="flex justify-center items-center gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600
                    hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-500">Page {page} of {totalDbPages} ({totalDbRows.toLocaleString()} records)</span>
                <button
                  type="button"
                  disabled={page === totalDbPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600
                    hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Records table (MOVED BELOW UPLOAD) ───────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Bulk Upload via Excel</h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload, validate, and apply master data in bulk.</p>
          </div>
          <a
            href={getTemplateUrl(activeType)}
            download
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700
              hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200
              hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v-8m0 8l-3-3m3 3l3-3" />
            </svg>
            Download Template
          </a>
        </div>

        <div className="px-5 py-5 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            aria-label="Upload master Excel file"
            onChange={handleFileChange}
          />

          {/* Steps */}
          <div className="flex items-center gap-2 text-xs text-gray-400 select-none">
            {['Download template', 'Fill in data', 'Upload & verify', 'Apply to system'].map((step, i, arr) => (
              <React.Fragment key={step}>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 font-semibold
                    flex items-center justify-center shrink-0 text-[10px]">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
                {i < arr.length - 1 && (
                  <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Uploaded file info & validation preview */}
          {preview && (
            <div className="space-y-4">
              {/* File info banner */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">{uploadedFile?.name}</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        {preview.totalRows} rows &nbsp;·&nbsp; {preview.validRows} valid &nbsp;·&nbsp; {preview.errorRows} errors
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearUpload}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Validation stats */}
              <div className={`rounded-lg border p-4 flex items-start gap-3 ${
                preview.errorRows > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                {preview.errorRows > 0 ? (
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${preview.errorRows > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                    {preview.errorRows > 0
                      ? 'Validation completed with errors'
                      : 'File validated successfully'}
                  </p>
                  <p className={`text-xs mt-0.5 ${preview.errorRows > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    {preview.errorRows > 0
                      ? 'Review errors below. You can still apply valid rows.'
                      : 'All rows are valid and ready to be applied to the database.'}
                  </p>
                </div>
              </div>

              {/* Preview data table with pagination */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-700">Data Preview</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                        {activeTab.cols.filter(c => c.tableVisible).map(col => (
                          <th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedPreviewRows.map((row, i) => {
                        const actualIndex = (uploadedFilePage - 1) * PAGE_SIZE + i;
                        const hasError = preview.errors.some(e => e.rowNumber === actualIndex + 2);
                        const error = preview.errors.find(e => e.rowNumber === actualIndex + 2);
                        return (
                          <tr key={i} className={hasError ? 'bg-red-50/50' : 'hover:bg-gray-50/50'}>
                            <td className="px-3 py-2 font-mono text-gray-500">{actualIndex + 2}</td>
                            {activeTab.cols.filter(c => c.tableVisible).map(col => (
                              <td key={col.key} className="px-3 py-2 text-gray-700">
                                {row.values[col.key] || <span className="text-gray-300 italic">—</span>}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center">
                              {hasError ? (
                                <span className="inline-flex items-center gap-1 text-red-600" title={error?.message}>
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                  <span className="hidden lg:inline text-xs">Error</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  <span className="hidden lg:inline text-xs">Valid</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPreviewPages > 1 && (
                  <div className="flex justify-center items-center gap-3 px-4 py-2.5 border-t border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      disabled={uploadedFilePage === 1}
                      onClick={() => setUploadedFilePage(p => p - 1)}
                      className="px-2.5 py-1 rounded border border-gray-200 text-xs text-gray-600
                        hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-gray-500">Page {uploadedFilePage} of {totalPreviewPages}</span>
                    <button
                      type="button"
                      disabled={uploadedFilePage === totalPreviewPages}
                      onClick={() => setUploadedFilePage(p => p + 1)}
                      className="px-2.5 py-1 rounded border border-gray-200 text-xs text-gray-600
                        hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              {/* Error details table */}
              {preview.errorRows > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Error Details ({preview.errorRows})</p>
                  <ErrorTable errors={preview.errors} />
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-blue-700 text-white text-sm font-medium
                px-5 py-2.5 rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {uploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4-4 4M12 4v12" />
                  </svg>
                  {preview ? 'Upload New File' : 'Upload Excel File'}
                </>
              )}
            </button>

            {preview && preview.validRows > 0 && (
              <button
                type="button"
                onClick={handleApplyPreview}
                disabled={applying}
                className="inline-flex items-center gap-2 bg-green-700 text-white text-sm font-medium
                  px-5 py-2.5 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {applying ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Applying to Database…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
                    </svg>
                    Apply {preview.validRows} Valid Row(s) to Database
                  </>
                )}
              </button>
            )}
          </div>


        </div>
      </div>

      {/* ── Apply result ──────────────────────────────────────────────────── */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Upload Result</h2>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Dismiss
            </button>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total"   value={result.totalRows}   color="gray"  />
              <StatCard label="Saved"   value={result.successRows} color="green" />
              <StatCard label="Errors"  value={result.errorRows}   color={result.errorRows > 0 ? 'red' : 'gray'} />
            </div>
            {result.errors.length > 0 && <ErrorTable errors={result.errors} />}
          </div>
        </div>
      )}

      {/* ── Edit row modal ────────────────────────────────────────────────── */}
      {editRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Record</h2>
                <p className="text-xs text-gray-400 mt-0.5">{activeTab.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400
                  hover:text-gray-700 hover:bg-gray-100 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              {activeTab.cols.map(col => (
                <div key={col.key}>
                  <label htmlFor={`edit-field-${col.key}`} className="block text-xs font-medium text-gray-600 mb-1">
                    {col.label}
                  </label>
                  <input
                    id={`edit-field-${col.key}`}
                    value={editRow.values[col.key] ?? ''}
                    onChange={e => setEditRow(prev => prev
                      ? { ...prev, values: { ...prev.values, [col.key]: e.target.value } }
                      : null
                    )}
                    placeholder={col.label}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      hover:border-gray-300 transition-colors"
                  />
                </div>
              ))}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm
                  font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={applying}
                className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium
                  hover:bg-blue-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {applying ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ value }: { value: string }) {
  if (!value) return <span className="text-gray-300 italic text-xs">—</span>;
  const isActive = value.toUpperCase() === 'A';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
      {isActive ? 'Active' : value}
    </span>
  );
}

function ErrorTable({ errors }: { errors: Array<{ rowNumber: number; field: string; message: string; rowData?: string }> }) {
  return (
    <div className="overflow-x-auto border border-red-100 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-red-50 border-b border-red-100">
          <tr>
            {['Row', 'Field', 'Error'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-semibold text-red-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-red-50">
          {errors.map((err, i) => (
            <tr key={i} className="hover:bg-red-50/50">
              <td className="px-3 py-2 font-mono text-gray-500 w-12">{err.rowNumber}</td>
              <td className="px-3 py-2 font-medium text-gray-700">{err.field}</td>
              <td className="px-3 py-2 text-red-600">{err.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'gray' | 'green' | 'red' }) {
  const p = {
    gray:  { bg: 'bg-gray-50',  num: 'text-gray-800',  lbl: 'text-gray-400'  },
    green: { bg: 'bg-green-50', num: 'text-green-700', lbl: 'text-green-600' },
    red:   { bg: 'bg-red-50',   num: 'text-red-700',   lbl: 'text-red-500'   },
  }[color];
  return (
    <div className={`${p.bg} rounded-xl px-4 py-4 text-center`}>
      <div className={`text-2xl font-bold ${p.num}`}>{value}</div>
      <div className={`text-xs mt-1 font-medium ${p.lbl}`}>{label}</div>
    </div>
  );
}
