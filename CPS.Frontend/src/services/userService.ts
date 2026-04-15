// =============================================================================
// File        : userService.ts
// Project     : CPS — Cheque Processing System
// Module      : User Management
// Description : API calls for user CRUD, role updates, lock/unlock, and password reset.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { UserDto, PagedResult } from '../types';

export async function getUsers(page = 1, pageSize = 20): Promise<PagedResult<UserDto>> {
  const res = await apiClient.get('/users', { params: { page, pageSize } });
  const data = extractData<unknown>(res);

  // API currently returns a plain list; normalize to paged result expected by UI.
  if (Array.isArray(data)) {
    const totalCount = data.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = (page - 1) * pageSize;
    const items = data.slice(start, start + pageSize) as UserDto[];
    return { items, totalCount, totalPages, page, pageSize };
  }

  return data as PagedResult<UserDto>;
}

export async function getUser(id: number): Promise<UserDto> {
  const res = await apiClient.get(`/users/${id}`);
  return extractData<UserDto>(res);
}

export interface CreateUserRequest {
  employeeID: string;
  username: string;
  password: string;
  email?: string;
  defaultLocationID?: number;
  roleScanner: boolean;
  roleMobileScanner: boolean;
  roleMaker: boolean;
  roleChecker: boolean;
  roleAdmin: boolean;
  isDeveloper: boolean;
}

export interface UpdateUserRequest {
  username: string;
  email?: string;
  defaultLocationID?: number;
  roleScanner: boolean;
  roleMobileScanner: boolean;
  roleMaker: boolean;
  roleChecker: boolean;
  roleAdmin: boolean;
  isDeveloper: boolean;
}

export async function createUser(data: CreateUserRequest): Promise<UserDto> {
  const res = await apiClient.post('/users', data);
  return extractData<UserDto>(res);
}

export async function updateUser(id: number, data: UpdateUserRequest): Promise<UserDto> {
  const res = await apiClient.put(`/users/${id}`, data);
  return extractData<UserDto>(res);
}

export async function resetPassword(id: number, newPassword: string): Promise<void> {
  await apiClient.put(`/users/${id}/reset-password`, { newPassword });
}

export async function unlockUser(id: number): Promise<void> {
  await apiClient.put(`/users/${id}/unlock`);
}

export async function deactivateUser(id: number): Promise<void> {
  await apiClient.put(`/users/${id}/status`, null, { params: { isActive: false } });
}

export async function activateUser(id: number): Promise<void> {
  await apiClient.put(`/users/${id}/status`, null, { params: { isActive: true } });
}
