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
import { useTheme } from '../hooks/useTheme';

export function SettingsPage() {
  const [resetting, setResetting] = useState(false);
  const [roles, setRoles] = useState<RoleCatalogDto[]>([]);
  const { mockScanEnabled, setMockScanEnabled } = useSettingsStore();
  const { theme, setTheme } = useTheme();

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
        <h1 className="text-2xl font-bold text-light-primary dark:text-dark-primary">Settings</h1>
        <p className="text-sm text-light-secondary dark:text-dark-secondary mt-0.5">System configuration and developer tools.</p>
      </div>

      {/* Appearance */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-light-DEFAULT dark:border-dark-DEFAULT flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-500" style={{ fontSize: '20px' }}>
            palette
          </span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Appearance</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          {/* Theme Selection */}
          <div className="flex items-start justify-between gap-6 p-4 border border-light-DEFAULT dark:border-dark-DEFAULT rounded-lg hover:bg-light-subtle dark:hover:bg-dark-subtle transition-colors duration-fast">
            <div>
              <p className="text-sm font-semibold text-light-primary dark:text-dark-primary">Theme</p>
              <p className="text-xs text-light-secondary dark:text-dark-secondary mt-0.5">
                Choose between light and dark theme.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-fast ${
                    theme === t
                      ? 'bg-accent-500 text-white'
                      : 'bg-light-subtle dark:bg-dark-subtle text-light-secondary dark:text-dark-secondary hover:bg-light-subtle dark:hover:bg-dark-subtle'
                  }`}
                >
                  <span className="capitalize flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      {t === 'light' ? 'light_mode' : 'dark_mode'}
                    </span>
                    {t}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scanning */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-light-DEFAULT dark:border-dark-DEFAULT flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-500" style={{ fontSize: '20px' }}>
            document_scanner
          </span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Scanning</h2>
        </div>
        <div className="px-5 py-5">
          <label className="flex items-start justify-between gap-6 p-4 border border-light-DEFAULT dark:border-dark-DEFAULT rounded-lg hover:bg-light-subtle dark:hover:bg-dark-subtle transition-colors duration-fast cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-light-primary dark:text-dark-primary">Mock Scan Mode</p>
              <p className="text-xs text-light-secondary dark:text-dark-secondary mt-0.5">
                Enable mock image generation for testing without hardware scanner.
              </p>
            </div>
            <input
              type="checkbox"
              checked={mockScanEnabled}
              onChange={(e) => setMockScanEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 accent-accent-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Role Catalog */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-light-DEFAULT dark:border-dark-DEFAULT flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-500" style={{ fontSize: '20px' }}>
            shield_person
          </span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Role Catalog</h2>
        </div>
        <div className="px-5 py-5">
          {roles.length === 0 ? (
            <p className="text-sm text-light-tertiary dark:text-dark-tertiary">No roles found.</p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.key}
                  className="rounded-lg border border-light-DEFAULT dark:border-dark-DEFAULT p-3 hover:bg-light-subtle dark:hover:bg-dark-subtle transition-colors duration-fast"
                >
                  <p className="text-sm font-medium text-light-primary dark:text-dark-primary">{role.name}</p>
                  <p className="text-xs text-light-secondary dark:text-dark-secondary mt-1">{role.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Developer Tools */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-light-DEFAULT dark:border-dark-DEFAULT flex items-center gap-2">
          <span className="material-symbols-outlined text-warning" style={{ fontSize: '20px' }}>
            code
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning-light dark:bg-warning dark:bg-opacity-20 text-warning">
            Developer
          </span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Developer Tools</h2>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Reset operational data */}
          <div className="flex items-start justify-between gap-6 p-4 border border-danger border-opacity-30 rounded-lg bg-danger-light dark:bg-danger dark:bg-opacity-10">
            <div>
              <p className="text-sm font-semibold text-light-primary dark:text-dark-primary">Reset Operational Data</p>
              <p className="text-xs text-light-secondary dark:text-dark-secondary mt-0.5">
                Deletes all batches, scans, slips, RR records, and audit logs.
                Users, locations, and client master data are preserved.
                Use only in development or UAT — irreversible.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="shrink-0 inline-flex items-center gap-2 bg-danger hover:bg-danger/90 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Resetting…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    delete_outline
                  </span>
                  Reset Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
