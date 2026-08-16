/** One subdirectory of the directory being browsed. */
export interface DirectoryEntry {
  name: string;
  /** Absolute path, so the caller never has to join anything. */
  path: string;
  /** Whether this directory is a git working tree — what *Add project* wants. */
  repo: boolean;
}

/** A directory as the folder picker shows it. */
export interface DirectoryListing {
  /** The directory that was listed, resolved: absolute, symlinks followed. */
  path: string;
  /** One level up, or `null` at a browse root — nothing above one is offered. */
  parent: string | null;
  /** Whether the listed directory is itself a repository. */
  repo: boolean;
  /** Its subdirectories, by name. Files are never listed. */
  entries: DirectoryEntry[];
  /** Every directory browsing may reach; the picker offers them as starts. */
  roots: string[];
}

export interface BrowseOptions {
  /** Directory to list. Defaults to the first browse root. */
  path?: string;
  /** Include dot-directories. Off by default: they are rarely repositories. */
  hidden?: boolean;
  /**
   * The directories browsing is confined to. Defaults to what `$STRATA_ROOTS`
   * names, else the server user's home.
   */
  roots?: string[];
}
