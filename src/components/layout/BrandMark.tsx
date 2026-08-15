// TaskFlow's mark: a task node (the dot) flowing into a checkmark-shaped stroke — a task in
// motion, arriving at done. Same glyph as public/favicon.svg; kept in sync by hand since the
// favicon has to be a standalone file (browsers load it outside any React/CSS context) while this
// version renders inside .brand-mark's gradient tile, sized by its parent.
export function BrandMark() {
  return (
    <svg viewBox="0 0 100 100" width="60%" height="60%" aria-hidden="true">
      <circle cx="24" cy="54" r="8" fill="#F5FAF7" />
      <path d="M26 58 L42 74 C 54 68 62 52 82 24" fill="none" stroke="#F5FAF7" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
