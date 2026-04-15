// =============================================================================
// File        : ProtectedRoute.tsx
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Route wrapper that redirects unauthenticated or unauthorized users.
// Created     : 2026-04-14
// =============================================================================

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  roles?: string[];
}

export function ProtectedRoute({ roles }: Props) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && user) {
    const isAdmin = user.roles.includes('Admin') || user.roles.includes('Developer');
    const hasRole = roles.some(r => user.roles.includes(r));
    if (!isAdmin && !hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
