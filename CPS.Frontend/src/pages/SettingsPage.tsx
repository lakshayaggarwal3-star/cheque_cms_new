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
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        width: 44, height: 24, padding: 2,
        borderRadius: 'var(--r-full)', border: 'none',
        background: checked ? 'var(--accent-500)' : 'var(--border-strong)',
        cursor: 'pointer',
        transition: `background var(--dur-fast) var(--ease)`,
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      <span style={{
        display: 'block',
        width: 20, height: 20,
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transform: checked ? 'translateX(20px)' : 'translateX(0)',
        transition: `transform var(--dur-fast) var(--ease)`,
      }} />
    </button>
  );
}

// ── SegmentedSetting ──────────────────────────────────────────────────────────

function SegmentedSetting<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string; icon: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)',
      border: '1px solid var(--border)',
    }}>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', fontSize: 'var(--text-sm)', fontWeight: 500,
              color: active ? 'var(--fg-on-accent)' : 'var(--fg-muted)',
              background: active ? 'var(--accent-500)' : 'transparent',
              border: 'none', borderRadius: 'calc(var(--r-md) - 3px)',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: active ? 'var(--shadow-xs)' : 'none',
              transition: `background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)`,
            }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, lineHeight: 1 }}>{o.icon}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── SettingRow ────────────────────────────────────────────────────────────────

function SettingRow({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 p-4 border border-light-DEFAULT dark:border-dark-DEFAULT rounded-lg hover:bg-light-subtle dark:hover:bg-dark-subtle transition-colors duration-fast">
      <div>
        <p className="text-sm font-semibold text-light-primary dark:text-dark-primary">{title}</p>
        <p className="text-xs text-light-secondary dark:text-dark-secondary mt-0.5">{description}</p>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

// ── SettingsPage ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [resetting, setResetting] = useState(false);
  const [roles, setRoles] = useState<RoleCatalogDto[]>([]);
  const { mockScanEnabled, setMockScanEnabled, entryMode, setEntryMode } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();

  const hasBothRoles = !!(user?.roles.includes('Scanner') && user?.roles.includes('MobileScanner')) || !!user?.isDeveloper;

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
          <span className="material-symbols-outlined text-accent-500" style={{ fontSize: '20px' }}>palette</span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Appearance</h2>
        </div>
        <div className="px-5 py-5 space-y-3">
          <SettingRow title="Theme" description="Choose between light and dark theme.">
            <SegmentedSetting
              options={[
                { id: 'light' as const, label: 'Light', icon: 'light_mode' },
                { id: 'dark'  as const, label: 'Dark',  icon: 'dark_mode'  },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </SettingRow>
        </div>
      </div>

      {/* Scanning */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-light-DEFAULT dark:border-dark-DEFAULT flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-500" style={{ fontSize: '20px' }}>document_scanner</span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Scanning</h2>
        </div>
        <div className="px-5 py-5 space-y-3">

          {/* Entry Mode — only shown when user has both roles */}
          {hasBothRoles && (
            <SettingRow
              title="Entry Mode"
              description="How cheques are captured — via connected scanner device or mobile camera."
            >
              <SegmentedSetting
                options={[
                  { id: 'scanner' as const, label: 'Scanner', icon: 'document_scanner' },
                  { id: 'mobile'  as const, label: 'Mobile',  icon: 'smartphone'        },
                ]}
                value={entryMode}
                onChange={setEntryMode}
              />
            </SettingRow>
          )}

          <SettingRow
            title="Mock Scan Mode"
            description="Generate test images without a physical scanner. For development and UAT only."
          >
            <Toggle checked={mockScanEnabled} onChange={setMockScanEnabled} />
          </SettingRow>

        </div>
      </div>

      {/* Role Catalog */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-light-DEFAULT dark:border-dark-DEFAULT flex items-center gap-2">
          <span className="material-symbols-outlined text-accent-500" style={{ fontSize: '20px' }}>shield_person</span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Role Catalog</h2>
        </div>
        <div className="px-5 py-5">
          {roles.length === 0 ? (
            <p className="text-sm text-light-tertiary dark:text-dark-tertiary">No roles found.</p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.key} className="rounded-lg border border-light-DEFAULT dark:border-dark-DEFAULT p-3 hover:bg-light-subtle dark:hover:bg-dark-subtle transition-colors duration-fast">
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
          <span className="material-symbols-outlined text-warning" style={{ fontSize: '20px' }}>code</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning-light dark:bg-warning dark:bg-opacity-20 text-warning">Developer</span>
          <h2 className="text-sm font-semibold text-light-primary dark:text-dark-primary">Developer Tools</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
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
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete_outline</span>
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
