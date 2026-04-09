import { PaginatedResponse, Asset, AssetAccess, Share, ShareAccess, Team, User } from './types';
import { fetchAuthSession } from 'aws-amplify/auth';

// BASE_URL is set at startup by App.tsx once runtime-config.json is resolved.
// Falls back to the Vite env var (local dev) if setBaseUrl is never called.
let BASE_URL: string = (import.meta.env.VITE_MANAGEMENT_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export function setBaseUrl(url: string): void {
  BASE_URL = url.replace(/\/$/, '');
}

export function getBaseUrl(): string {
  return BASE_URL;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Not signed in or session expired — let the request proceed without a token
  }
  return {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeader = await getAuthHeader();
  const response: Response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error: any = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'API request failed');
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const userService = {
  findAll: (limit: number = 10, cursor?: string): Promise<PaginatedResponse<User>> =>
    request<PaginatedResponse<User>>(`/user?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  findOne: (id: string): Promise<User> => request<User>(`/user/${id}`),
  create: (data: Partial<User>): Promise<User> =>
    request<User>('/user', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<User>): Promise<User> =>
    request<User>(`/user/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string): Promise<void> => request<void>(`/user/${id}`, { method: 'DELETE' }),
};

export const teamService = {
  findAll: (limit: number = 10, cursor?: string): Promise<PaginatedResponse<Team>> =>
    request<PaginatedResponse<Team>>(`/team?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  findOne: (id: string): Promise<Team> => request<Team>(`/team/${id}`),
  create: (data: Partial<Team>): Promise<Team> =>
    request<Team>('/team', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Team>): Promise<Team> =>
    request<Team>(`/team/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string): Promise<void> => request<void>(`/team/${id}`, { method: 'DELETE' }),
  listUsers: (id: string, limit: number = 10, cursor?: string): Promise<PaginatedResponse<User>> =>
    request<PaginatedResponse<User>>(`/team/${id}/user?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  addUser: (id: string, userId: string): Promise<void> =>
    request<void>(`/team/${id}/user/${userId}`, { method: 'POST' }),
  removeUser: (id: string, userId: string): Promise<void> =>
    request<void>(`/team/${id}/user/${userId}`, { method: 'DELETE' }),
};

export const assetService = {
  findAll: (limit: number = 10, cursor?: string): Promise<PaginatedResponse<Asset>> =>
    request<PaginatedResponse<Asset>>(`/asset?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  findOne: (id: string): Promise<Asset> => request<Asset>(`/asset/${id}`),
  update: (id: string, data: Partial<Asset>): Promise<Asset> =>
    request<Asset>(`/asset/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string): Promise<void> => request<void>(`/asset/${id}`, { method: 'DELETE' }),
  generateUploadUrl: (metadata?: Record<string, string>): Promise<{ uploadUrl: string, id: string }> =>
    request<{ uploadUrl: string, id: string }>(`/asset/upload`, { method: 'POST', body: JSON.stringify({ metadata }) }),
  // ─── Asset ownership ───────────────────────────────────────────────────
  listUserAccess: (id: string, limit = 100, cursor?: string): Promise<PaginatedResponse<AssetAccess>> =>
    request<PaginatedResponse<AssetAccess>>(`/asset/${id}/user?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  addUserAccess: (id: string, email: string): Promise<void> =>
    request<void>(`/asset/${id}/user/${encodeURIComponent(email)}`, { method: 'POST' }),
  removeUserAccess: (id: string, email: string): Promise<void> =>
    request<void>(`/asset/${id}/user/${encodeURIComponent(email)}`, { method: 'DELETE' }),
  listTeamAccess: (id: string, limit = 100, cursor?: string): Promise<PaginatedResponse<AssetAccess>> =>
    request<PaginatedResponse<AssetAccess>>(`/asset/${id}/team?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  addTeamAccess: (id: string, teamName: string): Promise<void> =>
    request<void>(`/asset/${id}/team/${encodeURIComponent(teamName)}`, { method: 'POST' }),
  removeTeamAccess: (id: string, teamName: string): Promise<void> =>
    request<void>(`/asset/${id}/team/${encodeURIComponent(teamName)}`, { method: 'DELETE' }),
};

export const shareService = {
  findAll: (assetId: string, limit = 100, cursor?: string): Promise<PaginatedResponse<Share>> =>
    request<PaginatedResponse<Share>>(`/asset/${assetId}/share?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  create: (assetId: string, data: { duration?: string; expiresAt?: string }): Promise<Share> =>
    request<Share>(`/asset/${assetId}/share`, { method: 'POST', body: JSON.stringify(data) }),
  remove: (assetId: string, shareId: string): Promise<void> =>
    request<void>(`/asset/${assetId}/share/${shareId}`, { method: 'DELETE' }),
  // ─── Share access ──────────────────────────────────────────────────────
  listUserAccess: (assetId: string, shareId: string, limit = 100, cursor?: string): Promise<PaginatedResponse<ShareAccess>> =>
    request<PaginatedResponse<ShareAccess>>(`/asset/${assetId}/share/${shareId}/user?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  addUserAccess: (assetId: string, shareId: string, email: string): Promise<void> =>
    request<void>(`/asset/${assetId}/share/${shareId}/user/${encodeURIComponent(email)}`, { method: 'POST' }),
  removeUserAccess: (assetId: string, shareId: string, email: string): Promise<void> =>
    request<void>(`/asset/${assetId}/share/${shareId}/user/${encodeURIComponent(email)}`, { method: 'DELETE' }),
  listTeamAccess: (assetId: string, shareId: string, limit = 100, cursor?: string): Promise<PaginatedResponse<ShareAccess>> =>
    request<PaginatedResponse<ShareAccess>>(`/asset/${assetId}/share/${shareId}/team?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  addTeamAccess: (assetId: string, shareId: string, teamName: string): Promise<void> =>
    request<void>(`/asset/${assetId}/share/${shareId}/team/${encodeURIComponent(teamName)}`, { method: 'POST' }),
  removeTeamAccess: (assetId: string, shareId: string, teamName: string): Promise<void> =>
    request<void>(`/asset/${assetId}/share/${shareId}/team/${encodeURIComponent(teamName)}`, { method: 'DELETE' }),
};
