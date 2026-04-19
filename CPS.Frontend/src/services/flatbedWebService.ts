// =============================================================================
// File        : flatbedWebService.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanner
// Description : WebSocket client for the flatbed/document scanner desktop app (ws://127.0.0.1:8765).
// Created     : 2026-04-19
// =============================================================================

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FlatbedScanner {
  source: string;
  name: string;
  transport: string;
  details: string;
}

export interface DetectScannersResult {
  scanners: FlatbedScanner[];
  preferred_scanner: string;
  usb_scanners: string[];
  message: string;
}

export interface AutoSelectResult {
  scanner_id: string;
  source: string;
  message: string;
}

export interface ScanSettings {
  resolution?: number;   // 75–1200, default 300
  mode?: 'Color' | 'Gray' | 'Lineart';
  format?: 'PNG' | 'JPEG' | 'TIFF' | 'BMP';
  brightness?: number;
  contrast?: number;
  auto_crop?: boolean;
  auto_deskew?: boolean;
}

export interface ScanResult {
  scanner_id: string;
  file_path: string;
  image_base64: string;
  format: string;
  method: string;
  actual_settings: Record<string, unknown>;
  message: string;
}

interface WsResponse {
  status: 'success' | 'error';
  data: any;
  error: string | null;
}

// ── State ──────────────────────────────────────────────────────────────────────

let _ws: WebSocket | null = null;
let _url = 'ws://127.0.0.1:8765';
let _pendingResolve: ((r: WsResponse) => void) | null = null;
let _pendingReject: ((e: Error) => void) | null = null;

export function setFlatbedWsUrl(url: string) { _url = url; }
export function getFlatbedWsUrl() { return _url; }

export function isFlatbedConnected() {
  return _ws !== null && _ws.readyState === WebSocket.OPEN;
}

// ── Connection ─────────────────────────────────────────────────────────────────

export async function flatbedConnect(): Promise<void> {
  if (isFlatbedConnected()) return;
  return new Promise((resolve, reject) => {
    try {
      _ws = new WebSocket(_url);

      const timer = setTimeout(() => {
        _ws?.close();
        reject(new Error('Flatbed scanner connection timeout (8s) — is the desktop app running?'));
      }, 8000);

      _ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      _ws.onerror = () => {
        clearTimeout(timer);
        _ws = null;
        reject(new Error('Flatbed scanner connection failed — ensure ScannerDesktopApp.exe is running on this machine.'));
      };

      _ws.onmessage = ev => {
        try {
          const resp: WsResponse = JSON.parse(ev.data);
          if (_pendingResolve) {
            const res = _pendingResolve;
            _pendingResolve = null;
            _pendingReject = null;
            res(resp);
          }
        } catch {
          _pendingReject?.(new Error('Invalid JSON from flatbed scanner'));
          _pendingResolve = null;
          _pendingReject = null;
        }
      };

      _ws.onclose = () => {
        _ws = null;
        _pendingReject?.(new Error('Flatbed connection closed unexpectedly'));
        _pendingResolve = null;
        _pendingReject = null;
      };
    } catch (err: any) {
      reject(new Error(err?.message ?? 'Flatbed connection error'));
    }
  });
}

export function flatbedDisconnect() {
  _ws?.close();
  _ws = null;
  _pendingResolve = null;
  _pendingReject = null;
}

// ── Send / Receive ─────────────────────────────────────────────────────────────

function sendAction(action: string, params: object = {}, timeoutMs = 60_000): Promise<WsResponse> {
  return new Promise((resolve, reject) => {
    if (!isFlatbedConnected()) {
      reject(new Error('Flatbed not connected. Call flatbedConnect() first.'));
      return;
    }

    const timer = setTimeout(() => {
      _pendingResolve = null;
      _pendingReject = null;
      reject(new Error(`Flatbed action "${action}" timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    _pendingResolve = resp => {
      clearTimeout(timer);
      resolve(resp);
    };
    _pendingReject = err => {
      clearTimeout(timer);
      reject(err);
    };

    _ws!.send(JSON.stringify({ action, params }));
  });
}

// ── API Actions ────────────────────────────────────────────────────────────────

/** Detect all scanners connected to the machine (WIA + TWAIN). */
export async function flatbedDetectScanners(): Promise<DetectScannersResult> {
  const resp = await sendAction('detect_scanners', {});
  if (resp.status === 'error') throw new Error(resp.error ?? 'detect_scanners failed');
  return resp.data as DetectScannersResult;
}

/** Let the service automatically pick the best available scanner. */
export async function flatbedAutoSelect(): Promise<AutoSelectResult> {
  const resp = await sendAction('auto_select', {});
  if (resp.status === 'error') throw new Error(resp.error ?? 'auto_select failed');
  return resp.data as AutoSelectResult;
}

/** Get capability info for a specific scanner. */
export async function flatbedGetScannerInfo(scannerId: string): Promise<string> {
  const resp = await sendAction('get_scanner_info', { scanner_id: scannerId });
  if (resp.status === 'error') throw new Error(resp.error ?? 'get_scanner_info failed');
  return resp.data.message as string;
}

/**
 * Trigger a scan. Returns the ScanResult which includes image_base64.
 * Automatically uses include_base64: true so images can be uploaded directly.
 */
export async function flatbedScan(scannerId: string, settings: ScanSettings = {}): Promise<ScanResult> {
  const params = {
    scanner_id: scannerId,
    resolution: settings.resolution ?? 300,
    mode: settings.mode ?? 'Gray',
    format: settings.format ?? 'PNG',
    brightness: settings.brightness ?? 0,
    contrast: settings.contrast ?? 0,
    auto_crop: settings.auto_crop ?? false,
    auto_deskew: settings.auto_deskew ?? false,
    include_base64: true,
  };

  // Scan can be slow — 60s timeout
  const resp = await sendAction('scan', params, 60_000);
  if (resp.status === 'error') throw new Error(resp.error ?? 'Scan failed');
  return resp.data as ScanResult;
}
