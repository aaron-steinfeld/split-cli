/**
 * Utility functions for reading input from stdin
 */

import * as readline from 'readline';

/**
 * Read a value from stdin with a prompt
 * For sensitive data like API tokens, the input is not echoed to the terminal
 */
export async function readFromStdin(prompt: string, silent: boolean = true): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: silent,
    });

    if (silent) {
      // For silent mode, we need to handle it differently
      // Write the prompt to stderr to avoid mixing with input
      process.stderr.write(prompt);

      // Mute output
      const stdin = process.stdin;
      (stdin as any).setRawMode?.(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      let input = '';

      const onData = (char: string): void => {
        const charCode = char.charCodeAt(0);

        if (charCode === 3) {
          // Ctrl+C
          process.exit(1);
        } else if (charCode === 13 || charCode === 10) {
          // Enter key
          stdin.pause();
          stdin.removeListener('data', onData);
          (stdin as any).setRawMode?.(false);
          process.stderr.write('\n');
          rl.close();
          resolve(input.trim());
        } else if (charCode === 127 || charCode === 8) {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += char;
        }
      };

      stdin.on('data', onData);
    } else {
      // Non-silent mode - just use readline normally
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Get an API key from environment variable or stdin
 * Priority: Environment variable > stdin prompt
 */
export async function getApiKey(): Promise<string> {
  // First check environment variable
  const envValue = process.env['SPLIT_API_KEY'];
  if (envValue) {
    return envValue.trim();
  }

  // If not found, prompt via stdin
  console.log('\nSPLIT_API_KEY not found in environment variables.');
  const apiKey = await readFromStdin('Enter Split.io API key: ', true);

  if (!apiKey) {
    throw new Error('SPLIT_API_KEY is required');
  }

  return apiKey;
}

/**
 * Prompt user to confirm a deletion operation
 * Shows a tree of resources that will be deleted
 * Returns true if confirmed, false if aborted
 */
export async function confirmDeletion(message: string): Promise<boolean> {
  console.log(`\n${message}\n`);

  while (true) {
    const answer = await readFromStdin('Proceed with deletion? (yes/no): ', false);
    const choice = answer.trim().toLowerCase();

    if (choice === 'yes' || choice === 'y') {
      return true;
    } else if (choice === 'no' || choice === 'n') {
      return false;
    } else {
      console.log('Invalid choice. Please enter "yes" or "no".');
    }
  }
}

/**
 * Prompt user to handle an error during deletion
 * Returns: { action: 'abort' | 'skip' | 'retry' }
 */
export async function promptErrorHandling(
  operation: string,
  error: Error
): Promise<{ action: 'abort' | 'skip' | 'retry' }> {
  console.log(`\n❌ Error during: ${operation}`);
  console.log(`   Error: ${error.message}`);
  console.log('\nHow would you like to proceed?');
  console.log('  a) Abort - Stop the operation');
  console.log('  s) Skip - Continue to next item');
  console.log('  r) Retry - Try this operation again');

  while (true) {
    const answer = await readFromStdin('\nChoice (a/s/r): ', false);
    const choice = answer.trim().toLowerCase();

    if (choice === 'a' || choice === 'abort') {
      return { action: 'abort' };
    } else if (choice === 's' || choice === 'skip') {
      return { action: 'skip' };
    } else if (choice === 'r' || choice === 'retry') {
      return { action: 'retry' };
    } else {
      console.log('Invalid choice. Please enter "a" (abort), "s" (skip), or "r" (retry).');
    }
  }
}
