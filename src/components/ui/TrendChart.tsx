export function TrendChart() {
  return (
    <svg width="100%" height="150" viewBox="0 0 420 150" role="img" aria-label="Trend line chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M18 122 L72 98 L126 105 L180 70 L234 78 L288 44 L342 54 L402 24 L402 136 L18 136 Z" fill="url(#trendFill)" />
      <polyline points="18,122 72,98 126,105 180,70 234,78 288,44 342,54 402,24" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="18,132 72,116 126,118 180,104 234,92 288,84 342,72 402,61" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" />
    </svg>
  );
}
