import React, { useMemo, useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { exportChartDataToCSV, downloadCSV } from '../utils/ChartUtils';
import type { ChartState } from '../utils/ChartUtils';

interface ChartElementProps {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  thickness: number;
  text?: string;
  chartState: ChartState;
  isSelected: boolean;
  isRunning: boolean;
  visibleRuns?: number;
  onClear?: () => void;
  onExport?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onResize?: (width: number, height: number) => void;
  selectableClass?: string;
  applyConditionStyle?: (style: CSSProperties) => CSSProperties;
}

const ChartElement: React.FC<ChartElementProps> = ({
  id,
  x,
  y,
  width,
  height,
  color,
  thickness,
  text,
  chartState,
  isSelected,
  isRunning,
  visibleRuns = 25,
  onClear,
  onExport,
  onPrevious,
  onNext,
  onMouseDown,
  onClick,
  onResize,
  selectableClass = '',
  applyConditionStyle = s => s,
}) => {
  const { scaleX, scaleY, negScaleY, dataSeries, runs, highLighted } =
    chartState;

  const MIN_WIDTH = 100;
  const MIN_HEIGHT = 80;

  const [localSize, setLocalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = width;
      const startHeight = height;

      let currentSize = { width: startWidth, height: startHeight };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        if (handle.includes('e')) {
          newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
        }
        if (handle.includes('w')) {
          newWidth = Math.max(MIN_WIDTH, startWidth - deltaX);
        }
        if (handle.includes('s')) {
          newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
        }
        if (handle.includes('n')) {
          newHeight = Math.max(MIN_HEIGHT, startHeight - deltaY);
        }

        currentSize = { width: newWidth, height: newHeight };
        setLocalSize(currentSize);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        if (
          onResize &&
          (currentSize.width !== startWidth ||
            currentSize.height !== startHeight)
        ) {
          onResize(currentSize.width, currentSize.height);
        }
        setLocalSize(null);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, height, onResize]
  );

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    backgroundColor: '#0078d4',
    border: '2px solid white',
    borderRadius: '50%',
    zIndex: 10,
  };

  const yRatio = scaleY / (scaleY - negScaleY);

  const yGridLines = useMemo(() => {
    const lines: { y: number; label: string }[] = [];
    let step = yRatio * 0.25;
    let yPos = step;

    while (yPos < 1) {
      const value = scaleY * (1 - yPos / yRatio);
      lines.push({
        y: yPos * height,
        label:
          Math.round(value * 4) / 4 === Math.round(value)
            ? Math.round(value).toString()
            : value.toFixed(1),
      });
      yPos += step;
    }

    return lines;
  }, [height, scaleY, yRatio]);

  const xGridLines = useMemo(() => {
    const lines: { x: number; label?: string }[] = [];
    let interval = 10;

    while (interval * (width / scaleX) < 10) {
      interval *= 10;
    }

    let xVal = interval;
    while (xVal < scaleX) {
      lines.push({
        x: xVal * (width / scaleX),
      });
      xVal += interval;
    }

    return lines;
  }, [width, scaleX]);

  const renderCurves = useMemo(() => {
    const curves: React.ReactElement[] = [];
    const displayLimit =
      chartState.defaultScaleX > 0 ? chartState.defaultScaleX : width;

    dataSeries.forEach((series, idx) => {
      if (series.data.length === 0) return;
      if (series.run <= runs - visibleRuns) return;
      if (series.run === highLighted) return;

      const points = series.data
        .slice(0, Math.min(series.data.length, displayLimit))
        .map((value, i) => {
          const px = i * (width / scaleX);
          const py = yRatio * (height - value * (height / scaleY));
          return `${px},${py}`;
        })
        .join(' ');

      curves.push(
        <polyline
          key={`curve-dim-${series.connectionId}-${series.run}-${idx}`}
          points={points}
          fill="none"
          stroke={series.color2}
          strokeWidth={series.thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    });

    dataSeries.forEach((series, idx) => {
      if (series.data.length === 0) return;
      if (series.run !== highLighted) return;

      const points = series.data
        .slice(0, Math.min(series.data.length, displayLimit))
        .map((value, i) => {
          const px = i * (width / scaleX);
          const py = yRatio * (height - value * (height / scaleY));
          return `${px},${py}`;
        })
        .join(' ');

      curves.push(
        <polyline
          key={`curve-highlight-${series.connectionId}-${series.run}-${idx}`}
          points={points}
          fill="none"
          stroke={series.color}
          strokeWidth={series.thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    });

    return curves;
  }, [
    dataSeries,
    runs,
    highLighted,
    visibleRuns,
    width,
    height,
    scaleX,
    scaleY,
    yRatio,
    chartState.defaultScaleX,
  ]);

  const renderLegendArrows = useMemo(() => {
    const uniqueColors = new Map<
      string,
      { color: string; thickness: number }
    >();

    dataSeries
      .filter(s => s.run === highLighted)
      .forEach(s => {
        if (!uniqueColors.has(s.color)) {
          uniqueColors.set(s.color, { color: s.color, thickness: s.thickness });
        }
      });

    const arrows: React.ReactElement[] = [];
    let xOffset = 0;
    const arrowSpacing = 30;
    const startX = width / 2 - (uniqueColors.size * arrowSpacing) / 2;

    uniqueColors.forEach(({ color: arrowColor }, idx) => {
      const ax = startX + xOffset;
      arrows.push(
        <g key={`legend-arrow-${idx}`} transform={`translate(${ax}, -15)`}>
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="12"
            stroke={arrowColor}
            strokeWidth="2"
          />
          <polygon points="-4,8 0,14 4,8" fill={arrowColor} />
        </g>
      );
      xOffset += arrowSpacing;
    });

    return arrows;
  }, [dataSeries, highLighted, width]);

  const handleClearClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClear?.();
    },
    [onClear]
  );

  const handleExportClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onExport) {
        onExport();
      } else {
        const csv = exportChartDataToCSV(chartState);
        if (csv) {
          downloadCSV(csv, `chart_${id}_data.csv`);
        }
      }
    },
    [onExport, chartState, id]
  );

  const handlePreviousClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPrevious?.();
    },
    [onPrevious]
  );

  const handleNextClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onNext?.();
    },
    [onNext]
  );

  const timeLabel = `${scaleX} s`;

  return (
    <div
      className={`chart-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
      style={applyConditionStyle({
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        height: height + 30,
      })}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <svg
        width={width}
        height={height}
        style={{
          border: `${thickness}px solid ${isSelected ? '#0078d4' : color}`,
          backgroundColor: 'white',
          display: 'block',
        }}
      >
        {yGridLines.map((line, idx) => (
          <g key={`y-grid-${idx}`}>
            <line
              x1={2}
              y1={line.y}
              x2={width - 3}
              y2={line.y}
              stroke="#CCCCCC"
              strokeWidth={1}
            />
            <text x={5} y={line.y + 12} fontSize={10} fill="#AAAAAA">
              {line.label}
            </text>
          </g>
        ))}

        {xGridLines.map((line, idx) => (
          <line
            key={`x-grid-${idx}`}
            x1={line.x}
            y1={2}
            x2={line.x}
            y2={height - 3}
            stroke="#CCCCCC"
            strokeWidth={1}
          />
        ))}

        <text x={5} y={12} fontSize={10} fill="#AAAAAA">
          {scaleY}
        </text>

        {negScaleY < 0 && (
          <text x={5} y={yRatio * height + 12} fontSize={10} fill="#AAAAAA">
            0
          </text>
        )}

        <text
          x={width - 5}
          y={height - 5}
          fontSize={10}
          fill="#AAAAAA"
          textAnchor="end"
        >
          {timeLabel}
        </text>

        {renderLegendArrows}

        {renderCurves}

        {runs >= 1 && !isRunning && (
          <text
            x={width - 5}
            y={15}
            fontSize={11}
            fill={color}
            textAnchor="end"
            style={{ cursor: 'pointer', fontWeight: 'bold' }}
            onClick={handleClearClick}
          >
            clear
          </text>
        )}
      </svg>
      {isSelected && !isRunning && (
        <>
          <div
            style={{ ...handleStyle, left: -6, top: -6, cursor: 'nw-resize' }}
            onMouseDown={e => handleResizeStart(e, 'nw')}
          />
          <div
            style={{ ...handleStyle, right: -6, top: -6, cursor: 'ne-resize' }}
            onMouseDown={e => handleResizeStart(e, 'ne')}
          />
          <div
            style={{
              ...handleStyle,
              left: -6,
              bottom: 24,
              cursor: 'sw-resize',
            }}
            onMouseDown={e => handleResizeStart(e, 'sw')}
          />
          <div
            style={{
              ...handleStyle,
              right: -6,
              bottom: 24,
              cursor: 'se-resize',
            }}
            onMouseDown={e => handleResizeStart(e, 'se')}
          />
        </>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 25,
          paddingTop: 5,
          fontSize: 11,
          fontWeight: 'bold',
          color: color,
        }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {runs >= 2 && !isRunning && (
            <>
              <span style={{ cursor: 'pointer' }} onClick={handlePreviousClick}>
                {'<<'}
              </span>
              <span style={{ minWidth: 20, textAlign: 'center' }}>
                {highLighted + 1}
              </span>
              <span style={{ cursor: 'pointer' }} onClick={handleNextClick}>
                {'>>'}
              </span>
            </>
          )}
        </div>

        {runs >= 1 && !isRunning && (
          <span style={{ cursor: 'pointer' }} onClick={handleExportClick}>
            export
          </span>
        )}
      </div>

      {text && (
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: 11,
            color: color,
            fontWeight: 'bold',
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default ChartElement;
