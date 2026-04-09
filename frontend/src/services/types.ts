export interface Pagination {
  limit: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface Team {
  name: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
}

export interface Asset {
  id: string;
  key: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface AssetAccess {
  id: string;
  type: 'user' | 'team';
  grantedAt?: string;
}

export interface Share {
  id: string;
  assetId: string;
  createdAt: string;
  createdBy?: string;
  duration?: string;
  expiresAt?: string;
}

export interface ShareAccess {
  id: string;
  type: 'user' | 'team';
  grantedAt?: string;
}
