#!/usr/bin/env node

/**
 * Split CLI - Command-line tool for managing Split.io resources with cascading delete support
 */

import { Command } from 'commander';
import { LegacySplitApi } from './api/LegacySplitApi';
import { DeleteService } from './services/DeleteService';
import { getApiKey } from './utils/stdin';
import { ResourceType } from './types/split';
import { DeleteOptions } from './types/config';

const program = new Command();

program
  .name('split-cli')
  .description('CLI tool for managing Split.io resources with cascading delete support')
  .version('2.0.0');

// Common options for all delete commands
interface CommonOptions {
  apiKey: string | undefined;
  baseUrl: string | undefined;
  workspace: string;
  cascade: boolean;
  dryRun: boolean;
  debug: boolean;
  nonInteractive: boolean;
  ignoreErrors: boolean;
}

/**
 * Execute a delete operation
 */
async function executeDelete(
  type: ResourceType,
  name: string,
  options: CommonOptions
): Promise<void> {
  try {
    // Get API key
    const apiKey = options.apiKey || await getApiKey();

    // Get base URL (defaults to https://api.split.io/internal/api/v2 if not provided)
    const baseUrl = options.baseUrl || undefined;

    // Create API client
    const api = new LegacySplitApi(apiKey, baseUrl, options.debug, options.dryRun);

    // Create delete service
    const deleteService = new DeleteService(api, options.workspace);

    // Prepare delete options
    const deleteOptions: DeleteOptions = {
      cascade: options.cascade,
      nonInteractive: options.nonInteractive,
      ignoreErrors: options.ignoreErrors,
    };

    // Execute the deletion
    const success = await deleteService.deleteResource(type, name, deleteOptions);

    if (success) {
      console.log(`\n✅ Successfully deleted ${type} '${name}'`);
      process.exit(0);
    } else {
      console.error(`\n❌ Failed to delete ${type} '${name}'`);
      process.exit(options.ignoreErrors ? 0 : 1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    } else {
      console.error(`\n❌ Unknown error occurred`);
    }
    process.exit(options.ignoreErrors ? 0 : 1);
  }
}

// Delete command
const deleteCmd = program
  .command('delete')
  .description('Delete Split.io resources')
  .showHelpAfterError();

// Workspace delete
deleteCmd
  .command('workspace <workspace-id>')
  .description('Delete a workspace (requires workspace ID, not name)')
  .option('--api-key <key>', 'Split.io API key (or use SPLIT_API_KEY env var)')
  .option('--base-url <url>', 'Split.io API base URL (default: https://api.split.io/internal/api/v2)')
  .option('--cascade', 'Delete all child resources (flags, segments, environments, traffic types)')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--non-interactive', 'Skip confirmation prompts (for CI/scripted usage)')
  .option('--ignore-errors', 'Continue on errors and exit 0 (best-effort cleanup)')
  .option('--debug', 'Enable debug logging')
  .showHelpAfterError()
  .action(async (workspaceId: string, options: Omit<CommonOptions, 'workspace'>) => {
    await executeDelete('workspace', workspaceId, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      workspace: workspaceId,
      cascade: options.cascade || false,
      dryRun: options.dryRun || false,
      nonInteractive: options.nonInteractive || false,
      ignoreErrors: options.ignoreErrors || false,
      debug: options.debug || false,
    });
  });

// Environment delete
deleteCmd
  .command('environment <name-or-id>')
  .description('Delete an environment (accepts environment name or ID)')
  .requiredOption('-w, --workspace <id>', 'Workspace ID')
  .option('--api-key <key>', 'Split.io API key (or use SPLIT_API_KEY env var)')
  .option('--base-url <url>', 'Split.io API base URL (default: https://api.split.io/internal/api/v2)')
  .option('--cascade', 'Delete all split definitions in this environment')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--non-interactive', 'Skip confirmation prompts (for CI/scripted usage)')
  .option('--ignore-errors', 'Continue on errors and exit 0 (best-effort cleanup)')
  .option('--debug', 'Enable debug logging')
  .showHelpAfterError()
  .action(async (nameOrId: string, options: CommonOptions) => {
    await executeDelete('environment', nameOrId, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      workspace: options.workspace,
      cascade: options.cascade || false,
      dryRun: options.dryRun || false,
      nonInteractive: options.nonInteractive || false,
      ignoreErrors: options.ignoreErrors || false,
      debug: options.debug || false,
    });
  });

// Split (feature flag) delete
deleteCmd
  .command('split <name>')
  .description('Delete a feature flag (split)')
  .requiredOption('-w, --workspace <id>', 'Workspace ID')
  .option('--api-key <key>', 'Split.io API key (or use SPLIT_API_KEY env var)')
  .option('--base-url <url>', 'Split.io API base URL (default: https://api.split.io/internal/api/v2)')
  .option('--cascade', 'Delete all definitions across all environments')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--non-interactive', 'Skip confirmation prompts (for CI/scripted usage)')
  .option('--ignore-errors', 'Continue on errors and exit 0 (best-effort cleanup)')
  .option('--debug', 'Enable debug logging')
  .showHelpAfterError()
  .action(async (name: string, options: CommonOptions) => {
    await executeDelete('split', name, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      workspace: options.workspace,
      cascade: options.cascade || false,
      dryRun: options.dryRun || false,
      nonInteractive: options.nonInteractive || false,
      ignoreErrors: options.ignoreErrors || false,
      debug: options.debug || false,
    });
  });

// Segment delete
deleteCmd
  .command('segment <name>')
  .description('Delete a segment')
  .requiredOption('-w, --workspace <id>', 'Workspace ID')
  .option('--api-key <key>', 'Split.io API key (or use SPLIT_API_KEY env var)')
  .option('--base-url <url>', 'Split.io API base URL (default: https://api.split.io/internal/api/v2)')
  .option('--cascade', 'Delete segment including all keys')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--non-interactive', 'Skip confirmation prompts (for CI/scripted usage)')
  .option('--ignore-errors', 'Continue on errors and exit 0 (best-effort cleanup)')
  .option('--debug', 'Enable debug logging')
  .showHelpAfterError()
  .action(async (name: string, options: CommonOptions) => {
    await executeDelete('segment', name, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      workspace: options.workspace,
      cascade: options.cascade || false,
      dryRun: options.dryRun || false,
      nonInteractive: options.nonInteractive || false,
      ignoreErrors: options.ignoreErrors || false,
      debug: options.debug || false,
    });
  });

// Large segment delete
deleteCmd
  .command('large-segment <name>')
  .description('Delete a large segment')
  .requiredOption('-w, --workspace <id>', 'Workspace ID')
  .option('--api-key <key>', 'Split.io API key (or use SPLIT_API_KEY env var)')
  .option('--base-url <url>', 'Split.io API base URL (default: https://api.split.io/internal/api/v2)')
  .option('--cascade', 'Delete large segment including all keys')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--non-interactive', 'Skip confirmation prompts (for CI/scripted usage)')
  .option('--ignore-errors', 'Continue on errors and exit 0 (best-effort cleanup)')
  .option('--debug', 'Enable debug logging')
  .showHelpAfterError()
  .action(async (name: string, options: CommonOptions) => {
    await executeDelete('large-segment', name, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      workspace: options.workspace,
      cascade: options.cascade || false,
      dryRun: options.dryRun || false,
      nonInteractive: options.nonInteractive || false,
      ignoreErrors: options.ignoreErrors || false,
      debug: options.debug || false,
    });
  });

// Rule-based segment delete
deleteCmd
  .command('rule-based-segment <name>')
  .description('Delete a rule-based segment')
  .requiredOption('-w, --workspace <id>', 'Workspace ID')
  .option('--api-key <key>', 'Split.io API key (or use SPLIT_API_KEY env var)')
  .option('--base-url <url>', 'Split.io API base URL (default: https://api.split.io/internal/api/v2)')
  .option('--cascade', 'Delete rule-based segment including all rules')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--non-interactive', 'Skip confirmation prompts (for CI/scripted usage)')
  .option('--ignore-errors', 'Continue on errors and exit 0 (best-effort cleanup)')
  .option('--debug', 'Enable debug logging')
  .showHelpAfterError()
  .action(async (name: string, options: CommonOptions) => {
    await executeDelete('rule-based-segment', name, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      workspace: options.workspace,
      cascade: options.cascade || false,
      dryRun: options.dryRun || false,
      nonInteractive: options.nonInteractive || false,
      ignoreErrors: options.ignoreErrors || false,
      debug: options.debug || false,
    });
  });

// Traffic type delete
deleteCmd
  .command('traffic-type <traffic-type-id>')
  .description('Delete a traffic type (requires traffic type ID, not name)')
  .requiredOption('-w, --workspace <id>', 'Workspace ID')
  .option('--api-key <key>', 'Split.io API key (or use SPLIT_API_KEY env var)')
  .option('--base-url <url>', 'Split.io API base URL (default: https://api.split.io/internal/api/v2)')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .option('--non-interactive', 'Skip confirmation prompts (for CI/scripted usage)')
  .option('--ignore-errors', 'Continue on errors and exit 0 (best-effort cleanup)')
  .option('--debug', 'Enable debug logging')
  .showHelpAfterError()
  .action(async (trafficTypeId: string, options: CommonOptions) => {
    await executeDelete('traffic-type', trafficTypeId, {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      workspace: options.workspace,
      cascade: false, // Traffic types don't cascade
      dryRun: options.dryRun || false,
      nonInteractive: options.nonInteractive || false,
      ignoreErrors: options.ignoreErrors || false,
      debug: options.debug || false,
    });
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
