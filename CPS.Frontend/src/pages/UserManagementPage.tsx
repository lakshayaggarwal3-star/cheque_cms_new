// =============================================================================
// File        : UserManagementPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Admin
// Description : User management — create, edit, reset password, lock/unlock, activate/deactivate.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  getUsers, createUser, updateUser, resetPassword, unlockUser, activateUser, deactivateUser, deleteUser,
  CreateUserRequest, UpdateUserRequest,
} from '../services/userService';
import { getLocations } from '../services/locationService';
import { toast } from '../store/toastStore';
import type { UserDto, LocationDto } from '../types';
import { ROLES, getActiveRoles } from '../constants/roles';

type Mode = 'create' | 'edit' | 'reset-pw' | null;

interface UserFormFields {
  employeeID: string;
  password: string;
  confirmPassword: string;
  username: string;
  email: string;
  defaultLocationID: string;
  isDeveloper: boolean;
  // Dynamic role keys from ROLES definition
  [key: string]: string | boolean;
}

interface ResetPwForm {
  newPassword: string;
  confirm: string;
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ label, badgeClass }: { label: string; badgeClass: string }) {
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${badgeClass} shadow-sm border border-white/10`}>
      {label}
    </span>
  );
}

// ─── Searchable location dropdown ─────────────────────────────────────────────

function LocationSelect({
  locations,
  value,
  onChange,
}: {
  locations: LocationDto[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const active = locations.find(l => l.locationID.toString() === value);
  const filtered = locations
    .filter(l => l.isActive)
    .filter(l => l.locationName.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none transition-all text-left flex items-center justify-between gap-2"
      >
        <span className={active ? '' : 'opacity-40'}>
          {active ? active.locationName : 'Global / Unassigned'}
        </span>
        <svg className={`w-4 h-4 opacity-40 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 bg-[var(--bg-subtle)] rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 opacity-40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search location…"
                className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
              />
            </div>
          </div>
          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors ${!value ? 'text-blue-500 font-semibold' : 'opacity-60'}`}
            >
              Global / Unassigned
            </button>
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs opacity-30 italic">No locations match</p>
            ) : filtered.map(l => (
              <button
                key={l.locationID}
                type="button"
                onClick={() => { onChange(l.locationID.toString()); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors ${value === l.locationID.toString() ? 'text-blue-500 font-semibold' : ''}`}
              >
                {l.locationName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const [users,      setUsers]      = useState<UserDto[]>([]);
  const [locations,  setLocations]  = useState<LocationDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mode,       setMode]       = useState<Mode>(null);
  const [selected,   setSelected]   = useState<UserDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRoleWarning, setShowRoleWarning] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<UserFormFields | null>(null);

  const userForm = useForm<UserFormFields>();
  const pwForm   = useForm<ResetPwForm>();

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers(page, 20);
      setUsers(res.items);
      setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getLocations().then(setLocations).catch(() => {});
  }, []);

  // ── Open modes ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelected(null);
    setMode('create');
    const defaults: any = {
      employeeID: '', password: '', confirmPassword: '', username: '', email: '',
      defaultLocationID: '', isDeveloper: false,
    };
    ROLES.forEach(r => { defaults[r.key] = false; });
    userForm.reset(defaults);
  };

  const openEdit = (u: UserDto) => {
    setSelected(u);
    setMode('edit');
    const values: any = {
      employeeID: u.employeeID,
      password: '',
      username: u.username,
      email: u.email ?? '',
      defaultLocationID: u.defaultLocationID?.toString() ?? '',
      isDeveloper: u.isDeveloper,
    };
    ROLES.forEach(r => {
      values[r.key] = u.roles.includes(r.key);
    });
    userForm.reset(values);
  };

  const openResetPw = (u: UserDto) => {
    setSelected(u);
    setMode('reset-pw');
    pwForm.reset({ newPassword: '', confirm: '' });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleUserSubmit = async (data: UserFormFields) => {
    if (mode === 'create' && data.password !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const selectedRoles = ROLES.filter(r => data[r.key] === true).map(r => r.key);
    
    // Auto-select Scanner role if no roles are selected and not a developer
    if (selectedRoles.length === 0 && !data.isDeveloper) {
      selectedRoles.push('Scanner');
    }

    const isAdminOrDev = selectedRoles.includes('Admin') || data.isDeveloper;
    const hasCoreRoles = selectedRoles.some(r => ['Scanner', 'Mobile Scanner', 'Maker', 'Checker'].includes(r));
    
    if (isAdminOrDev && !hasCoreRoles && mode === 'edit') {
      setPendingRoles(data);
      setShowRoleWarning(true);
      return;
    }

    await performUserSubmit(data);
  };

  const performUserSubmit = async (data: UserFormFields) => {
    setSubmitting(true);
    try {
      const selectedRoles = ROLES.filter(r => data[r.key] === true).map(r => r.key);

      if (mode === 'create') {
        const req: CreateUserRequest = {
          employeeID:       data.employeeID,
          username:         data.username,
          password:         data.password,
          email:            data.email || undefined,
          defaultLocationID: data.defaultLocationID ? parseInt(data.defaultLocationID) : undefined,
          roles:            selectedRoles,
          isDeveloper:      data.isDeveloper,
        };
        await createUser(req);
        toast.success('User created successfully');
      } else if (mode === 'edit' && selected) {
        const req: UpdateUserRequest = {
          employeeID:       data.employeeID,
          username:         data.username,
          email:            data.email || undefined,
          defaultLocationID: data.defaultLocationID ? parseInt(data.defaultLocationID) : undefined,
          roles:            selectedRoles,
          isDeveloper:      data.isDeveloper,
        };
        await updateUser(selected.userID, req);
        toast.success('User updated');
      }
      setMode(null);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPw = async (data: ResetPwForm) => {
    if (data.newPassword !== data.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (!selected) return;
    setSubmitting(true);
    try {
      await resetPassword(selected.userID, data.newPassword);
      toast.success('Password reset successfully');
      setMode(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = async (u: UserDto) => {
    try {
      await unlockUser(u.userID);
      toast.success(`${u.username} unlocked`);
      await load();
    } catch {
      toast.error('Failed to unlock user');
    }
  };

  const handleToggleActive = async (u: UserDto) => {
    try {
      if (u.isActive) await deactivateUser(u.userID);
      else await activateUser(u.userID);
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
      await load();
    } catch {
      toast.error('Failed to update user status');
    }
  };

  const handleDelete = async (u: UserDto) => {
    if (!window.confirm(`Are you sure you want to delete user ${u.username}? This action cannot be undone.`)) return;
    try {
      await deleteUser(u.userID);
      toast.success('User deleted');
      await load();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" style={{ color: 'var(--fg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm opacity-60 mt-1">Control system access, roles, and security permissions.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Employee
        </button>
      </div>

      {/* User table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)]">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm opacity-50">Syncing user database…</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border)]">
                  {['Employee', 'Identity', 'Location', 'Access Roles', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest opacity-50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center opacity-40 italic">No user accounts found in the directory.</td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u.userID} className="hover:bg-[var(--bg-hover)] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs opacity-60 bg-[var(--bg-subtle)] inline-block px-2 py-1 rounded-md border border-[var(--border)]">
                        {u.employeeID}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{u.username}</div>
                      {u.email && <div className="text-xs opacity-40 mt-0.5">{u.email}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="opacity-70">{u.defaultLocationName || 'Global Access'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {getActiveRoles(u as any).map(r => (
                          <RoleBadge key={r.key} label={r.label} badgeClass={r.badgeClass} />
                        ))}
                        {getActiveRoles(u as any).length === 0 && (
                          <span className="text-[10px] opacity-20 italic">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase ${
                          u.isActive ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {u.isActive ? 'Online' : 'Disabled'}
                        </span>
                        {u.isLocked && (
                          <span className="text-[10px] text-amber-500 font-bold uppercase flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                            Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-400 font-semibold text-xs">Edit</button>
                        <button onClick={() => openResetPw(u)} className="text-amber-500 hover:text-amber-400 font-semibold text-xs">Password</button>
                        {u.isLocked && (
                          <button onClick={() => handleUnlock(u)} className="text-emerald-500 hover:text-emerald-400 font-semibold text-xs">Unlock</button>
                        )}
                        <button onClick={() => handleToggleActive(u)} className="opacity-40 hover:opacity-100 font-semibold text-xs transition-opacity">
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleDelete(u)} className="text-rose-500 hover:text-rose-400 font-semibold text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 bg-[var(--bg-subtle)] border-t border-[var(--border)]">
              <span className="text-xs opacity-50 font-medium">Showing page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--border)] text-xs font-bold hover:bg-[var(--bg-raised)] disabled:opacity-30">
                  Previous
                </button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-1.5 rounded-lg border border-[var(--border)] text-xs font-bold hover:bg-[var(--bg-raised)] disabled:opacity-30">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals (Using CPS Design System) ── */}
      {(mode === 'create' || mode === 'edit') && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '16px', overflowY: 'auto'
        }}>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
               style={{ maxHeight: 'calc(100vh - 32px)', animation: 'modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-bold uppercase tracking-tight">
                  {mode === 'create' ? 'Onboard Employee' : 'Update Credentials'}
                </h2>
                <p className="text-xs opacity-50 mt-0.5">Configure profile and system access rights.</p>
              </div>
              <button onClick={() => setMode(null)} className="w-8 h-8 rounded-full hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Scrollable body */}
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Required fields — row 1 */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-3">Required</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-50 px-1">
                      Employee ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...userForm.register('employeeID', { required: true })}
                      placeholder="EMP-XXXX"
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none transition-all uppercase font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-50 px-1">
                      Display Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...userForm.register('username', { required: true })}
                      placeholder="Full Name"
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Password fields — create mode only */}
              {mode === 'create' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-50 px-1">
                      Initial Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...userForm.register('password', { required: true, minLength: 8 })}
                      type="password"
                      placeholder="Min 8 characters"
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-50 px-1">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...userForm.register('confirmPassword', { required: true })}
                      type="password"
                      placeholder="Re-enter password"
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Optional fields */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-3">Optional</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-50 px-1">Email Address</label>
                    <input
                      {...userForm.register('email')}
                      type="email"
                      placeholder="corp@bank.com"
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-50 px-1">Duty Location</label>
                    <LocationSelect
                      locations={locations}
                      value={userForm.watch('defaultLocationID')}
                      onChange={val => userForm.setValue('defaultLocationID', val)}
                    />
                  </div>
                </div>
              </div>

              {/* Roles */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Permissions & Clearance</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ROLES.map(role => (
                    <label key={role.key} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:bg-[var(--bg-hover)]
                      ${role.elevated ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[var(--bg-subtle)] border-[var(--border)]'}
                    `}>
                      <input
                        {...userForm.register(role.key as any)}
                        type="checkbox"
                        className="w-4 h-4 rounded border-[var(--border)] bg-transparent checked:bg-blue-500 text-blue-500 focus:ring-0 transition-colors flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold">{role.label}</span>
                          <RoleBadge label={role.label} badgeClass={role.badgeClass} />
                        </div>
                        <p className="text-xs opacity-40 mt-0.5 leading-snug">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-subtle)] flex gap-3 flex-shrink-0">
              <button onClick={() => setMode(null)} className="px-5 py-2.5 rounded-xl font-bold text-sm border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                Cancel
              </button>
              <button onClick={userForm.handleSubmit(handleUserSubmit)} disabled={submitting} className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                {submitting ? 'Processing…' : mode === 'create' ? 'Finalize Onboarding' : 'Commit Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleWarning && (
        <div className="modal-overlay-container" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, 
          padding: 20
        }}>
          <div className="bg-[var(--bg-raised)] border border-amber-500/30 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-amber-500">Elevated Clearance</h3>
              <p className="text-sm opacity-60 leading-relaxed">
                This user has <strong>Admin</strong> or <strong>Developer</strong> status. These accounts bypass individual role checks and maintain full system control regardless of settings.
              </p>
              <div className="pt-4 flex gap-3">
                <button onClick={() => { setShowRoleWarning(false); setPendingRoles(null); }} className="flex-1 py-3 rounded-xl font-bold text-xs border border-[var(--border)] hover:bg-[var(--bg-hover)]">
                  Cancel
                </button>
                <button onClick={async () => { setShowRoleWarning(false); if (pendingRoles) await performUserSubmit(pendingRoles); }} className="flex-1 bg-amber-500 text-black py-3 rounded-xl font-bold text-xs hover:bg-amber-400">
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {mode === 'reset-pw' && selected && (
        <div className="modal-overlay-container" style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, 
          padding: 20 
        }}>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden">
             <div className="p-8 space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-bold">Security Reset</h3>
                  <p className="text-xs opacity-50 mt-1">Updating credentials for <strong>{selected.username}</strong></p>
                </div>
                <div className="space-y-4">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase opacity-50 px-1">New Password</label>
                      <input {...pwForm.register('newPassword', { required: true, minLength: 8 })} type="password" placeholder="••••••••" className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase opacity-50 px-1">Confirm Password</label>
                      <input {...pwForm.register('confirm', { required: true })} type="password" placeholder="••••••••" className="w-full bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" />
                   </div>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => setMode(null)} className="flex-1 py-3 rounded-xl font-bold text-xs border border-[var(--border)] hover:bg-[var(--bg-hover)]">Cancel</button>
                   <button onClick={pwForm.handleSubmit(handleResetPw)} className="flex-1 btn-primary py-3 rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20">Update</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
