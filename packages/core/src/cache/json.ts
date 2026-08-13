/** Entries are stored as JSON text; these are the two ends of that trip. */

/** `undefined` has no JSON form — store it as null rather than a broken row. */
export function serialize(value: unknown): string {
  return JSON.stringify(value) ?? 'null';
}

/** A row we cannot read is a miss, not a crash. */
export function deserialize(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
