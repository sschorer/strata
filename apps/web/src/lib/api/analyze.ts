import { apiRequest } from './request';
import type { AnalysisReport, AnalyzeRequest } from './types';

/** `POST /analyze` — run the pipeline over a repo and return the full report. */
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
