/**
 * A settings patch that cannot be stored as written — the app-scoped twin of
 * `InvalidConfigError`. Separate from any other failure so the HTTP layer can
 * answer 400 with the reason, rather than 500 with none.
 */
export class InvalidSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSettingsError';
  }
}
