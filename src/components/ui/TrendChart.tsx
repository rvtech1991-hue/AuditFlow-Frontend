export type TrendChartPoint = { period: string; created: number; closed: number };

export function TrendChart({ points }: { points?: TrendChartPoint[] }) {
  if (!points || points.length === 0) {
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

  const width = 420;
  const height = 150;
  const padding = 18;
  const maxValue = Math.max(1, ...points.flatMap((p) => [p.created, p.closed]));
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const toY = (value: number) => height - padding - (value / maxValue) * (height - padding * 2);
  const toCoords = (values: number[]) => values.map((value, index) => `${padding + index * stepX},${toY(value)}`).join(" ");
  const createdLine = toCoords(points.map((p) => p.created));
  const closedLine = toCoords(points.map((p) => p.closed));
  const areaPath = `M${padding} ${height - padding} L${createdLine.split(" ").join(" L")} L${padding + (points.length - 1) * stepX} ${height - padding} Z`;

  return (
    <svg width="100%" height="150" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Created vs. closed trend" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#trendFill)" />
      <polyline points={createdLine} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={closedLine} fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" />
    </svg>
  );
}
