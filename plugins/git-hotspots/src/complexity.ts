import type { RepoFile } from '@strata/sdk';

/**
 * Sum of leading-whitespace depth per non-blank line — a fast, language-free
 * complexity proxy. A `language` plugin can later supply real cyclomatic
 * complexity to replace it.
 */
export async function indentComplexity(file: RepoFile): Promise<number> {
  const text = await file.read();
  let score = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    score += 1 + Math.floor(indent / 2);
  }
  return score;
}
