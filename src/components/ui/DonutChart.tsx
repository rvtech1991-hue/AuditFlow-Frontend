type Segment = {
  value: number;
  color: string;
};

export function DonutChart({ segments, size = 116 }: { segments: Segment[]; size?: number }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 25;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Status donut chart">
      <circle cx="60" cy="60" r="42" fill="none" stroke="var(--border)" strokeWidth="16" />
      {segments.map((segment, index) => {
        const dash = total ? (segment.value / total) * 264 : 0;
        const circle = (
          <circle
            key={`${segment.color}-${index}`}
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke={segment.color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${264 - dash}`}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
        );
        offset -= dash;
        return circle;
      })}
      <text x="60" y="58" textAnchor="middle" fill="var(--text)" fontSize="18" fontWeight="800">{total}</text>
      <text x="60" y="75" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="700">tasks</text>
    </svg>
  );
}
