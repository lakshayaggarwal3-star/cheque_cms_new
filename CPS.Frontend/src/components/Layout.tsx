// =============================================================================
// File        : Layout.tsx
// Project     : CPS — Cheque Processing System
// Module      : UI
// Description : App shell — icon-rail sidebar + top bar matching design system.
// Created     : 2026-04-14
// =============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
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

function NavItem({ icon, label, active, expanded, onClick, path }: {
  icon: string; label: string; active: boolean; expanded: boolean; onClick?: () => void; path?: string;
}) {
  const [hover, setHover] = useState(false);

  const navStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    gap: 12,
    padding: expanded ? '8px 10px' : '9px 0',
    margin: expanded ? 0 : '0 10px',
    justifyContent: expanded ? 'flex-start' : 'center',
    borderRadius: 'var(--r-md)',
    fontSize: 'var(--text-sm)', fontWeight: 500,
    color: active ? 'var(--accent-700)' : (hover ? 'var(--fg)' : 'var(--fg-muted)'),
    background: active ? 'var(--accent-50)' : (hover ? 'var(--bg-hover)' : 'transparent'),
    cursor: 'pointer',
    transition: 'color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease)',
    position: 'relative',
    textDecoration: 'none',
    userSelect: 'none',
  };

  const inner = (
    <>
      <Icon name={icon} size={20} weight={active ? 500 : 400} />
      {expanded && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
      {active && !expanded && (
        <span style={{
          position: 'absolute', left: 0, top: 8, bottom: 8,
          width: 3, borderRadius: '0 3px 3px 0',
          background: 'var(--accent-500)',
        }} />
      )}
    </>
  );

  if (path) {
    return (
      <Link
        to={path}
        title={expanded ? '' : label}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={navStyle}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      title={expanded ? '' : label}
      onClick={(e) => { e.preventDefault(); onClick?.(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={navStyle}
    >
      {inner}
    </div>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavLinkDef {
  id: string; label: string; icon: string; path: string; roles?: string[];
}

const NAV_LINKS: NavLinkDef[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: 'dashboard',        path: '/' },
  { id: 'all-batches',  label: 'All Batches',   icon: 'list_alt',         path: '/all-batches' },
  { id: 'batch-create', label: 'New Batch',     icon: 'add_circle',       path: '/batch/create', roles: ['Scanner', 'Mobile Scanner', 'Admin', 'Developer'] },
  { id: 'scan',         label: 'Scanning',      icon: 'document_scanner', path: '/scan',         roles: ['Scanner', 'Mobile Scanner', 'Admin', 'Developer'] },
  { id: 'rr',           label: 'Reject Repair', icon: 'build',            path: '/rr' },
  { id: 'users',        label: 'Users',         icon: 'group',            path: '/admin/users',  roles: ['Admin', 'Developer'] },
  { id: 'masters',      label: 'Masters',       icon: 'account_balance',  path: '/admin/masters', roles: ['Admin', 'Developer'] },
];

const FOOTER_LINKS: NavLinkDef[] = [
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/admin/settings', roles: ['Developer'] },
  { id: 'logout',   label: 'Sign out', icon: 'logout',   path: '#logout' },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/':               { title: 'Dashboard',     subtitle: 'Overview & batch queue' },
  '/all-batches':    { title: 'All Batches',   subtitle: 'View & manage all batches' },
  '/batch/create':   { title: 'New Batch',     subtitle: 'Create & dispatch to scanner' },
  '/scan':           { title: 'Scanning Queue', subtitle: 'Batches pending scan' },
  '/rr':             { title: 'Reject Repair', subtitle: 'Batches pending repair' },
  '/admin/users':    { title: 'Users',         subtitle: 'Manage operators & roles' },
  '/admin/masters':  { title: 'Masters',       subtitle: 'Clients, locations, and clearing house data' },
  '/admin/settings': { title: 'Settings',      subtitle: 'Application preferences' },
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ expanded, open, currentPath, onNav, onLogout, user, isMobile }: {
  expanded: boolean;
  open: boolean;
  currentPath: string;
  onNav: (path: string) => void;
  onLogout: () => void;
  user: { username: string; locationName: string; roles: string[]; isDeveloper?: boolean } | null;
  isMobile: boolean;
}) {
  const W = expanded ? 232 : 60;

  const hasRole = (roles?: string[]) => {
    if (!roles) return true;
    if (!user) return false;
    return roles.some(r => user.roles.includes(r));
  };

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? 'U';

  const isActive = (link: NavLinkDef) =>
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
        position: 'relative', zIndex: 100, // Higher z-index to avoid being covered by page content
        height: isMobile ? '100dvh' : '100vh', 
        maxHeight: isMobile ? '100dvh' : '100vh',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: expanded ? '16px 18px' : '16px 0',
          justifyContent: expanded ? 'flex-start' : 'center',
          height: 64, boxSizing: 'border-box', flexShrink: 0,
        }}>
          <LogoIcon size={24} />
          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>CPS</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 2 }}>Cheque Processing</span>
            </div>
          )}
        </div>
      </Link>

      {/* Main nav */}
      <nav style={{
        flex: 1,
        padding: expanded ? '6px 10px' : '6px 0',
        display: 'flex', flexDirection: 'column', gap: 2,
        overflowY: isMobile ? 'hidden' : 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {NAV_LINKS.filter(l => hasRole(l.roles)).map(l => (
          <NavItem key={l.id} icon={l.icon} label={l.label}
            active={isActive(l)} expanded={expanded}
            path={l.path}
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
            path={l.path === '#logout' ? undefined : l.path}
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
        width: '100%',
        boxSizing: 'border-box',
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
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      padding: '10px 20px', height: 64, boxSizing: 'border-box',
      background: 'var(--bg-raised)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 5, flexShrink: 0,
    }}>
      <IconButton icon="menu" tooltip="Toggle sidebar" onClick={onToggle} />
      <div className="topbar-title-wrap">
        <h1 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </h1>
        {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
      </div>
      <div style={{ flex: 1 }} />
      <IconButton icon="notifications" tooltip="Notifications" />
      <IconButton icon="help" tooltip="Help" />
    </header>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

const AUTO_CLOSE_PATHS = ['/scan', '/batch/create', '/rr', '/all-batches'];

export function Layout() {
  const { user, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.innerWidth < 1024) return false;
    if (AUTO_CLOSE_PATHS.some(p => window.location.pathname.startsWith(p))) return false;
    return true;
  });



  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        const shouldClose = AUTO_CLOSE_PATHS.some(p => window.location.pathname.startsWith(p));
        if (!shouldClose) setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (AUTO_CLOSE_PATHS.some(p => location.pathname.startsWith(p))) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try { await logout(); } finally { clearUser(); navigate('/login'); }
  };

  const handleNav = (path: string) => {
    // Explicitly navigate if the Link fails for some reason (rare but possible in heavy trees)
    if (path && path !== location.pathname) {
      navigate(path);
    }
    const isAutoClosePage = AUTO_CLOSE_PATHS.some(p => path.startsWith(p));
    if (isMobile || isAutoClosePage) {
      setSidebarOpen(false);
    }
  };

  // Memoize header info to prevent transition lag
  const { pageInfo, isNoHeaderPage } = useMemo(() => {
    const info = Object.entries(PAGE_TITLES).find(([pattern]) =>
      pattern === '/' ? location.pathname === '/' : location.pathname.startsWith(pattern)
    )?.[1] ?? { title: 'CPS', subtitle: '' };

    const noHeader = (location.pathname.startsWith('/scan/') && location.pathname !== '/scan') || location.pathname.startsWith('/rr/');
    return { pageInfo: info, isNoHeaderPage: noHeader };
  }, [location.pathname]);

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
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
        isMobile={isMobile}
      />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Always hide TopBar for no-header pages (scan detail, rr detail) even on mobile
            to give maximum screen space for capture/edit. */}
        {(!isNoHeaderPage || isMobile) && (
          <TopBar
            onToggle={() => setSidebarOpen(o => !o)}
            title={pageInfo.title}
            subtitle={pageInfo.subtitle}
            isDeveloper={user?.isDeveloper}
          />
        )}

        <main 
          key={location.key}
          style={{
            flex: 1,
            overflowX: 'hidden',
            overflowY: (isNoHeaderPage && !isMobile) ? 'hidden' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            WebkitOverflowScrolling: 'touch',
            touchAction: (isNoHeaderPage && !isMobile) ? 'none' : 'pan-y',
          }}
        >
          <div
            className={!isNoHeaderPage ? "page-content" : ""}
            style={{
              padding: !isNoHeaderPage ? '20px 24px 32px' : 0,
              width: '100%',
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>


    </div>
  );
}
