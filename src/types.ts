export const SPLIT_API_BASE = 'https://api.split.io/internal/api/v2';

export const enum LogLevel {
  DEFAULT = 0,
  DEBUG = 1,
  TRACE = 2
}

export interface SegmentInfo {
  name: string;
  type: string;
}
