// =============================================================================
// File        : App.tsx
// Project     : CPS — Cheque Processing System
// Module      : Root
// Description : Application root with React Router routes, auth rehydration, and layout wiring.
// Created     : 2026-04-14
// =============================================================================

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getMe } from './services/authService';
import { useAuthStore } from './store/authStore';
import { syncUserSettings } from './store/settingsStore';
import { useTheme } from './hooks/useTheme';
import { ToastProvider } from './components/ToastProvider';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AllBatchesPage } from './pages/AllBatchesPage';
import { BatchCreatePage } from './pages/BatchCreatePage';
import { ScanRouterPage } from './pages/ScanRouterPage';
import { RRPage } from './pages/RRPage';
import { ScanListPage } from './pages/ScanListPage';
import { RRListPage } from './pages/RRListPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { MastersPage } from './pages/MasterUploadPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { SessionTerminatedPage } from './pages/SessionTerminatedPage';

function AppRoutes() {
  const { setUser, clearUser } = useAuthStore();
  const [booting, setBooting] = useState(true);
  useTheme();

  useEffect(() => {
    getMe()
      .then((user) => {
        setUser(user);
        syncUserSettings(); // Sync scanner vs mobile settings from DB
      })
      .catch(() => clearUser())
      .finally(() => setBooting(false));
  }, [setUser, clearUser]);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/session-terminated" element={<SessionTerminatedPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected — Layout handles auth redirect internally, single Outlet depth */}
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/all-batches" element={<AllBatchesPage />} />
        <Route path="/rr" element={<RRListPage />} />
        <Route path="/rr/:batchNo" element={<RRPage />} />
        <Route path="/batch/create" element={<BatchCreatePage />} />
        <Route path="/batch/:batchId/details" element={<BatchCreatePage />} />
        <Route path="/scan" element={<ScanListPage />} />
        <Route path="/scan/:batchNo" element={<ScanRouterPage />} />
        <Route path="/admin/users" element={<UserManagementPage />} />
        <Route path="/admin/masters" element={<MastersPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider />
      <AppRoutes />
    </BrowserRouter>
  );
}
