'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number; // zero-indexed
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  itemLabel?: string;
}

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  pageSize,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  itemLabel = 'items',
}: PaginationControlsProps) {
  if (totalCount === 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min(totalCount, from + pageSize - 1);

  return (
    <div className="flex items-center justify-between border-t pt-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}–{to}</span> of{' '}
        <span className="font-medium text-foreground">{totalCount}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground px-1">
          Page {page + 1} of {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
