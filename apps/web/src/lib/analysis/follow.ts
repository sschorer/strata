import { ApiError, fetchJob, streamJob, type AnalysisJob } from '$lib/api';

/** How long to wait between asks when the stream is not available. */
const POLL_MS = 1000;

/** A job that will not change again. */
function settled(job: AnalysisJob): boolean {
  return job.state === 'succeeded' || job.state === 'failed';
}

/**
 * Follow a run to its end, however the connection behaves.
 *
 * The event stream is the good path — a step arrives as the server takes it.
 * But a stream is a connection held open for the length of an analysis, and
 * those get dropped: by a proxy with an idle timeout, by a laptop that slept,
 * by a network that blinked. Dropping one must not leave the workbench saying
 * *Analysing…* over a run that finished ten minutes ago, so when the stream
 * ends without a verdict this falls back to asking the server what became of
 * the job — which is the same question, more slowly.
 */
export async function followJob(
  id: string,
  onJob: (job: AnalysisJob) => void,
  signal?: AbortSignal,
): Promise<AnalysisJob> {
  let last: AnalysisJob | null = null;
  try {
    last = await streamJob(id, onJob, signal);
    if (last && settled(last)) return last;
  } catch (err) {
    // A stream that never opened is worth one direct ask before giving up: the
    // job itself may well be fine.
    if (err instanceof ApiError && err.status === 404) throw err;
  }

  for (;;) {
    signal?.throwIfAborted();
    const { job } = await fetchJob(id, signal);
    if (job !== last) onJob(job);
    last = job;
    if (settled(job)) return job;
    await wait(POLL_MS, signal);
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
