import { fileName } from '$lib/format';

/**
 * What the rail and the breadcrumb call the analysed repository: the folder's
 * name, because an absolute path is too long for either slot. Until the
 * project registry lands this is all the identity a project has.
 */
export function projectLabel(root: string): string {
  const trimmed = root.trim().replaceAll('\\', '/').replace(/\/+$/, '');
  if (!trimmed) return '';
  return fileName(trimmed) || trimmed;
}
