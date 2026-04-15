// =============================================================================
// File        : SettingsPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Admin / Developer
// Description : System settings and developer tools — reset, diagnostics, config.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { getRoleCatalog, resetOperationalData, RoleCatalogDto } from '../services/systemService';
import { toast } from '../store/toastStore';
import { useSettingsStore } from '../store/settingsStore';

export function SettingsPage() {
  const [resetting, setResetting] = useState(false);
  const [roles, setRoles] = useState<RoleCatalogDto[]>([]);
  const { mockScanEnabled, setMockScanEnabled } = useSettingsStore();

  useEffect(() => {
    getRoleCatalog()
      .then(setRoles)
      .catch(() => toast.error('Failed to load role catalog'));
  }, []);

  const handleReset = async () => {
    if (!window.confirm(
      'This will permanently delete all batches, scans, slips, and logs.\n\nUsers and master data (locations, clients) will be kept.\n\nContinue?'
    )) return;
    if (!window.confirm('Final confirmation — reset operational data now?')) return;

    setResetting(true);
    try {
      await resetOperationalData();
      toast.success('Operational data reset complete');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">System configuration and developer tools.</p>
      </div>

      {/* Scanning */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Scanning</h2>
        </div>
        <div className="px-5 py-5">
          <label className="flex items-start justify-between gap-6 p-4 border border-gray-100 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-gray-900">Mock Scan Mode</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled, Scan page can generate mock front/back images (for dev/UAT without hardware).
              </p>
            </div>
            <input
              type="checkbox"
              checked={mockScanEnabled}
              onChange={(e) => setMockScanEnabled(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
          </label>
        </div>
      </div>

      {/* Developer tools */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Role Table</h2>
        </div>
        <div className="px-5 py-5">
          {roles.length === 0 ? (
            <p className="text-sm text-gray-400">No roles found.</p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.key} className="rounded-lg border border-gray-100 p-3">
                  <p className="text-sm font-medium text-gray-900">{role.name}</p>
                  <p className="text-xs text-gray-500">{role.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            Developer
          </span>
          <h2 className="text-sm font-semibold text-gray-900">Developer Tools</h2>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Reset operational data */}
          <div className="flex items-start justify-between gap-6 p-4 border border-red-100 rounded-lg bg-red-50/40">
            <div>
              <p className="text-sm font-semibold text-gray-900">Reset Operational Data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Deletes all batches, scans, slips, RR records, and audit logs.
                Users, locations, and client master data are preserved.
                Use only in development or UAT — irreversible.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="shrink-0 inline-flex items-center gap-2 bg-red-700 text-white text-sm
                font-medium px-4 py-2 rounded-lg hover:bg-red-800 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors"
            >
              {resetting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Resetting…
                </>
              ) : 'Reset Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
