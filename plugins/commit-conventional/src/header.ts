/** The `type(scope)!: subject` line, per the Conventional Commits spec. */
const HEADER =
  /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s(?<subject>.+)$/;

export interface ParsedHeader {
  type: string | null;
  scope: string | null;
  /** The `!` marker; a `BREAKING CHANGE:` footer counts too, but not here. */
  bang: boolean;
  subject: string;
}

/** Parse the first line, or `undefined` when it isn't conventional at all. */
export function parseHeader(message: string): ParsedHeader | undefined {
  const [header] = message.split('\n');
  const m = header?.match(HEADER);
  if (!m?.groups) return undefined;
  return {
    type: m.groups.type ?? null,
    scope: m.groups.scope ?? null,
    bang: m.groups.breaking === '!',
    subject: m.groups.subject ?? '',
  };
}

/** The header line as written, for commits that don't match the convention. */
export function headerLine(message: string): string {
  return message.split('\n')[0] ?? '';
}
