import { Organisation, PaginatedResponse, Site, Team, User } from './types';

const BASE_URL: string = import.meta.env.VITE_MANAGEMENT_API_URL || 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response: Response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

export const organisationService = {
  findAll: (limit: number = 10, cursor?: string): Promise<PaginatedResponse<Organisation>> =>
    request<PaginatedResponse<Organisation>>(`/organisation?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  findOne: (id: string): Promise<Organisation> => request<Organisation>(`/organisation/${id}`),
  create: (data: Partial<Organisation>): Promise<Organisation> =>
    request<Organisation>('/organisation', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Organisation>): Promise<Organisation> =>
    request<Organisation>(`/organisation/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string): Promise<void> => request<void>(`/organisation/${id}`, { method: 'DELETE' }),
  listUsers: (id: string, limit: number = 10, cursor?: string): Promise<PaginatedResponse<User>> =>
    request<PaginatedResponse<User>>(`/organisation/${id}/user?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  addUser: (id: string, userId: string): Promise<void> =>
    request<void>(`/organisation/${id}/user/${userId}`, { method: 'POST' }),
  removeUser: (id: string, userId: string): Promise<void> =>
    request<void>(`/organisation/${id}/user/${userId}`, { method: 'DELETE' }),
  listTeams: (id: string, limit: number = 10, cursor?: string): Promise<PaginatedResponse<Team>> =>
    request<PaginatedResponse<Team>>(`/organisation/${id}/team?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  addTeam: (id: string, teamId: string): Promise<void> =>
    request<void>(`/organisation/${id}/team/${teamId}`, { method: 'POST' }),
  removeTeam: (id: string, teamId: string): Promise<void> =>
    request<void>(`/organisation/${id}/team/${teamId}`, { method: 'DELETE' }),
};

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

export const siteService = {
  findAll: (limit: number = 10, cursor?: string): Promise<PaginatedResponse<Site>> =>
    request<PaginatedResponse<Site>>(`/site?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  findOne: (id: string): Promise<Site> => request<Site>(`/site/${id}`),
  create: (data: Partial<Site>): Promise<Site> =>
    request<Site>('/site', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Site>): Promise<Site> =>
    request<Site>(`/site/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string): Promise<void> => request<void>(`/site/${id}`, { method: 'DELETE' }),
  generateUploadUrl: (id: string, extension: string): Promise<{ uploadUrl: string }> => request<{ uploadUrl: string }>(`/site/${id}/upload?extension=${extension}`),
};
