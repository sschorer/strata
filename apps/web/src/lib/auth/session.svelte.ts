import { clearStoredToken, readStoredToken, storeToken } from './storage';

/**
 * The credential this browser talks to the workbench with.
 *
 * A server started without `$STRATA_TOKEN` never challenges, so this stays
 * empty and nothing about it is ever shown — the unlock panel exists for the
 * deployment that set one.
 *
 * Exported as a class as well as the singleton below: a test wants its own
 * instance, the app wants one.
 */
export class Session {
  #token = $state<string | null>(null);
  #locked = $state(false);
  #refused = $state(false);

  constructor(token: string | null = readStoredToken()) {
    this.#token = token;
  }

  /** What to send, or `null` to send nothing. */
  get token(): string | null {
    return this.#token;
  }

  /** The server has asked for a credential this browser cannot supply. */
  get locked(): boolean {
    return this.#locked;
  }

  /** The lock followed a token being turned down, rather than none being held. */
  get refused(): boolean {
    return this.#refused;
  }

  /**
   * A request came back 401. The token that produced it is dropped, stored
   * copy included: keeping a credential the server refuses only means the next
   * reload fails the same way, silently.
   */
  challenge(): void {
    this.#refused = this.#token !== null;
    this.#token = null;
    this.#locked = true;
    clearStoredToken();
  }

  /**
   * Accept a token the server has just answered to. Remembered, so a reload
   * does not ask again.
   */
  unlock(token: string): void {
    this.#token = token;
    this.#locked = false;
    this.#refused = false;
    storeToken(token);
  }

  /** Forget the token without waiting to be challenged for it. */
  forget(): void {
    this.#token = null;
    this.#locked = false;
    this.#refused = false;
    clearStoredToken();
  }
}

export const session = new Session();
