/**
 * Error handler for API operations
 */

import { promptErrorHandling } from '../utils/stdin';

export interface ErrorHandler {
  handle(operation: string, error: Error): Promise<'abort' | 'skip' | 'retry'>;
}

/**
 * Interactive error handler that prompts the user for action
 */
export class InteractiveErrorHandler implements ErrorHandler {
  private skipAll: boolean = false;

  async handle(operation: string, error: Error): Promise<'abort' | 'skip' | 'retry'> {
    // If user previously selected "skip all", apply it
    if (this.skipAll) {
      console.log(`Skipping due to previous "skip all" choice: ${operation}`);
      return 'skip';
    }

    // Prompt the user for what to do
    const result = await promptErrorHandling(operation, error);

    // Note: We don't have "apply to all" for skip in our simplified handler,
    // but we could track it if needed in the future
    return result.action;
  }

  /**
   * Reset the skip all state
   */
  reset(): void {
    this.skipAll = false;
  }
}

/**
 * Custom error thrown when an operation is skipped
 */
export class OperationSkippedError extends Error {
  constructor(message: string = 'Operation was skipped by user') {
    super(message);
    this.name = 'OperationSkippedError';
  }
}
