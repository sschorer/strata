import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** Run a read-only git command in `root` and return stdout. */
export async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd: root,
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}
