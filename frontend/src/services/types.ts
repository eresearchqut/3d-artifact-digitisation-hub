export interface Team {
  name: string;
  description?: string;
}

export interface User {
  id: string;
  sub?: string;
  email: string;
  isAdmin?: boolean;
}

export enum AssetStatus {
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  VIEWER_BUILDING = 'VIEWER_BUILDING',
  VIEWER_CONSTRUCTED = 'VIEWER_CONSTRUCTED',
}

export interface Asset {
  id: string;
  key: string;
  status?: AssetStatus;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface AssetAccess {
  id: string;
  type: 'user' | 'team';
  grantedAt?: string;
  grantedBy?: string;
}

export interface Share {
  id: string;
  assetId: string;
  createdAt: string;
  createdBy?: string;
  durationValue?: number;
  durationUnit?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  expiresAt?: string;
  isPublic?: boolean;
}

export interface ShareAccess {
  id: string;
  type: 'user' | 'team';
  grantedAt?: string;
  grantedBy?: string;
}
