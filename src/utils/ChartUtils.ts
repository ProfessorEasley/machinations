export interface ChartDataSeries {
  connectionId: number;
  color: string;
  color2: string;
  thickness: number;
  name: string;
  data: number[];
  run: number;
}

export interface ChartState {
  scaleX: number;
  scaleY: number;
  negScaleY: number;
  defaultScaleX: number;
  defaultScaleY: number;
  dataSeries: ChartDataSeries[];
  tick: number;
  runs: number;
  highLighted: number;
}

export function createInitialChartState(
  defaultScaleX: number = 0,
  defaultScaleY: number = 0
): ChartState {
  return {
    scaleX: Math.max(defaultScaleX, 10),
    scaleY: Math.max(defaultScaleY, 12),
    negScaleY: 0,
    defaultScaleX,
    defaultScaleY,
    dataSeries: [],
    tick: 0,
    runs: 0,
    highLighted: 0,
  };
}

export function lerpColor(
  color: string,
  targetColor: string,
  t: number
): string {
  const parseHex = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return [r, g, b];
  };

  const toHex = (r: number, g: number, b: number): string => {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
  };

  const [r1, g1, b1] = parseHex(color);
  const [r2, g2, b2] = parseHex(targetColor);

  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function createChartDataSeries(
  connectionId: number,
  color: string,
  thickness: number,
  name: string,
  initialValue: number,
  run: number
): ChartDataSeries {
  return {
    connectionId,
    color: color || '#000000',
    color2: lerpColor(color || '#000000', '#FFFFFF', 0.7),
    thickness: thickness || 2,
    name,
    data: [initialValue],
    run,
  };
}

export function autoExpandScaleY(currentScale: number, value: number): number {
  const steps = [12, 20, 40, 100, 200, 500, 1000, 2000, 5000];

  if (value * 1.2 <= currentScale) {
    return currentScale;
  }

  for (const step of steps) {
    if (step >= value * 1.2) {
      return step;
    }
  }

  return steps[steps.length - 1];
}

export function autoExpandNegScaleY(
  currentNegScale: number,
  value: number
): number {
  const steps = [0, -12, -20, -40, -100, -200, -500, -1000, -2000, -5000];

  if (value * 1.2 >= currentNegScale) {
    return currentNegScale;
  }

  for (const step of steps) {
    if (step <= value * 1.2) {
      return step;
    }
  }

  return steps[steps.length - 1];
}

export function exportChartDataToCSV(chartState: ChartState): string {
  const { dataSeries } = chartState;

  if (dataSeries.length === 0) {
    return '';
  }

  const maxLength = Math.max(...dataSeries.map(s => s.data.length));

  const lines: string[] = [];

  const hasNames = dataSeries.some(s => s.name !== '');
  if (hasNames) {
    lines.push(dataSeries.map(s => s.name).join(','));
  }

  lines.push(dataSeries.map(s => s.thickness.toString()).join(','));

  lines.push(dataSeries.map(s => s.color).join(','));

  for (let i = 0; i < maxLength; i++) {
    const row = dataSeries.map(s => {
      if (i < s.data.length) {
        return s.data[i].toFixed(3);
      }
      return '';
    });
    lines.push(row.join(','));
  }

  return lines.join('\r\n');
}

export function downloadCSV(
  content: string,
  filename: string = 'chart_data.csv'
): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
