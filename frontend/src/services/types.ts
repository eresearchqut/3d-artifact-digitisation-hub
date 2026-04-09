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
}
