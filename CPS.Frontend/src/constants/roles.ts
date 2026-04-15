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
  /** The boolean field name on UserDto / form fields */
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
    key: 'roleScanner',
    label: 'Scanner',
    description: 'Create batches, operate scanner, capture cheques and slips.',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'roleMobileScanner',
    label: 'Mobile Scanner',
    description: 'Create batches and scan/capture using mobile scanner flow.',
    badgeClass: 'bg-cyan-100 text-cyan-700',
  },
  {
    key: 'roleMaker',
    label: 'Maker',
    description: 'Enter cheque and slip data (Phase 2).',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  {
    key: 'roleChecker',
    label: 'Checker',
    description: 'Blind re-verification of Maker entries, SoD enforced (Phase 2).',
    badgeClass: 'bg-teal-100 text-teal-700',
  },
  {
    key: 'roleAdmin',
    label: 'Admin',
    description: 'Full access — user management, master upload, app settings.',
    badgeClass: 'bg-red-100 text-red-700',
    elevated: true,
  },
  {
    key: 'isDeveloper',
    label: 'Developer',
    description: 'Admin + mock scan, force status, skip validation.',
    badgeClass: 'bg-orange-100 text-orange-700',
    elevated: true,
  },
];

/** Look up a role definition by its key. Returns undefined if not found. */
export function getRoleByKey(key: string): RoleDefinition | undefined {
  return ROLES.find(r => r.key === key);
}

/**
 * Given a user object (any shape that has the role boolean flags),
 * return the subset of ROLES that are active for that user.
 */
export function getActiveRoles(user: Record<string, unknown>): RoleDefinition[] {
  return ROLES.filter(r => Boolean(user[r.key]));
}
