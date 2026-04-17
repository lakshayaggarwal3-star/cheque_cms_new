// =============================================================================
// File        : UserManagementPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Admin
// Description : User management — create, edit, reset password, lock/unlock, activate/deactivate.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import {
  getUsers, createUser, updateUser, resetPassword, unlockUser, activateUser, deactivateUser,
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
  username: string;
  email: string;
  defaultLocationID: string;
  roleScanner: boolean;
  roleMobileScanner: boolean;
  roleMaker: boolean;
  roleChecker: boolean;
  roleAdmin: boolean;
  isDeveloper: boolean;
}

interface ResetPwForm {
  newPassword: string;
  confirm: string;
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ roleKey, label, badgeClass }: { roleKey: string; label: string; badgeClass: string }) {
  return (
    <span key={roleKey} className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
      {label}
    </span>
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
    userForm.reset({
      employeeID: '', password: '', username: '', email: '',
      defaultLocationID: '',
      roleScanner: false, roleMobileScanner: false, roleMaker: false, roleChecker: false, roleAdmin: false, isDeveloper: false,
    });
  };

  const openEdit = (u: UserDto) => {
    setSelected(u);
    setMode('edit');
    userForm.reset({
      employeeID: u.employeeID,
      password: '',
      username: u.username,
      email: u.email ?? '',
      defaultLocationID: u.defaultLocationID?.toString() ?? '',
      roleScanner: u.roleScanner,
      roleMobileScanner: u.roleMobileScanner,
      roleMaker:   u.roleMaker,
      roleChecker: u.roleChecker,
      roleAdmin:   u.roleAdmin,
      isDeveloper: u.isDeveloper,
    });
  };

  const openResetPw = (u: UserDto) => {
    setSelected(u);
    setMode('reset-pw');
    pwForm.reset({ newPassword: '', confirm: '' });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleUserSubmit = async (data: UserFormFields) => {
    console.log('Form submitted with roles:', {
      roleAdmin: data.roleAdmin,
      isDeveloper: data.isDeveloper,
      roleScanner: data.roleScanner,
      roleMobileScanner: data.roleMobileScanner,
      roleMaker: data.roleMaker,
      roleChecker: data.roleChecker,
    });

    // Auto-select Scanner role if no roles are selected
    if (!data.roleScanner && !data.roleMobileScanner && !data.roleMaker && !data.roleChecker && !data.roleAdmin && !data.isDeveloper) {
      data.roleScanner = true;
      console.log('Auto-selected Scanner role - no roles were selected');
    }

    // Check if Admin/Developer is trying to uncheck roles
    const isAdminOrDev = data.roleAdmin || data.isDeveloper;
    const hasUncheckedRoles = !data.roleScanner || !data.roleMobileScanner || !data.roleMaker || !data.roleChecker;
    
    if (isAdminOrDev && hasUncheckedRoles && mode === 'edit') {
      console.log('Showing warning modal - Admin/Dev with unchecked roles');
      // Show warning before proceeding
      setPendingRoles(data);
      setShowRoleWarning(true);
      return;
    }

    console.log('Proceeding with submit...');
    await performUserSubmit(data);
  };

  const performUserSubmit = async (data: UserFormFields) => {
    console.log('performUserSubmit called with:', data);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const req: CreateUserRequest = {
          employeeID:       data.employeeID,
          username:         data.username,
          password:         data.password,
          email:            data.email || undefined,
          defaultLocationID: data.defaultLocationID ? parseInt(data.defaultLocationID) : undefined,
          roleScanner: data.roleScanner,
          roleMobileScanner: data.roleMobileScanner,
          roleMaker:   data.roleMaker,
          roleChecker: data.roleChecker,
          roleAdmin:   data.roleAdmin,
          isDeveloper: data.isDeveloper,
        };
        await createUser(req);
        toast.success('User created successfully');
      } else if (mode === 'edit' && selected) {
        const req: UpdateUserRequest = {
          username:         data.username,
          email:            data.email || undefined,
          defaultLocationID: data.defaultLocationID ? parseInt(data.defaultLocationID) : undefined,
          roleScanner: data.roleScanner,
          roleMobileScanner: data.roleMobileScanner,
          roleMaker:   data.roleMaker,
          roleChecker: data.roleChecker,
          roleAdmin:   data.roleAdmin,
          isDeveloper: data.isDeveloper,
        };
        const result = await updateUser(selected.userID, req);
        console.log('User updated successfully:', result);
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage system users and their roles.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-blue-700 text-white text-sm font-medium
            px-4 py-2 rounded-lg hover:bg-blue-800"
        >
          + New User
        </button>
      </div>

      {/* User table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading users…</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee ID', 'Username / Email', 'Location', 'Roles', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No users found.</td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u.userID} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{u.employeeID}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{u.username}</div>
                      {u.email && <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.defaultLocationName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {getActiveRoles(u as unknown as Record<string, unknown>).map(r => (
                          <RoleBadge key={r.key} roleKey={r.key} label={r.label} badgeClass={r.badgeClass} />
                        ))}
                        {getActiveRoles(u as unknown as Record<string, unknown>).length === 0 && (
                          <span className="text-xs text-gray-300 italic">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                          u.isActive ? 'text-green-700' : 'text-gray-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {u.isLocked && (
                          <span className="text-xs text-red-600 font-medium">Locked</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => openEdit(u)}
                          className="text-xs font-medium text-blue-700 hover:text-blue-900">
                          Edit
                        </button>
                        <button type="button" onClick={() => openResetPw(u)}
                          className="text-xs font-medium text-amber-600 hover:text-amber-800">
                          Reset PW
                        </button>
                        {u.isLocked && (
                          <button type="button" onClick={() => handleUnlock(u)}
                            className="text-xs font-medium text-green-700 hover:text-green-900">
                            Unlock
                          </button>
                        )}
                        <button type="button" onClick={() => handleToggleActive(u)}
                          className="text-xs font-medium text-gray-400 hover:text-gray-600">
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {users.map(u => (
              <div key={u.userID} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{u.username}</div>
                    <div className="text-xs text-gray-400 font-mono">{u.employeeID}</div>
                    {u.email && <div className="text-xs text-gray-400">{u.email}</div>}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      u.isActive ? 'text-green-700' : 'text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {u.isLocked && <div className="text-xs text-red-600 font-medium mt-0.5">Locked</div>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {getActiveRoles(u as unknown as Record<string, unknown>).map(r => (
                    <RoleBadge key={r.key} roleKey={r.key} label={r.label} badgeClass={r.badgeClass} />
                  ))}
                </div>
                <div className="flex gap-4 pt-1">
                  <button type="button" onClick={() => openEdit(u)}
                    className="text-xs font-medium text-blue-700">Edit</button>
                  <button type="button" onClick={() => openResetPw(u)}
                    className="text-xs font-medium text-amber-600">Reset PW</button>
                  {u.isLocked && (
                    <button type="button" onClick={() => handleUnlock(u)}
                      className="text-xs font-medium text-green-700">Unlock</button>
                  )}
                  <button type="button" onClick={() => handleToggleActive(u)}
                    className="text-xs font-medium text-gray-400">
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 px-4 py-3 border-t border-gray-100">
              <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600
                  hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Role Warning Modal (z-60 to appear above edit modal z-50) ── */}
      {showRoleWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-amber-200 bg-amber-50 flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="flex-1">
                <h2 className="text-base font-bold text-amber-900">Full Access Role Detected</h2>
                <p className="text-xs text-amber-700 mt-1">
                  {pendingRoles?.roleAdmin && pendingRoles?.isDeveloper
                    ? 'This user has both Admin and Developer roles.'
                    : pendingRoles?.roleAdmin
                    ? 'This user has the Admin role.'
                    : 'This user has the Developer role.'}
                </p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">⚠️ Role Configuration Notice:</p>
                <ul className="text-xs text-blue-800 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>This user has <strong>Admin</strong> or <strong>Developer</strong> role enabled.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>Unchecking individual roles (Scanner, Maker, etc.) will be <strong>saved to the database</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>However, Admin/Developer users <strong>still have access to all features</strong> regardless of individual role settings.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>The individual role flags are stored but don't restrict Admin/Developer access.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-700">
                  <strong>What will happen:</strong> The unchecked roles will be saved to the database as <code>false</code>, but this user will still have full system access because of their Admin/Developer role. The role flags are mainly used for display purposes and access control for non-admin users.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRoleWarning(false);
                  setPendingRoles(null);
                }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm
                  font-medium hover:bg-gray-50"
              >
                Cancel & Revert
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowRoleWarning(false);
                  if (pendingRoles) {
                    await performUserSubmit(pendingRoles);
                    setPendingRoles(null);
                  }
                }}
                className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium
                  hover:bg-amber-700 inline-flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ──────────────────────────────────────────── */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {mode === 'create' ? 'New User' : `Edit User — ${selected?.username}`}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mode === 'create' ? 'Fill in the details to create a new user account.' : 'Update user details and role assignments.'}
                </p>
              </div>
              <button type="button" onClick={() => setMode(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400
                  hover:text-gray-700 hover:bg-gray-100 text-lg leading-none">
                ×
              </button>
            </div>

            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="px-6 py-5 space-y-5">

              {/* Create-only fields */}
              {mode === 'create' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Employee ID" required error={userForm.formState.errors.employeeID?.message}>
                    <input
                      {...userForm.register('employeeID', { required: 'Required' })}
                      placeholder="e.g. EMP001"
                      className={inputCls(!!userForm.formState.errors.employeeID) + ' uppercase'}
                    />
                  </FormField>
                  <FormField label="Initial Password" required error={userForm.formState.errors.password?.message}>
                    <input
                      {...userForm.register('password', {
                        required: 'Required',
                        minLength: { value: 8, message: 'Min 8 characters' },
                      })}
                      type="password"
                      placeholder="Min 8 characters"
                      className={inputCls(!!userForm.formState.errors.password)}
                    />
                  </FormField>
                </div>
              )}

              {/* Common fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Username" required error={userForm.formState.errors.username?.message}>
                  <input
                    {...userForm.register('username', { required: 'Required' })}
                    placeholder="Display name"
                    className={inputCls(!!userForm.formState.errors.username)}
                  />
                </FormField>
                <FormField label="Email">
                  <input
                    {...userForm.register('email')}
                    type="email"
                    placeholder="Optional"
                    className={inputCls(false)}
                  />
                </FormField>
              </div>

              <FormField label="Default Location">
                <select
                  {...userForm.register('defaultLocationID')}
                  className={inputCls(false)}
                >
                  <option value="">— None —</option>
                  {locations.filter(l => l.isActive).map(l => (
                    <option key={l.locationID} value={l.locationID}>{l.locationName}</option>
                  ))}
                </select>
              </FormField>

              {/* Roles */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Role Assignment</p>
                <div className="grid grid-cols-1 gap-2">
                  {ROLES.map(role => (
                    <label
                      key={role.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                        hover:bg-gray-50 ${role.elevated ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'}`}
                    >
                      <input
                        {...userForm.register(role.key as keyof UserFormFields)}
                        type="checkbox"
                        className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{role.label}</span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${role.badgeClass}`}>
                            {role.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setMode(null)}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm
                    hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium
                    hover:bg-blue-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : mode === 'create' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password modal ─────────────────────────────────────────── */}
      {mode === 'reset-pw' && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Reset Password</h2>
                <p className="text-xs text-gray-500 mt-0.5">Setting new password for <strong>{selected.username}</strong></p>
              </div>
              <button type="button" onClick={() => setMode(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400
                  hover:text-gray-700 hover:bg-gray-100 text-lg leading-none">
                ×
              </button>
            </div>
            <form onSubmit={pwForm.handleSubmit(handleResetPw)} className="px-6 py-5 space-y-4">
              <FormField label="New Password" required error={pwForm.formState.errors.newPassword?.message}>
                <input
                  {...pwForm.register('newPassword', {
                    required: 'Required',
                    minLength: { value: 8, message: 'Min 8 characters' },
                  })}
                  type="password"
                  placeholder="Min 8 characters"
                  className={inputCls(!!pwForm.formState.errors.newPassword)}
                />
              </FormField>
              <FormField label="Confirm Password" required error={pwForm.formState.errors.confirm?.message}>
                <input
                  {...pwForm.register('confirm', { required: 'Required' })}
                  type="password"
                  placeholder="Repeat new password"
                  className={inputCls(!!pwForm.formState.errors.confirm)}
                />
              </FormField>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setMode(null)}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm
                    hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg text-sm font-medium
                    hover:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Resetting…
                    </>
                  ) : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
    focus:ring-blue-500 focus:border-transparent transition-colors
    ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`;
}

function FormField({
  label, required, error, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
