import type { StructuredLog } from '@/types/project';

export function log(level: StructuredLog['level'], action: string, data?: Record<string, unknown>) {
  const entry: StructuredLog = {
    timestamp: new Date().toISOString(),
    level,
    action,
    ...(data !== undefined && { data }),
  };
  console.log(JSON.stringify(entry));
}
