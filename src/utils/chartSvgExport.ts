import type { ChartDataSeries, ChartState } from './ChartUtils';
import { createInitialChartState, lerpColor } from './ChartUtils';

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ChartSvgSource = {
  x: number;
  y: number;
  chartWidth?: number;
  chartHeight?: number;
  chartScaleX?: number;
  chartScaleY?: number;
  color?: string;
  thickness?: number;
  text?: string;
  chartState?: ChartState;
};

/**
 * Renders the same plot as {@link ChartElement}: grid, axes labels, dim + highlighted series, legend arrows.
 * Uses world coordinates (el.x, el.y) for placement; inner drawing is 0..width × 0..height.
 */
export function renderChartElementSvg(
  el: ChartSvgSource,
  visibleRuns: number = 25
): string {
  const w = el.chartWidth ?? 200;
  const h = el.chartHeight ?? 150;
  const strokeColor = el.color || '#000000';
  const thickness = el.thickness ?? 2;
  const wx = el.x;
  const wy = el.y;

  const chartState =
    el.chartState ??
    createInitialChartState(el.chartScaleX ?? 0, el.chartScaleY ?? 0);

  const { scaleX, scaleY, negScaleY, dataSeries, runs, highLighted } =
    chartState;
  const yRatio = scaleY / (scaleY - negScaleY);

  const yGridLines: { y: number; label: string }[] = [];
  const yStep = yRatio * 0.25;
  let yPos = yStep;
  while (yPos < 1) {
    const value = scaleY * (1 - yPos / yRatio);
    yGridLines.push({
      y: yPos * h,
      label:
        Math.round(value * 4) / 4 === Math.round(value)
          ? Math.round(value).toString()
          : value.toFixed(1),
    });
    yPos += yStep;
  }

  const xGridLines: { x: number }[] = [];
  let interval = 10;
  while (interval * (w / scaleX) < 10) {
    interval *= 10;
  }
  let xVal = interval;
  while (xVal < scaleX) {
    xGridLines.push({ x: xVal * (w / scaleX) });
    xVal += interval;
  }

  const displayLimit =
    chartState.defaultScaleX > 0 ? chartState.defaultScaleX : w;

  const parts: string[] = [];

  parts.push(
    `<svg x="${wx}" y="${wy}" width="${w}" height="${h}" overflow="visible">`
  );
  parts.push(
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" stroke="${escapeSvgText(strokeColor)}" stroke-width="${thickness}"/>`
  );

  for (let gi = 0; gi < yGridLines.length; gi++) {
    const line = yGridLines[gi];
    parts.push(
      `<g><line x1="2" y1="${line.y}" x2="${w - 3}" y2="${line.y}" stroke="#CCCCCC" stroke-width="1"/>`
    );
    parts.push(
      `<text x="5" y="${line.y + 12}" font-size="10" fill="#AAAAAA">${escapeSvgText(line.label)}</text></g>`
    );
  }

  for (const line of xGridLines) {
    parts.push(
      `<line x1="${line.x}" y1="2" x2="${line.x}" y2="${h - 3}" stroke="#CCCCCC" stroke-width="1"/>`
    );
  }

  parts.push(
    `<text x="5" y="12" font-size="10" fill="#AAAAAA">${escapeSvgText(String(scaleY))}</text>`
  );

  if (negScaleY < 0) {
    parts.push(
      `<text x="5" y="${yRatio * h + 12}" font-size="10" fill="#AAAAAA">0</text>`
    );
  }

  const timeLabel = `${scaleX} s`;
  parts.push(
    `<text x="${w - 5}" y="${h - 5}" font-size="10" fill="#AAAAAA" text-anchor="end">${escapeSvgText(timeLabel)}</text>`
  );

  const uniqueColors = new Map<string, { color: string }>();
  for (const s of dataSeries) {
    if (s.run === highLighted && !uniqueColors.has(s.color)) {
      uniqueColors.set(s.color, { color: s.color });
    }
  }
  const arrowSpacing = 30;
  let axOff = 0;
  const startX = w / 2 - (uniqueColors.size * arrowSpacing) / 2;
  uniqueColors.forEach(({ color: arrowColor }) => {
    const ax = startX + axOff;
    parts.push(
      `<g transform="translate(${ax}, -15)"><line x1="0" y1="0" x2="0" y2="12" stroke="${escapeSvgText(arrowColor)}" stroke-width="2"/><polygon points="-4,8 0,14 4,8" fill="${escapeSvgText(arrowColor)}"/></g>`
    );
    axOff += arrowSpacing;
  });

  const appendSeriesPolyline = (
    series: ChartDataSeries,
    stroke: string,
    strokeW: number
  ) => {
    if (series.data.length === 0) return;
    const pts = series.data
      .slice(0, Math.min(series.data.length, displayLimit))
      .map((value, i) => {
        const px = i * (w / scaleX);
        const py = yRatio * (h - value * (h / scaleY));
        return `${px},${py}`;
      })
      .join(' ');
    parts.push(
      `<polyline points="${pts}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  };

  for (const series of dataSeries) {
    if (series.data.length === 0) continue;
    if (series.run <= runs - visibleRuns) continue;
    if (series.run === highLighted) continue;
    const c2 =
      series.color2 || lerpColor(series.color || '#000000', '#FFFFFF', 0.7);
    appendSeriesPolyline(series, c2, series.thickness);
  }

  for (const series of dataSeries) {
    if (series.data.length === 0) continue;
    if (series.run !== highLighted) continue;
    appendSeriesPolyline(series, series.color, series.thickness);
  }

  parts.push(`</svg>`);

  const title = (el.text ?? '').trim();
  if (title) {
    parts.push(
      `<text x="${wx + w / 2}" y="${wy + h + 16}" text-anchor="middle" font-size="11" font-weight="bold" fill="${escapeSvgText(strokeColor)}">${escapeSvgText(title)}</text>`
    );
  }

  return parts.join('\n');
}
