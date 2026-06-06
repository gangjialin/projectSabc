'use client';

export interface RadarAxis {
  label: string;
  /** 得分率 0-1 */
  value: number;
}

interface RadarChartProps {
  axes: RadarAxis[];
  /** 阈值环（如维度否决 0.7），低于此值的轴标红 */
  threshold?: number;
  size?: number;
}

/**
 * 零依赖 SVG 雷达图（5 维度得分率）。低于阈值的维度顶点与标签标红——
 * 不仅靠颜色：标签同时加 "⚠" 与下划提示，满足无障碍（test_plan §10）。
 */
export function RadarChart({ axes, threshold = 0.7, size = 320 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const n = axes.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, r: number): [number, number] => [
    cx + R * r * Math.cos(angle(i)),
    cy + R * r * Math.sin(angle(i)),
  ];

  const valuePoly = axes
    .map((a, i) => point(i, Math.max(0, Math.min(1, a.value))).join(','))
    .join(' ');

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="5 维度得分率雷达图"
    >
      {/* 网格环 */}
      {gridLevels.map((lvl) => (
        <polygon
          key={lvl}
          points={axes.map((_, i) => point(i, lvl).join(',')).join(' ')}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      ))}

      {/* 阈值环（虚线） */}
      <polygon
        points={axes.map((_, i) => point(i, threshold).join(',')).join(' ')}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* 轴线 */}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />
        );
      })}

      {/* 数据多边形 */}
      <polygon
        points={valuePoly}
        fill="rgba(15, 23, 42, 0.12)"
        stroke="#0f172a"
        strokeWidth={2}
      />

      {/* 顶点 + 标签 */}
      {axes.map((a, i) => {
        const below = a.value < threshold;
        const [px, py] = point(i, Math.max(0, Math.min(1, a.value)));
        const [lx, ly] = point(i, 1.18);
        return (
          <g key={i}>
            <circle cx={px} cy={py} r={3.5} fill={below ? '#dc2626' : '#0f172a'} />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fill={below ? '#dc2626' : '#334155'}
              fontWeight={below ? 700 : 400}
            >
              {below ? '⚠ ' : ''}
              {a.label}
            </text>
            <text
              x={lx}
              y={ly + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill={below ? '#dc2626' : '#64748b'}
            >
              {(a.value * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
