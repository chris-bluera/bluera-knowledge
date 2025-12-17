/**
 * Performance Metrics Utilities
 *
 * Helpers for measuring and asserting performance in tests.
 */

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  /** Operation name */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Performance statistics for multiple measurements
 */
export interface PerformanceStats {
  /** Number of measurements */
  count: number;
  /** Minimum duration */
  min: number;
  /** Maximum duration */
  max: number;
  /** Average duration */
  mean: number;
  /** Median duration */
  median: number;
  /** 95th percentile duration */
  p95: number;
  /** 99th percentile duration */
  p99: number;
  /** Standard deviation */
  stdDev: number;
  /** Total duration of all measurements */
  total: number;
}

/**
 * Measure the execution time of an async function
 *
 * @param name - Name for this measurement
 * @param fn - Async function to measure
 * @returns Measurement result with duration
 *
 * @example
 * const result = await measure('indexing', async () => {
 *   return cli('index test-store');
 * });
 * console.log(`Indexing took ${result.duration}ms`);
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; measurement: PerformanceMeasurement }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();

  return {
    result,
    measurement: {
      name,
      duration: endTime - startTime,
      startTime,
      endTime,
    },
  };
}

/**
 * Measure the execution time of a sync function
 *
 * @param name - Name for this measurement
 * @param fn - Sync function to measure
 * @returns Measurement result with duration
 */
export function measureSync<T>(
  name: string,
  fn: () => T
): { result: T; measurement: PerformanceMeasurement } {
  const startTime = performance.now();
  const result = fn();
  const endTime = performance.now();

  return {
    result,
    measurement: {
      name,
      duration: endTime - startTime,
      startTime,
      endTime,
    },
  };
}

/**
 * Calculate statistics from multiple measurements
 *
 * @param measurements - Array of measurements
 * @returns Statistical summary
 */
export function calculateStats(
  measurements: PerformanceMeasurement[]
): PerformanceStats {
  if (measurements.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      total: 0,
    };
  }

  const durations = measurements.map((m) => m.duration).sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const mean = total / durations.length;

  // Calculate standard deviation
  const squaredDiffs = durations.map((d) => Math.pow(d - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((sum, d) => sum + d, 0) / durations.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return {
    count: durations.length,
    min: durations[0],
    max: durations[durations.length - 1],
    mean,
    median: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    stdDev,
    total,
  };
}

/**
 * Calculate percentile value from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Assert that duration is within acceptable limit
 *
 * @param measurement - Measurement to check
 * @param maxDuration - Maximum acceptable duration in ms
 */
export function assertDuration(
  measurement: PerformanceMeasurement,
  maxDuration: number
): void {
  if (measurement.duration > maxDuration) {
    throw new Error(
      `${measurement.name} took ${measurement.duration.toFixed(2)}ms, ` +
        `exceeding limit of ${maxDuration}ms`
    );
  }
}

/**
 * Assert that statistics meet performance targets
 *
 * @param stats - Performance statistics
 * @param targets - Target values to meet
 */
export function assertPerformanceTargets(
  stats: PerformanceStats,
  targets: {
    maxMean?: number;
    maxP95?: number;
    maxP99?: number;
    maxMax?: number;
  }
): void {
  const failures: string[] = [];

  if (targets.maxMean !== undefined && stats.mean > targets.maxMean) {
    failures.push(
      `Mean ${stats.mean.toFixed(2)}ms exceeds target ${targets.maxMean}ms`
    );
  }

  if (targets.maxP95 !== undefined && stats.p95 > targets.maxP95) {
    failures.push(
      `P95 ${stats.p95.toFixed(2)}ms exceeds target ${targets.maxP95}ms`
    );
  }

  if (targets.maxP99 !== undefined && stats.p99 > targets.maxP99) {
    failures.push(
      `P99 ${stats.p99.toFixed(2)}ms exceeds target ${targets.maxP99}ms`
    );
  }

  if (targets.maxMax !== undefined && stats.max > targets.maxMax) {
    failures.push(
      `Max ${stats.max.toFixed(2)}ms exceeds target ${targets.maxMax}ms`
    );
  }

  if (failures.length > 0) {
    throw new Error(`Performance targets not met:\n${failures.join('\n')}`);
  }
}

/**
 * Performance benchmark runner
 */
export class Benchmark {
  private measurements: PerformanceMeasurement[] = [];
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Run a single iteration of the benchmark
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const { result, measurement } = await measure(this.name, fn);
    this.measurements.push(measurement);
    return result;
  }

  /**
   * Run sync iteration
   */
  runSync<T>(fn: () => T): T {
    const { result, measurement } = measureSync(this.name, fn);
    this.measurements.push(measurement);
    return result;
  }

  /**
   * Run multiple iterations
   */
  async runIterations<T>(
    iterations: number,
    fn: () => Promise<T>
  ): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < iterations; i++) {
      results.push(await this.run(fn));
    }
    return results;
  }

  /**
   * Get all measurements
   */
  getMeasurements(): PerformanceMeasurement[] {
    return [...this.measurements];
  }

  /**
   * Get statistics
   */
  getStats(): PerformanceStats {
    return calculateStats(this.measurements);
  }

  /**
   * Reset measurements
   */
  reset(): void {
    this.measurements = [];
  }

  /**
   * Format a summary report
   */
  formatReport(): string {
    const stats = this.getStats();
    return [
      `Benchmark: ${this.name}`,
      `  Iterations: ${stats.count}`,
      `  Min: ${stats.min.toFixed(2)}ms`,
      `  Max: ${stats.max.toFixed(2)}ms`,
      `  Mean: ${stats.mean.toFixed(2)}ms`,
      `  Median: ${stats.median.toFixed(2)}ms`,
      `  P95: ${stats.p95.toFixed(2)}ms`,
      `  P99: ${stats.p99.toFixed(2)}ms`,
      `  Std Dev: ${stats.stdDev.toFixed(2)}ms`,
      `  Total: ${stats.total.toFixed(2)}ms`,
    ].join('\n');
  }
}

/**
 * Create a stopwatch for manual timing
 */
export function createStopwatch(): {
  start: () => void;
  stop: () => number;
  elapsed: () => number;
  reset: () => void;
} {
  let startTime: number | null = null;
  let endTime: number | null = null;

  return {
    start() {
      startTime = performance.now();
      endTime = null;
    },
    stop() {
      if (startTime === null) {
        throw new Error('Stopwatch not started');
      }
      endTime = performance.now();
      return endTime - startTime;
    },
    elapsed() {
      if (startTime === null) return 0;
      const end = endTime ?? performance.now();
      return end - startTime;
    },
    reset() {
      startTime = null;
      endTime = null;
    },
  };
}

/**
 * Default performance targets for the application
 */
export const DefaultTargets = {
  SEARCH: {
    maxMean: 500,
    maxP95: 1000,
    maxMax: 2000,
  },
  INDEXING_PER_DOC: {
    maxMean: 100,
    maxP95: 200,
  },
  CLI_STARTUP: {
    maxMean: 200,
    maxP95: 500,
  },
} as const;

/**
 * Throughput calculator
 */
export function calculateThroughput(
  itemCount: number,
  durationMs: number
): {
  itemsPerSecond: number;
  msPerItem: number;
} {
  return {
    itemsPerSecond: (itemCount / durationMs) * 1000,
    msPerItem: durationMs / itemCount,
  };
}
