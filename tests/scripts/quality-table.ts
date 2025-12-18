/**
 * Box-drawing table utilities for pretty CLI output
 */

// Box drawing characters
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
};

// Bar characters for progress bars
const BAR = {
  filled: '█',
  empty: '░',
};

export interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface TableConfig {
  title?: string;
  columns: Column[];
  maxWidth?: number;
}

/**
 * Truncate string to length, adding ellipsis if needed
 */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

/**
 * Pad string to width with given alignment
 */
export function pad(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const truncated = truncate(str, width);
  const padding = width - truncated.length;
  if (padding <= 0) return truncated;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + truncated;
    case 'center':
      const left = Math.floor(padding / 2);
      return ' '.repeat(left) + truncated + ' '.repeat(padding - left);
    default:
      return truncated + ' '.repeat(padding);
  }
}

/**
 * Draw a horizontal line
 */
function drawLine(widths: number[], left: string, mid: string, right: string): string {
  const segments = widths.map(w => BOX.horizontal.repeat(w + 2));
  return left + segments.join(mid) + right;
}

/**
 * Draw a row of cells
 */
function drawRow(cells: string[], widths: number[], aligns: ('left' | 'right' | 'center')[]): string {
  const padded = cells.map((cell, i) => pad(cell, widths[i], aligns[i]));
  return BOX.vertical + ' ' + padded.join(' ' + BOX.vertical + ' ') + ' ' + BOX.vertical;
}

/**
 * Draw a complete table
 */
export function drawTable(config: TableConfig, rows: string[][]): string {
  const widths = config.columns.map(c => c.width);
  const aligns = config.columns.map(c => c.align || 'left');
  const headers = config.columns.map(c => c.header);

  const lines: string[] = [];

  // Title row if present
  if (config.title) {
    const totalWidth = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 3 + 4;
    lines.push(drawLine(widths, BOX.topLeft, BOX.topT, BOX.topRight));
    lines.push(BOX.vertical + ' ' + pad(config.title, totalWidth - 4, 'left') + ' ' + BOX.vertical);
    lines.push(drawLine(widths, BOX.leftT, BOX.cross, BOX.rightT));
  } else {
    lines.push(drawLine(widths, BOX.topLeft, BOX.topT, BOX.topRight));
  }

  // Header row
  lines.push(drawRow(headers, widths, aligns));
  lines.push(drawLine(widths, BOX.leftT, BOX.cross, BOX.rightT));

  // Data rows
  for (const row of rows) {
    lines.push(drawRow(row, widths, aligns));
  }

  // Bottom
  lines.push(drawLine(widths, BOX.bottomLeft, BOX.bottomT, BOX.bottomRight));

  return lines.join('\n');
}

/**
 * Draw a simple box around content
 */
export function drawBox(title: string, lines: string[], width: number): string {
  const output: string[] = [];

  // Top with title
  output.push(BOX.topLeft + BOX.horizontal.repeat(width - 2) + BOX.topRight);
  output.push(BOX.vertical + ' ' + pad(title, width - 4) + ' ' + BOX.vertical);
  output.push(BOX.leftT + BOX.horizontal.repeat(width - 2) + BOX.rightT);

  // Content
  for (const line of lines) {
    output.push(BOX.vertical + ' ' + pad(line, width - 4) + ' ' + BOX.vertical);
  }

  // Bottom
  output.push(BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight);

  return output.join('\n');
}

/**
 * Draw a horizontal progress bar
 */
export function drawBar(value: number, max: number = 1, width: number = 40): string {
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const filled = Math.round(ratio * width);
  return BAR.filled.repeat(filled) + BAR.empty.repeat(width - filled);
}

/**
 * Format a score with consistent decimal places
 */
export function formatScore(score: number, decimals: number = 2): string {
  return score.toFixed(decimals);
}

/**
 * Format a duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m${remaining}s`;
}

/**
 * Format a date from ISO string to compact format
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

/**
 * Get trend indicator
 */
export function getTrend(current: number, previous: number): string {
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return '  —';
  const sign = delta > 0 ? '▲' : '▼';
  return `${sign} ${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;
}

/**
 * Format a file path to a short display name
 */
export function shortPath(fullPath: string, maxLen: number = 20): string {
  // Extract just the meaningful part after corpus/
  const match = fullPath.match(/corpus\/(.+)/);
  if (match) {
    return truncate(match[1], maxLen);
  }
  // Or just the filename
  const parts = fullPath.split('/');
  return truncate(parts[parts.length - 1], maxLen);
}
