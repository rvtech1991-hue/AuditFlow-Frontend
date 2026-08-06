type PaginationProps = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
};

/** Windows down to first/last plus a run around the current page once there are enough pages
 * to need it, instead of listing every page number (which stops being usable well before a
 * grid reaches double-digit pages). */
function getPageNumbers(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages: Array<number | "ellipsis"> = [1];
  if (page > 3) pages.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let p = start; p <= end; p++) pages.push(p);

  if (page < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="pagination-step" onClick={() => onChange(1)} disabled={page === 1} aria-label="First page">
        <i className="ti ti-chevrons-left" />
      </button>
      <button type="button" className="pagination-step" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">
        <i className="ti ti-chevron-left" />
      </button>
      {pageNumbers.map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">…</span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`pagination-page ${entry === page ? "active" : ""}`}
            onClick={() => onChange(entry)}
            aria-current={entry === page ? "page" : undefined}
          >
            {entry}
          </button>
        ),
      )}
      <button type="button" className="pagination-step" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Next page">
        <i className="ti ti-chevron-right" />
      </button>
      <button type="button" className="pagination-step" onClick={() => onChange(totalPages)} disabled={page === totalPages} aria-label="Last page">
        <i className="ti ti-chevrons-right" />
      </button>
    </nav>
  );
}
