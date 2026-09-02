/**
 * Lightweight Client-Side Telemetry
 *
 * Tracks AI agent latency, query counts, and system health
 * for observability without external dependencies.
 * Data is stored locally and can be exported for analysis.
 */

export interface TelemetryEvent {
  id: string;
  type: 'agent_call' | 'query' | 'error' | 'page_view';
  name: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

const MAX_EVENTS = 500;
const events: TelemetryEvent[] = [];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function trackEvent(
  type: TelemetryEvent['type'],
  name: string,
  options?: { durationMs?: number; metadata?: Record<string, unknown> },
): void {
  const event: TelemetryEvent = {
    id: generateId(),
    type,
    name,
    durationMs: options?.durationMs,
    metadata: options?.metadata,
    timestamp: Date.now(),
  };

  events.push(event);

  // Trim old events
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

/**
 * Measure the duration of an async operation.
 */
export async function measureAsync<T>(
  type: TelemetryEvent['type'],
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    trackEvent(type, name, {
      durationMs: Math.round(performance.now() - start),
      metadata: { ...metadata, success: true },
    });
    return result;
  } catch (error) {
    trackEvent('error', `${name}:error`, {
      durationMs: Math.round(performance.now() - start),
      metadata: {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown',
      },
    });
    throw error;
  }
}

/**
 * Get recent events for analysis.
 */
export function getEvents(type?: TelemetryEvent['type'], limit = 50): TelemetryEvent[] {
  const filtered = type ? events.filter((e) => e.type === type) : events;
  return filtered.slice(-limit);
}

/**
 * Get aggregate stats.
 */
export function getStats(): {
  totalEvents: number;
  avgAgentLatency: number;
  errorCount: number;
  agentCallCount: number;
} {
  const agentEvents = events.filter((e) => e.type === 'agent_call');
  const errorEvents = events.filter((e) => e.type === 'error');

  const totalLatency = agentEvents.reduce((sum, e) => sum + (e.durationMs ?? 0), 0);

  return {
    totalEvents: events.length,
    avgAgentLatency: agentEvents.length > 0 ? Math.round(totalLatency / agentEvents.length) : 0,
    errorCount: errorEvents.length,
    agentCallCount: agentEvents.length,
  };
}

/**
 * Export all events as JSON for offline analysis.
 */
export function exportEvents(): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalEvents: events.length,
    stats: getStats(),
    events,
  }, null, 2);
}
