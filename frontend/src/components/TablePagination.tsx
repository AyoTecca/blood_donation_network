const DEFAULT_SIZES = [10, 25, 50, 100] as const;

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeChoices?: readonly number[];
  disabled?: boolean;
};

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeChoices = DEFAULT_SIZES,
  disabled = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <div className="table-pagination">
      <p className="table-pagination__meta">
        Page {safePage} of {totalPages} · {total.toLocaleString()} total
      </p>
      <div className="table-pagination__controls">
        <label>
          Rows per page
          <select
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeChoices.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={disabled || !canPrev} onClick={() => onPageChange(safePage - 1)}>
          Previous
        </button>
        <button type="button" disabled={disabled || !canNext} onClick={() => onPageChange(safePage + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
