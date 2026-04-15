import { useState } from 'react';

interface ClientPaginationResult<T> {
  page: T[];
  pageNumber: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasMore: boolean;
  goNext: () => void;
  goPrev: () => void;
  changePageSize: (size: number) => void;
  reset: () => void;
}

export function useClientPagination<T>(
  data: T[] | undefined,
  defaultPageSize = 10,
): ClientPaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const page = data?.slice(start, start + pageSize) ?? [];

  const goNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const goPrev = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const changePageSize = (size: number) => { setPageSize(size); setCurrentPage(1); };
  const reset = () => setCurrentPage(1);

  return {
    page,
    pageNumber: safePage,
    pageSize,
    total,
    totalPages,
    hasPrev: safePage > 1,
    hasMore: safePage < totalPages,
    goNext,
    goPrev,
    changePageSize,
    reset,
  };
}
