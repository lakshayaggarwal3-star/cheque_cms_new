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
import { ToastProvider } from './components/ToastProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BatchCreatePage } from './pages/BatchCreatePage';
import { ScanRouterPage } from './pages/ScanRouterPage';
import { RRPage } from './pages/RRPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { MastersPage } from './pages/MasterUploadPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

function AppRoutes() {
  const { setUser, clearUser } = useAuthStore();
  const [booting, setBooting] = useState(true);

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

      {/* Protected — require any authenticated user */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/rr/:batchId" element={<RRPage />} />

          {/* Scanner / Admin / Developer */}
          <Route element={<ProtectedRoute roles={['Scanner', 'MobileScanner', 'Admin', 'Developer']} />}>
            <Route path="/batch/create" element={<BatchCreatePage />} />
            <Route path="/scan/:batchId" element={<ScanRouterPage />} />
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
