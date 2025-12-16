export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
  details?: Record<string, unknown>;
}

export type ProgressCallback = (event: ProgressEvent) => void;
