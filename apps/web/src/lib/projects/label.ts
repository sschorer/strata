import { fileName } from '$lib/format';

/**
 * What a repository is called when nothing has named it: the folder's own
 * name, because an absolute path is too long for a rail slot or a breadcrumb.
 * *Add project* offers it as the display name, and the header falls back to it
 * for a repository that is not registered at all.
 */
export function projectLabel(root: string): string {
  const trimmed = root.trim().replaceAll('\\', '/').replace(/\/+$/, '');
  if (!trimmed) return '';
  return fileName(trimmed) || trimmed;
}
