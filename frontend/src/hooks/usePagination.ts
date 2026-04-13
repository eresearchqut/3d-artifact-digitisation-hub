import { useState } from 'react';

interface PaginationState {
  cursor: string | undefined;
  hasPrev: boolean;
  limit: number;
  pageNumber: number;
  goNext: (nextCursor: string) => void;
  goPrev: () => void;
  reset: () => void;
  changeLimit: (newLimit: number) => void;
}

export function usePagination(defaultLimit = 10): PaginationState {
  const [limit, setLimit] = useState(defaultLimit);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pageNumber, setPageNumber] = useState(1);

  const goNext = (nextCursor: string) => {
    setCursorStack((prev) => [...prev, cursor ?? '']);
    setCursor(nextCursor);
    setPageNumber((p) => p + 1);
  };

  const goPrev = () => {
    const newStack = [...cursorStack];
    const prevCursor = newStack.pop();
    setCursorStack(newStack);
    setCursor(prevCursor === '' ? undefined : prevCursor);
    setPageNumber((p) => p - 1);
  };

  const reset = () => {
    setCursorStack([]);
    setCursor(undefined);
    setPageNumber(1);
  };

  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    setCursorStack([]);
    setCursor(undefined);
    setPageNumber(1);
  };

  return { limit, cursor, hasPrev: cursorStack.length > 0, pageNumber, goNext, goPrev, reset, changeLimit };
}
