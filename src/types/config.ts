/**
 * Configuration types for the CLI
 */

export interface CliConfig {
  apiKey: string;
  debug: boolean;
  dryRun: boolean;
}

export interface DeleteOptions {
  cascade: boolean;
  force?: boolean;
}
