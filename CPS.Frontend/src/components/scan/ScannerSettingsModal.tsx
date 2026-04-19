// =============================================================================
// File        : ScannerSettingsModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning — Scanner Settings Modal
// Description : Modal for configuring scanner settings (Ranger, Flatbed, MICR, Endorsement)
// Created     : 2026-04-19
// =============================================================================

import type { FlatbedScanner, ScanSettings } from '../../services/flatbedWebService';
import { Icon, Toggle } from './ScanPageUI';

export function ScannerSettingsModal({
  rangerWsUrl, flatbedWsUrl, useFlatbedWs, isDeveloper, flatbedConnecting,
  detectedScanners, selectedScannerId, flatbedResolution, flatbedMode,
  rangerMicrEnabled, rangerEndorsementEnabled,
  rangerEndorsementUseImageName, rangerEndorsementCustomText,
  onRangerUrlChange, onFlatbedUrlChange, onFlatbedWsToggle,
  onDetectScanners, onAutoSelect, onSelectScanner,
  onResolutionChange, onModeChange,
  onRangerMicrChange, onRangerEndorsementChange,
  onRangerEndorsementModeChange, onRangerEndorsementTextChange,
  onSave, onClose,
}: {
  rangerWsUrl: string; flatbedWsUrl: string; useFlatbedWs: boolean;
  isDeveloper: boolean; flatbedConnecting: boolean;
  detectedScanners: FlatbedScanner[]; selectedScannerId: string;
  flatbedResolution: number; flatbedMode: ScanSettings['mode'];
  rangerMicrEnabled: boolean; rangerEndorsementEnabled: boolean;
  rangerEndorsementUseImageName: boolean; rangerEndorsementCustomText: string;
  onRangerUrlChange: (v: string) => void; onFlatbedUrlChange: (v: string) => void;
  onFlatbedWsToggle: (v: boolean) => void;
  onDetectScanners: () => void; onAutoSelect: () => void;
  onSelectScanner: (id: string) => void;
  onResolutionChange: (v: number) => void; onModeChange: (v: ScanSettings['mode']) => void;
  onRangerMicrChange: (v: boolean) => void;
  onRangerEndorsementChange: (v: boolean) => void;
  onRangerEndorsementModeChange: (v: boolean) => void;
  onRangerEndorsementTextChange: (v: string) => void;
  onSave: () => void; onClose: () => void;
}) {
  const uniqueScanners = Array.from(new Map(detectedScanners.map(s => [s.name, s])).values());

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: 'calc(100dvh - 2rem)', display: 'flex', flexDirection: 'column', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)' }}>Scanner Settings</h2>
            <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>Configure WebSocket endpoints and scan parameters.</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', borderRadius: 'var(--r-md)' }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto' }}>

          {/* ── Ranger URL ── */}
          <section>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
              Cheque Scanner (Ranger)
            </div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>WebSocket URL</label>
            <input className="input-field" value={rangerWsUrl} onChange={e => onRangerUrlChange(e.target.value)} placeholder="ws://127.0.0.1:9002" style={{ fontFamily: 'var(--font-mono)' }} />
            <p style={{ margin: '5px 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>Ranger PICA cheque scanner — bulk feed mode.</p>
          </section>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* ── Ranger Scan Options ── */}
          <section>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>
              Ranger Scan Options
            </div>

            {/* MICR toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>MICR Reading</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 1 }}>
                  Capture and store MICR line data from cheque bottom
                </div>
              </div>
              <Toggle on={rangerMicrEnabled} onToggle={() => onRangerMicrChange(!rangerMicrEnabled)} />
            </div>

            {/* Endorsement toggle */}
            <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: rangerEndorsementEnabled ? 12 : 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>Rear Endorsement</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 1 }}>
                    Print text on back of cheque during scanning
                  </div>
                </div>
                <Toggle on={rangerEndorsementEnabled} onToggle={() => onRangerEndorsementChange(!rangerEndorsementEnabled)} />
              </div>

              {rangerEndorsementEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Mode selector */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                      border: `1px solid ${rangerEndorsementUseImageName ? 'var(--accent-400)' : 'var(--border)'}`,
                      background: rangerEndorsementUseImageName ? 'var(--accent-50)' : 'var(--bg)',
                    }}>
                      <input type="radio" name="endorseMode" checked={rangerEndorsementUseImageName} onChange={() => onRangerEndorsementModeChange(true)} style={{ accentColor: 'var(--accent-500)' }} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: rangerEndorsementUseImageName ? 'var(--accent-700)' : 'var(--fg)' }}>Image name</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>e.g. B_0001</div>
                      </div>
                    </label>
                    <label style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                      border: `1px solid ${!rangerEndorsementUseImageName ? 'var(--accent-400)' : 'var(--border)'}`,
                      background: !rangerEndorsementUseImageName ? 'var(--accent-50)' : 'var(--bg)',
                    }}>
                      <input type="radio" name="endorseMode" checked={!rangerEndorsementUseImageName} onChange={() => onRangerEndorsementModeChange(false)} style={{ accentColor: 'var(--accent-500)' }} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: !rangerEndorsementUseImageName ? 'var(--accent-700)' : 'var(--fg)' }}>Custom text</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>fixed string</div>
                      </div>
                    </label>
                  </div>

                  {/* Custom text input */}
                  {!rangerEndorsementUseImageName && (
                    <input
                      className="input-field"
                      value={rangerEndorsementCustomText}
                      onChange={e => onRangerEndorsementTextChange(e.target.value)}
                      placeholder="Enter endorsement text…"
                      maxLength={40}
                    />
                  )}

                  {rangerEndorsementUseImageName && (
                    <div style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', background: 'var(--info-bg, #eff6ff)', border: '1px solid var(--info, #3b82f6)', fontSize: 10, color: 'var(--info, #1d4ed8)' }}>
                      Endorsement text = back image filename without extension (e.g. <strong>B_0001</strong> for the first cheque in the batch)
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* ── Flatbed ── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Flatbed / Slip Scanner
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Enable WebSocket</span>
                <Toggle on={useFlatbedWs} onToggle={() => onFlatbedWsToggle(!useFlatbedWs)} />
              </div>
            </div>

            <label className="label" style={{ display: 'block', marginBottom: 6 }}>WebSocket URL</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                className="input-field"
                value={flatbedWsUrl}
                onChange={e => onFlatbedUrlChange(e.target.value)}
                placeholder="ws://127.0.0.1:8765"
                style={{ fontFamily: 'var(--font-mono)', flex: 1, opacity: useFlatbedWs ? 1 : 0.5 }}
                disabled={!useFlatbedWs}
              />
              {useFlatbedWs && (
                <button onClick={onDetectScanners} disabled={flatbedConnecting} className="btn-secondary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {flatbedConnecting ? 'Detecting…' : 'Detect scanners'}
                </button>
              )}
            </div>

            {useFlatbedWs && uniqueScanners.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="label">Select scanner</label>
                  <button onClick={onAutoSelect} disabled={flatbedConnecting} className="btn-ghost" style={{ fontSize: 'var(--text-xs)', height: 26, padding: '0 8px' }}>
                    Auto-select
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {uniqueScanners.map(s => (
                    <div
                      key={s.name}
                      onClick={() => onSelectScanner(s.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                        border: `1px solid ${selectedScannerId === s.name ? 'var(--accent-400)' : 'var(--border)'}`,
                        background: selectedScannerId === s.name ? 'var(--accent-50)' : 'var(--bg)',
                      }}
                    >
                      <Icon name="scanner" size={16} style={{ color: selectedScannerId === s.name ? 'var(--accent-600)' : 'var(--fg-muted)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>{s.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>{s.source.toUpperCase()} · {s.transport}</div>
                      </div>
                      {selectedScannerId === s.name && <Icon name="check_circle" size={16} style={{ color: 'var(--accent-600)' }} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {useFlatbedWs && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Resolution (DPI)</label>
                  <select className="input-field" value={flatbedResolution} onChange={e => onResolutionChange(Number(e.target.value))}>
                    <option value={150}>150 dpi</option>
                    <option value={200}>200 dpi</option>
                    <option value={300}>300 dpi</option>
                    <option value={600}>600 dpi</option>
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Colour Mode</label>
                  <select className="input-field" value={flatbedMode} onChange={e => onModeChange(e.target.value as ScanSettings['mode'])}>
                    <option value="Gray">Grayscale</option>
                    <option value="Color">Colour</option>
                    <option value="Lineart">Lineart (B&W)</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {isDeveloper && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--warning-bg)', border: '1px solid var(--warning)', fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
              Developer mode active — mock scanning available in scan controls (enable in Settings page).
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={onSave} className="btn-primary">Save settings</button>
        </div>
      </div>
    </div>
  );
}
