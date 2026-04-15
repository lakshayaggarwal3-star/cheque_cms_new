// =============================================================================
// File        : DashboardPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Dashboard
// Description : Batch dashboard with status summary and list with action buttons.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBatchList, getDashboard } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { BatchDto, BatchStatus, BatchStatusLabels, DashboardSummary } from '../types';
import { toast } from '../store/toastStore';

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = user.eodDate;
      const [batchRes, summaryRes] = await Promise.all([
        getBatchList({ locationId: user.locationId, date: today, page, pageSize: 20 }),
        getDashboard(user.locationId, today),
      ]);
      setBatches(batchRes.items);
      setTotalPages(batchRes.totalPages);
      setSummary(summaryRes);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user, page]);

  useEffect(() => { load(); }, [load]);

  const statusColor: Record<number, string> = {
    0: 'bg-gray-100 text-gray-700',
    1: 'bg-blue-100 text-blue-700',
    2: 'bg-yellow-100 text-yellow-700',
    3: 'bg-green-100 text-green-700',
    4: 'bg-red-100 text-red-700',
    5: 'bg-emerald-100 text-emerald-700',
  };

  const getAction = (b: BatchDto) => {
    switch (b.batchStatus) {
      case BatchStatus.Created: return { label: 'Start Scanning', path: `/scan/${b.batchID}` };
      case BatchStatus.ScanningInProgress:
      case BatchStatus.ScanningPending: return { label: 'Continue Scanning', path: `/scan/${b.batchID}` };
      case BatchStatus.RRPending: return { label: 'Continue RR', path: `/rr/${b.batchID}` };
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 h-20 animate-pulse bg-gray-200" />
          ))}
        </div>
        <div className="bg-white rounded-lg p-4 h-64 animate-pulse bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">{user?.locationName} — EOD: {user?.eodDate}</p>
        </div>
        {(user?.roles.includes('Scanner') || user?.roles.includes('MobileScanner') || user?.roles.includes('Admin') || user?.roles.includes('Developer')) && (
          <button
            type="button"
            onClick={() => navigate('/batch/create')}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            + Create Batch
          </button>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Today', value: summary.totalBatchesToday, color: 'text-blue-700 bg-blue-50' },
            { label: 'Scanning Pending', value: summary.scanningPending, color: 'text-yellow-700 bg-yellow-50' },
            { label: 'RR Pending', value: summary.rrPending, color: 'text-red-700 bg-red-50' },
            { label: 'Completed', value: summary.completed, color: 'text-green-700 bg-green-50' },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg p-4 ${card.color}`}>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium mt-1">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Batch list — responsive */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Today's Batches</h2>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-gray-100 md:hidden">
          {batches.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No batches today. Create one to get started.</div>
          ) : batches.map((b) => {
            const action = getAction(b);
            return (
              <div key={b.batchID} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-mono font-medium text-sm">{b.batchNo}</div>
                    <div className="text-xs text-gray-500">{b.batchDate}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[b.batchStatus]}`}>
                    {BatchStatusLabels[b.batchStatus]}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  Slips: {b.totalSlips} | Amount: ₹{b.totalAmount.toLocaleString()}
                </div>
                {action && (
                  <button
                    onClick={() => navigate(action.path)}
                    className="w-full bg-blue-50 text-blue-700 text-sm py-2 rounded-lg font-medium hover:bg-blue-100"
                  >
                    {action.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          {batches.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No batches today. Create one to get started.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['Batch No', 'Date', 'Scanner', 'Slips', 'Amount', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map((b) => {
                  const action = getAction(b);
                  return (
                    <tr key={b.batchID} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium">{b.batchNo}</td>
                      <td className="px-4 py-3 text-gray-600">{b.batchDate}</td>
                      <td className="px-4 py-3 text-gray-600">{b.scannerID ?? '—'}</td>
                      <td className="px-4 py-3">{b.totalSlips}</td>
                      <td className="px-4 py-3">₹{b.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[b.batchStatus]}`}>
                          {BatchStatusLabels[b.batchStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {action ? (
                          <button
                            onClick={() => navigate(action.path)}
                            className="text-blue-700 hover:text-blue-900 font-medium text-xs"
                          >
                            {action.label} →
                          </button>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
