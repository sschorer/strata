import { apiRequest } from './request';
import type { AnalysisReport, AnalyzeRequest } from './types';

/**
 * `POST /analyze` — run the pipeline over a repo and return the full report.
 * Fails with 403 for a root outside the server's allowed ones and 404 for one
 * inside them that is not there.
 */
export function analyze(
  request: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<AnalysisReport> {
  return apiRequest<AnalysisReport>('/analyze', {
    method: 'POST',
    body: request,
    signal,
  });
}
