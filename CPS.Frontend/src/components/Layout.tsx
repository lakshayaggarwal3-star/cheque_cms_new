// =============================================================================
// File        : Layout.tsx
// Project     : CPS — Cheque Processing System
// Module      : UI
// Description : Main app layout with responsive sidebar navigation and header.
// Created     : 2026-04-14
// =============================================================================

import React, { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { logout } from '../services/authService';
import { toast } from '../store/toastStore';

export function Layout() {
  const { user, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearUser();
      navigate('/login');
    }
  };

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/admin/users', label: 'Users', icon: '👥', role: 'Admin' },
    { to: '/admin/masters', label: 'Masters', icon: '📂', role: 'Admin' },
    { to: '/admin/settings', label: 'Settings', icon: '⚙️', role: 'Developer' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar — desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-blue-900 text-white transform transition-transform duration-200
        lg:translate-x-0 lg:static lg:flex lg:flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-blue-800">
          <div>
            <div className="font-bold text-lg">CPS</div>
            <div className="text-blue-300 text-xs">Cheque Processing System</div>
          </div>
          <button className="lg:hidden text-white" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <div className="p-3 border-b border-blue-800 text-xs text-blue-300">
          <div className="font-medium text-white">{user?.username}</div>
          <div>{user?.locationName}</div>
          <div>EOD: {user?.eodDate}</div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navLinks.map(({ to, label, icon, role }) => {
            if (role && !user?.roles.includes(role) && !user?.roles.includes('Admin') && !user?.roles.includes('Developer'))
              return null;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors
                  ${isActive(to)
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                  }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-blue-200 hover:text-white px-3 py-2 rounded hover:bg-blue-800"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Sidebar overlay — mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            className="lg:hidden text-gray-600 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span className="text-gray-500 text-sm font-medium">
            SCB — Standard Chartered Bank
          </span>
          <div className="ml-auto flex items-center gap-2">
            {user?.isDeveloper && (
              <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                DEV MODE
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
