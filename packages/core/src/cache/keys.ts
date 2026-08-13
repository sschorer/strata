/** `\x1f` cannot occur in a plugin id, a version or a sha. */
const KEY_SEP = '\x1f';

/** Identity of one cache entry, for the in-memory write buffer. */
export function entryKey(
  pluginId: string,
  version: string,
  key: string,
): string {
  return `${pluginId}${KEY_SEP}${version}${KEY_SEP}${key}`;
}

export function splitKey(key: string): [string, string, string] {
  const [pluginId, version, rest] = key.split(KEY_SEP);
  return [pluginId!, version!, rest!];
}
