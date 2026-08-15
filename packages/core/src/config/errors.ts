/**
 * A patch that cannot be stored as written. Separate from any other failure so
 * the HTTP layer can answer 400 with the reason, rather than 500 with none.
 */
export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}
