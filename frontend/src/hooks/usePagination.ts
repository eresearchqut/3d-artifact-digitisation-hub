import { useState } from 'react';

interface PaginationState {
  cursor: string | undefined;
  hasPrev: boolean;
  limit: number;
  goNext: (nextCursor: string) => void;
  goPrev: () => void;
  reset: () => void;
}

export function usePagination(defaultLimit = 10): PaginationState {
  const [limit] = useState(defaultLimit);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const goNext = (nextCursor: string) => {
    setCursorStack((prev) => [...prev, cursor ?? '']);
    setCursor(nextCursor);
  };

  const goPrev = () => {
    const newStack = [...cursorStack];
    const prevCursor = newStack.pop();
    setCursorStack(newStack);
    setCursor(prevCursor === '' ? undefined : prevCursor);
  };

  const reset = () => {
    setCursorStack([]);
    setCursor(undefined);
  };

  return { limit, cursor, hasPrev: cursorStack.length > 0, goNext, goPrev, reset };
}
