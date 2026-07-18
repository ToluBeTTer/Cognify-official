import { useState, useCallback } from 'react';

export const DEFAULT_PAGE_SIZE = 25;

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Shared pagination state for any Supabase list query.
 *
 * Usage:
 *   const pagination = usePagination();
 *   const { data, count } = await supabase
 *     .from('question_bank')
 *     .select('*', { count: 'exact' })
 *     .range(...pagination.range);
 *   pagination.setTotalCount(count ?? 0);
 */
export function usePagination(pageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0); // zero-indexed
  const [totalCount, setTotalCount] = useState(0);

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const goToPage = useCallback(
    (next: number) => {
      setPage(Math.min(Math.max(next, 0), totalPages - 1));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page]);
  const prevPage = useCallback(() => goToPage(page - 1), [goToPage, page]);

  return {
    page,
    pageSize,
    totalCount,
    setTotalCount,
    range: [from, to] as const,
    totalPages,
    hasNext: page < totalPages - 1,
    hasPrev: page > 0,
    nextPage,
    prevPage,
    goToPage,
    resetPage: () => setPage(0),
  };
}
