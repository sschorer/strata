import { apiFetch } from './request';
import type { AnalysisJob } from './types';

/**
 * `GET /jobs/:id/events` — follow one run until it settles.
 *
 * Read over `fetch` rather than through `EventSource`, which cannot carry the
 * bearer header the API is behind. The frames are parsed here instead, which is
 * a few lines and keeps every call to the server going through one place that
 * knows about the token and about a 401.
 *
 * Resolves with the last job the stream reported, which is the finished one
 * whenever the stream ran to the end — and `null` when it said nothing at all.
 * A stream that drops early is not treated as a failed run: the caller asks the
 * server what became of the job.
 */
export async function streamJob(
  id: string,
  onJob: (job: AnalysisJob) => void,
  signal?: AbortSignal,
): Promise<AnalysisJob | null> {
  const response = await apiFetch(`/jobs/${encodeURIComponent(id)}/events`, {
    accept: 'text/event-stream',
    signal,
  });
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let last: AnalysisJob | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // A blank line ends a frame; whatever follows the last one is a frame
      // still on its way.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const job = jobIn(frame);
        if (!job) continue;
        last = job;
        onJob(job);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return last;
}

/** The job one frame carries; null for the stream's keep-alive comments. */
function jobIn(frame: string): AnalysisJob | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data) as AnalysisJob;
  } catch {
    // A half-written frame is not worth failing a run over; the next one, or
    // the job itself, still says where the run got to.
    return null;
  }
}
