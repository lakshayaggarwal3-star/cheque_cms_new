// =============================================================================
// File        : roles.ts
// Project     : CPS — Cheque Processing System
// Module      : Shared Constants
// Description : Central role definitions — labels, colors, descriptions, and field keys.
// Created     : 2026-04-14
// =============================================================================

/**
 * Every role in the system is described here.
 * Add new roles to this table; all UI that renders roles (badges, checkboxes, filters)
 * picks them up automatically by iterating ROLES.
 */
export interface RoleDefinition {
  /** The string value stored in the roles array on the backend */
  key: string;
  /** Short display label */
  label: string;
  /** One-line description shown in forms */
  description: string;
  /** Tailwind background + text color classes for the badge */
  badgeClass: string;
  /** Whether this is a special/elevated role (used for visual distinction) */
  elevated?: boolean;
}

export const ROLES: RoleDefinition[] = [
  {
    key: 'Scanner',
    label: 'Scanner',
    description: 'Create batches, operate scanner, capture cheques and slips.',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'Mobile Scanner',
    label: 'Mobile Scanner',
    description: 'Create batches and scan/capture using mobile scanner flow.',
    badgeClass: 'bg-cyan-100 text-cyan-700',
  },
  {
    key: 'Maker',
    label: 'Maker',
    description: 'Enter cheque and slip data (Phase 2).',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  {
    key: 'Checker',
    label: 'Checker',
    description: 'Blind re-verification of Maker entries, SoD enforced (Phase 2).',
    badgeClass: 'bg-teal-100 text-teal-700',
  },
  {
    key: 'Admin',
    label: 'Admin',
    description: 'Full access — user management, master upload, app settings.',
    badgeClass: 'bg-red-100 text-red-700',
    elevated: true,
  },
  {
    key: 'Image Viewer',
    label: 'Image Viewer',
    description: 'Restricted role for viewing and reviewing cheque images only.',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    key: 'Developer',
    label: 'Developer',
    description: 'Super-user with full system access and developer tools.',
    badgeClass: 'bg-indigo-600 text-white',
    elevated: true,
  },
];

/** Look up a role definition by its key. Returns undefined if not found. */
export function getRoleByKey(key: string): RoleDefinition | undefined {
  return ROLES.find(r => r.key === key);
}

/**
 * Returns the subset of ROLES that are present in the user's roles array.
 */
export function getActiveRoles(user: { roles: string[] }): RoleDefinition[] {
  if (!user.roles) return [];
  return ROLES.filter(r => user.roles.includes(r.key));
}
