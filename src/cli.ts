import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { LogLevel, SegmentInfo } from './types';
import { deleteSegment, listSegments } from './segments';
import { deleteEnvironment, listEnvironments } from './environments';
import { deleteFlag, listFlags } from './flags';
import { askConfirmation } from './utils';

async function listItems(apiKey: string, workspaceId: string, itemType: 'flag' | 'segment' | 'environment', logLevel = LogLevel.DEFAULT): Promise<string[] | SegmentInfo[]> {
  if (itemType === 'segment') {
    return await listSegments(apiKey, workspaceId, logLevel);
  }
  
  if (itemType === 'environment') {
    return await listEnvironments(apiKey, workspaceId, logLevel);
  }
  
  // Handle flags
  return await listFlags(apiKey, workspaceId, logLevel);
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('api-key', {
      type: 'string',
      description: 'Split Admin API Key (or set SPLIT_API_KEY env var)',
      demandOption: false,
    })
    .option('workspace-id', {
      type: 'string',
      description: 'Split workspace ID',
      demandOption: true,
    })
    .option('name', {
      type: 'string',
      description: 'Name of the flag, segment, or environment to delete',
      demandOption: false,
    })
    .option('type', {
      type: 'string',
      choices: ['flag', 'segment', 'environment'],
      description: 'Type of item to delete (flag, segment, or environment)',
      default: 'flag',
    })
    .option('all', {
      type: 'boolean',
      description: 'Delete all items of the specified type in the workspace',
      default: false,
    })
    .option('debug', {
      type: 'boolean',
      description: 'Enable debug logging',
      default: false,
    })
    .option('trace', {
      type: 'boolean',
      description: 'Enable trace logging (includes headers)',
      default: false,
    })
    .check(argv => {
      if (argv['all'] && argv['name']) {
        throw new Error('Cannot specify both --all and --name');
      }
      if (!argv['name'] && !argv['all']) {
        throw new Error('You must specify either --name or --all');
      }
      return true;
    })
    .help()
    .argv as any;

  const apiKey = argv['api-key'] || process.env.SPLIT_API_KEY;
  if (!apiKey) {
    console.error('Error: API key must be provided via --api-key or SPLIT_API_KEY env var.');
    process.exit(1);
  }

  const itemType = argv['type'] as 'flag' | 'segment' | 'environment';
  
  // Determine log level from flags
  let logLevel = LogLevel.DEFAULT;
  if (argv['debug']) logLevel = LogLevel.DEBUG;
  if (argv['trace']) logLevel = LogLevel.TRACE;
  
  if (argv['all']) {
    const items = await listItems(apiKey, argv['workspace-id'], itemType, logLevel);
    if (items.length === 0) {
      console.log(`No ${itemType}s found in workspace.`);
      return;
    }
    
    console.log(`Found ${items.length} ${itemType}s:`);
    if (itemType === 'segment') {
      const segmentItems = items as SegmentInfo[];
      segmentItems.forEach(segment => console.log(`- ${segment.name} (${segment.type})`));
    } else {
      const stringItems = items as string[];
      stringItems.forEach(item => console.log(`- ${item}`));
    }
    console.log();
    
    const confirmed = await askConfirmation(`Are you sure you want to delete all ${items.length} ${itemType}s? (y/N): `);
    if (!confirmed) {
      console.log('Deletion cancelled.');
      return;
    }
    
    console.log(`Deleting ${items.length} ${itemType}s...`);
    if (itemType === 'segment') {
      const segmentItems = items as SegmentInfo[];
      for (const segment of segmentItems) {
        await deleteSegment(apiKey, argv['workspace-id'], segment.name, segment.type, logLevel);
      }
    } else if (itemType === 'environment') {
      const envItems = items as string[];
      for (const itemName of envItems) {
        await deleteEnvironment(apiKey, argv['workspace-id'], itemName, logLevel);
      }
    } else {
      const flagItems = items as string[];
      for (const itemName of flagItems) {
        await deleteFlag(apiKey, argv['workspace-id'], itemName, logLevel);
      }
    }
    console.log(`All ${itemType}s processed.`);
  } else if (argv['name']) {
    const confirmed = await askConfirmation(`Are you sure you want to delete ${itemType} '${argv['name']}'? (y/N): `);
    if (!confirmed) {
      console.log('Deletion cancelled.');
      return;
    }
    
    if (itemType === 'segment') {
      await deleteSegment(apiKey, argv['workspace-id'], argv['name'], undefined, logLevel);
    } else if (itemType === 'environment') {
      await deleteEnvironment(apiKey, argv['workspace-id'], argv['name'], logLevel);
    } else {
      await deleteFlag(apiKey, argv['workspace-id'], argv['name'], logLevel);
    }
  }
}

main();
