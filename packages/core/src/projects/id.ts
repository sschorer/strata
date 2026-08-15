const MAX_LENGTH = 48;

/** Nothing in the display name is guaranteed to survive slugification. */
const FALLBACK = 'project';

/**
 * A stable, URL-safe id for a project, derived from its display name: the id
 * lands in `/projects/:id` and in stored config, so it is readable rather than
 * a uuid — but it is assigned once and never re-derived, so renaming a project
 * later cannot break a link.
 *
 * `taken` decides collisions (two projects may share a display name); the
 * second one gets a numeric suffix.
 */
export function projectId(
  name: string,
  taken: (id: string) => boolean,
): string {
  const base = slug(name) || FALLBACK;
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken(candidate)) return candidate;
  }
}

function slug(name: string): string {
  return name
    .normalize('NFKD')
    // Drop the combining marks NFKD split off, so "Ökonomie" slugs as "okonomie".
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '');
}
