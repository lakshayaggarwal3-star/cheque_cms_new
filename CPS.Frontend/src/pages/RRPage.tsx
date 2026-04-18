// =============================================================================
// File        : RRPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : Reject-Repair screen with image viewer, MICR edit, approve, and complete.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRRItems, saveRRCorrection, completeRR } from '../services/rrService';
import { toast } from '../store/toastStore';
import { getImageUrl } from '../utils/imageUtils';
import { RRItemDto, RRState } from '../types';

export function RRPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<RRItemDto[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });

  const id = Number(batchId);

  const loadItems = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setLoadError('Invalid RR batch. Open RR from Dashboard for a valid batch.');
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const data = await getRRItems(id);
      setItems(data);
      if (data.length > 0) {
        const firstPendingIndex = data.findIndex(d => d.rrState === RRState.NeedsReview);
        const targetIndex = firstPendingIndex >= 0 ? firstPendingIndex : 0;
        const first = data[targetIndex];
        setCurrent(targetIndex);
        setMicr({
          chqNo: first.chqNo ?? '',
          micr1: first.rrmicr1 ?? first.scanMICR1 ?? '',
          micr2: first.rrmicr2 ?? first.scanMICR2 ?? '',
          micr3: first.rrmicr3 ?? first.scanMICR3 ?? '',
        });
      }
    } catch {
      setLoadError('Unable to load RR items for this batch.');
      toast.error('Failed to load RR items');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const item = items[current];
  const pendingItems = items.filter(i => i.rrState === RRState.NeedsReview);
  const isLastPending = pendingItems.length <= 1;
  const currentSlipItems = item
    ? items.filter(i => i.slipEntryId === item.slipEntryId)
    : [];
  const currentSlipPosition = item
    ? currentSlipItems.findIndex(i => i.chequeItemId === item.chequeItemId) + 1
    : 0;

  const handleApproveAndNext = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await saveRRCorrection(item.chequeItemId, {
        chqNo: micr.chqNo,
        rrmicr1: micr.micr1,
        rrmicr2: micr.micr2,
        rrmicr3: micr.micr3,
        approve: false,
        rowVersion: item.rowVersion,
      });
      const updated = await getRRItems(id);
      setItems(updated);

      const nextPendingIndex = updated.findIndex(i => i.rrState === RRState.NeedsReview);
      if (nextPendingIndex >= 0) {
        const nextItem = updated[nextPendingIndex];
        setCurrent(nextPendingIndex);
        setMicr({
          chqNo: nextItem.chqNo ?? '',
          micr1: nextItem.rrmicr1 ?? nextItem.scanMICR1 ?? '',
          micr2: nextItem.rrmicr2 ?? nextItem.scanMICR2 ?? '',
          micr3: nextItem.rrmicr3 ?? nextItem.scanMICR3 ?? '',
        });
        toast.success('Saved. Moving to next item.');
      } else {
        toast.success('All items reviewed.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    try {
      await completeRR(id);
      toast.success('RR completed successfully');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cannot complete RR');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading RR items...</div>;

  if (loadError) {
    return (
      <div className="text-center p-12">
        <h2 className="text-lg font-bold text-gray-900 mb-2">RR Page Unavailable</h2>
        <p className="text-gray-500 text-sm mb-5">{loadError}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-800"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (pendingItems.length === 0) {
    return (
      <div className="text-center p-12">
        <div className="text-4xl mb-3">&#10003;</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">All Items Reviewed</h2>
        <p className="text-gray-500 text-sm mb-5">No more items need review.</p>
        <button onClick={handleComplete} className="bg-green-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-800">
          Complete RR
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900">
          Reject Repair — Pending {pendingItems.length}
        </h1>
        <div className="ml-auto flex gap-2">
          <button onClick={handleComplete}
            className="bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-800">
            Complete RR
          </button>
        </div>
      </div>

      {item && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Images */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-lg shadow-sm p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">FRONT</div>
              <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                {item.imageFrontPath ? (
                  <img src={getImageUrl(item.imageFrontPath)} alt="Front" className="max-w-full max-h-full object-contain" />
                ) : <span className="text-gray-400 text-sm">No image</span>}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">BACK</div>
              <div className="aspect-video bg-gray-100 rounded flex items-center justify-center">
                {item.imageBackPath ? (
                  <img src={getImageUrl(item.imageBackPath)} alt="Back" className="max-w-full max-h-full object-contain" />
                ) : <span className="text-gray-400 text-sm">No image</span>}
              </div>
            </div>
          </div>

          {/* MICR + slip data + actions */}
          <div className="space-y-3">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 mb-1">RAW SCAN MICR (read-only)</div>
              <div className="text-xs font-mono text-gray-500 mb-3 bg-gray-50 rounded p-2 space-y-0.5">
                <div>CHQ: {item.chqNo ?? '—'}</div>
                <div>MICR1: {item.scanMICR1 ?? '—'}</div>
                <div>MICR2: {item.scanMICR2 ?? '—'}</div>
                <div>MICR3: {item.scanMICR3 ?? '—'}</div>
                <div className="text-gray-400">Raw: {item.micrRaw ?? 'N/A'}</div>
              </div>

              <div className="text-xs font-semibold text-gray-500 mb-3">REPAIR VALUES</div>
              <div className="space-y-2">
                {[
                  { label: 'Cheque No (6 digits)', key: 'chqNo', maxLen: 6 },
                  { label: 'MICR1 (9 digits)', key: 'micr1', maxLen: 9 },
                  { label: 'MICR2 (6 digits)', key: 'micr2', maxLen: 6 },
                  { label: 'MICR3 (2 digits)', key: 'micr3', maxLen: 2 },
                ].map(({ label, key, maxLen }) => (
                  <div key={key}>
                    <label htmlFor={`rr-${key}`} className="block text-xs text-gray-500 mb-0.5">{label}</label>
                    <input
                      id={`rr-${key}`}
                      value={micr[key as keyof typeof micr]}
                      onChange={(e) => setMicr(m => ({ ...m, [key]: e.target.value }))}
                      maxLength={maxLen}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {item.slipNo && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <div className="font-semibold text-blue-800 mb-1">Slip Data</div>
                <div className="text-xs text-blue-700 space-y-0.5">
                  <div>Slip No: {item.slipNo}</div>
                  <div>Client: {item.clientName ?? '—'}</div>
                  <div>Amount: &#8377;{item.slipAmount?.toLocaleString() ?? '—'}</div>
                  <div>Instruments: {item.totalInstruments ?? '—'}</div>
                  <div>
                    Current Cheque in Slip: {currentSlipPosition} of {currentSlipItems.length}
                  </div>
                  <div>
                    Slip Cheques: {currentSlipItems.map(i => String(i.chqSeq).padStart(2, '0')).join(', ') || '—'}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
              <button
                onClick={handleApproveAndNext}
                disabled={saving}
                className="w-full bg-green-600 text-white py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (isLastPending ? 'Approve & Finish' : 'Approve & Next')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
