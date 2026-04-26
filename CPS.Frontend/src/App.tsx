// =============================================================================
// File        : App.tsx
// Project     : CPS — Cheque Processing System
// Module      : Root
// Description : Application root with React Router routes, auth rehydration, and layout wiring.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getMe } from './services/authService';
import { useAuthStore } from './store/authStore';
import { useTheme } from './hooks/useTheme';
import { ToastProvider } from './components/ToastProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
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

function AppRoutes() {
  const { setUser, clearUser } = useAuthStore();
  const [booting, setBooting] = useState(true);
  useTheme();

  useEffect(() => {
    getMe()
      .then(setUser)
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
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected — require any operational role (Excludes ImageViewer) */}
      <Route element={<ProtectedRoute roles={['Scanner', 'Mobile Scanner', 'Maker', 'Checker', 'Admin', 'Developer']} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/all-batches" element={<AllBatchesPage />} />
          <Route path="/rr" element={<RRListPage />} />
          <Route path="/rr/:batchId" element={<RRPage />} />

          {/* Scanner / Admin / Developer */}
          <Route element={<ProtectedRoute roles={['Scanner', 'Mobile Scanner', 'Admin', 'Developer']} />}>
            <Route path="/batch/create" element={<BatchCreatePage />} />
            <Route path="/batch/:batchId/details" element={<BatchCreatePage />} />
            <Route path="/scan" element={<ScanListPage />} />
            <Route path="/scan/:batchNo" element={<ScanRouterPage />} />
          </Route>

          {/* Admin / Developer only */}
          <Route element={<ProtectedRoute roles={['Admin', 'Developer']} />}>
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/masters" element={<MastersPage />} />
          </Route>

          {/* Developer only */}
          <Route element={<ProtectedRoute roles={['Developer']} />}>
            <Route path="/admin/settings" element={<SettingsPage />} />
          </Route>
        </Route>
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
