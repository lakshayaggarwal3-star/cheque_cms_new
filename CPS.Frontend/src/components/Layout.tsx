// =============================================================================
// File        : Layout.tsx
// Project     : CPS — Cheque Processing System
// Module      : UI
// Description : App shell — icon-rail sidebar + top bar matching design system.
// Created     : 2026-04-14
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { logout } from '../services/authService';

// ── Icon ─────────────────────────────────────────────────────────────────────

function Icon({ name, size = 20, weight = 400, style }: {
  name: string; size?: number; weight?: number; style?: React.CSSProperties;
}) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' 0, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    >{name}</span>
  );
}

// ── IconButton ────────────────────────────────────────────────────────────────

function IconButton({ icon, tooltip, onClick }: { icon: string; tooltip?: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={tooltip}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 36, height: 36,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'var(--bg-hover)' : 'transparent',
        color: hover ? 'var(--fg)' : 'var(--fg-muted)',
        border: '1px solid transparent',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        transition: 'background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

// ── LogoIcon ──────────────────────────────────────────────────────────────────

function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      background: 'var(--accent-500)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.5),
      fontFamily: 'var(--font-sans)', flexShrink: 0,
      boxShadow: 'inset 0 -2px 0 rgb(0 0 0 / 15%)',
    }}>
      c
    </div>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({ icon, label, active, expanded, onClick }: {
  icon: string; label: string; active: boolean; expanded: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <a
      onClick={onClick}
      title={expanded ? '' : label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center',
        gap: 12,
        padding: expanded ? '8px 10px' : '9px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
        borderRadius: 'var(--r-md)',
        margin: expanded ? 0 : '0 10px',
        fontSize: 'var(--text-sm)', fontWeight: 500,
        color: active ? 'var(--accent-700)' : (hover ? 'var(--fg)' : 'var(--fg-muted)'),
        background: active ? 'var(--accent-50)' : (hover ? 'var(--bg-hover)' : 'transparent'),
        cursor: 'pointer',
        transition: 'color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease)',
        position: 'relative',
        textDecoration: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name={icon} size={20} weight={active ? 500 : 400} />
      {expanded && <span>{label}</span>}
      {active && !expanded && (
        <span style={{
          position: 'absolute', left: 0, top: 8, bottom: 8,
          width: 3, borderRadius: '0 3px 3px 0',
          background: 'var(--accent-500)',
        }} />
      )}
    </a>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavLink {
  id: string; label: string; icon: string; path: string; roles?: string[];
}

const NAV_LINKS: NavLink[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: 'dashboard',        path: '/' },
  { id: 'batch-create', label: 'New Batch',     icon: 'add_circle',       path: '/batch/create', roles: ['Scanner', 'MobileScanner', 'Admin', 'Developer'] },
  { id: 'scan',         label: 'Scanning',      icon: 'document_scanner', path: '/scan',         roles: ['Scanner', 'MobileScanner', 'Admin', 'Developer'] },
  { id: 'rr',           label: 'Reject Repair', icon: 'build',            path: '/rr' },
  { id: 'users',        label: 'Users',         icon: 'group',            path: '/admin/users',  roles: ['Admin', 'Developer'] },
  { id: 'masters',      label: 'Masters',       icon: 'folder',           path: '/admin/masters', roles: ['Admin', 'Developer'] },
];

const FOOTER_LINKS: NavLink[] = [
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/admin/settings', roles: ['Developer'] },
  { id: 'logout',   label: 'Sign out', icon: 'logout',   path: '#logout' },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/':               { title: 'Dashboard',     subtitle: 'Overview & batch queue' },
  '/batch/create':   { title: 'New Batch',     subtitle: 'Create & dispatch to scanner' },
  '/scan':           { title: 'Scanning',      subtitle: 'Capture cheques · MICR read' },
  '/rr':             { title: 'Reject Repair', subtitle: 'Review & correct flagged items' },
  '/admin/users':    { title: 'Users',         subtitle: 'Manage operators & roles' },
  '/admin/masters':  { title: 'Masters',       subtitle: 'Clients, banks, sort codes' },
  '/admin/settings': { title: 'Settings',      subtitle: 'Application preferences' },
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ expanded, open, currentPath, onNav, onLogout, user }: {
  expanded: boolean;
  open: boolean;
  currentPath: string;
  onNav: (path: string) => void;
  onLogout: () => void;
  user: { username: string; locationName: string; roles: string[]; isDeveloper?: boolean } | null;
}) {
  const W = expanded ? 232 : 60;

  const hasRole = (roles?: string[]) => {
    if (!roles) return true;
    if (!user) return false;
    return roles.some(r => user.roles.includes(r));
  };

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? 'U';

  const isActive = (link: NavLink) =>
    link.path === '/' ? currentPath === '/' : currentPath.startsWith(link.path);

  return (
    <aside
      className={`app-sidebar${open ? ' sidebar-open' : ''}`}
      style={{
        width: W, minWidth: W,
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width var(--dur) var(--ease), min-width var(--dur) var(--ease)',
        position: 'relative', zIndex: 2,
        height: '100vh', flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: expanded ? '16px 18px' : '16px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
        height: 56, boxSizing: 'border-box', flexShrink: 0,
      }}>
        <LogoIcon size={24} />
        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>CPS</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 2 }}>Cheque Processing</span>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav style={{
        flex: 1,
        padding: expanded ? '6px 10px' : '6px 0',
        display: 'flex', flexDirection: 'column', gap: 2,
        overflow: 'hidden',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {NAV_LINKS.filter(l => hasRole(l.roles)).map(l => (
          <NavItem key={l.id} icon={l.icon} label={l.label}
            active={isActive(l)} expanded={expanded}
            onClick={() => onNav(l.path)} />
        ))}
      </nav>

      {/* Footer nav */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: expanded ? '6px 10px' : '6px 0',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {FOOTER_LINKS.filter(l => hasRole(l.roles)).map(l => (
          <NavItem key={l.id} icon={l.icon} label={l.label}
            active={false} expanded={expanded}
            onClick={() => l.path === '#logout' ? onLogout() : onNav(l.path)} />
        ))}
      </div>

      {/* Profile */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: expanded ? '12px 14px' : '12px 0',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: expanded ? 'flex-start' : 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--accent-100)', color: 'var(--accent-700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600, fontSize: 13, flexShrink: 0,
        }}>
          {initials}
        </div>
        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>
              {user?.username}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.locationName}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

function TopBar({ onToggle, title, subtitle, isDeveloper }: {
  onToggle: () => void; title: string; subtitle?: string; isDeveloper?: boolean;
}) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 20px', height: 56, boxSizing: 'border-box',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 5, flexShrink: 0,
    }}>
      <IconButton icon="menu" tooltip="Toggle sidebar" onClick={onToggle} />
      <div className="topbar-title-wrap">
        <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </h1>
        {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
      </div>
      <div style={{ flex: 1 }} />
      {isDeveloper && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 'var(--r-full)',
          fontSize: 'var(--text-xs)', fontWeight: 500,
          background: 'var(--accent-50)', color: 'var(--accent-700)',
          border: '1px solid var(--accent-100)',
        }}>
          <Icon name="code" size={12} />
          DEV
        </span>
      )}
      <IconButton icon="notifications" tooltip="Notifications" />
      <IconButton icon="help" tooltip="Help" />
    </header>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function Layout() {
  const { user, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const autoClosePaths = ['/scan', '/batch/create', '/rr'];

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.innerWidth < 1024) return false;
    if (autoClosePaths.some(p => window.location.pathname.startsWith(p))) return false;
    return true;
  });

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        const shouldClose = autoClosePaths.some(p => window.location.pathname.startsWith(p));
        if (!shouldClose) setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (autoClosePaths.some(p => location.pathname.startsWith(p))) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try { await logout(); } finally { clearUser(); navigate('/login'); }
  };

  const handleNav = (path: string) => {
    navigate(path);
    
    const isAutoClosePage = autoClosePaths.some(p => path.startsWith(p));
    if (isMobile || path === location.pathname || isAutoClosePage) {
      setSidebarOpen(false);
    }
  };

  const pageInfo = Object.entries(PAGE_TITLES).find(([pattern]) =>
    pattern === '/' ? location.pathname === '/' : location.pathname.startsWith(pattern)
  )?.[1] ?? { title: 'CPS', subtitle: '' };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--fg)',
      display: 'flex',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop${isMobile && sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        expanded={isMobile ? true : sidebarOpen}
        open={sidebarOpen}
        currentPath={location.pathname}
        onNav={handleNav}
        onLogout={handleLogout}
        user={user}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopBar
          onToggle={() => setSidebarOpen(o => !o)}
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          isDeveloper={user?.isDeveloper}
        />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <div className="page-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 48px' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
