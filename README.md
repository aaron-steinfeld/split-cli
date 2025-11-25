# Split CLI

A command-line tool for managing Split.io resources with cascading delete support.

## Features

- **Cascading Deletes**: Automatically delete child resources when deleting a parent
- **Safety First**: Prevents accidental deletions by requiring explicit `--cascade` flag for resources with children
- **Dry-Run Mode**: Preview what will be deleted before executing
- **Debug Logging**: Detailed API request/response logging with sanitized credentials
- **Interactive Confirmations**: Review and confirm deletions before they execute
- **Modern Architecture**: Built with TypeScript, commander.js, and follows best practices from data-migration-cli

## Supported Resource Types

- **Workspaces**: Delete entire workspaces with all their contents
- **Environments**: Delete environments and their associated split definitions
- **Feature Flags (Splits)**: Delete splits and their definitions across environments
- **Segments**: Delete regular segments including their keys
- **Large Segments**: Delete large segments including their keys
- **Rule-Based Segments**: Delete rule-based segments including their rules
- **Traffic Types**: Delete traffic types

## Installation

```bash
npm install
npm run build
```

## Usage

### Authentication

Provide your Split.io API key either via environment variable or command-line option:

```bash
export SPLIT_API_KEY="your-api-key"
```

Or use the `--api-key` flag:

```bash
split-cli delete workspace ws_abc123 --api-key "your-api-key"
```

### Basic Command Structure

```bash
split-cli delete <resource-type> <identifier> [options]
```

**Important:** Different resources use different identifiers:
- **Workspace** - requires workspace ID (e.g., `ws_abc123`)
- **Environment** - accepts environment name OR ID (e.g., `Production` or `env_xyz789`)
- **Traffic Type** - requires traffic type ID (e.g., `tt_user123`)
- **Split** - uses feature flag name (e.g., `my-feature-flag`)
- **Segments** - use segment name (e.g., `beta-users`)

### Delete Operations

#### Delete a Workspace

**Note:** Requires workspace ID, not name.

```bash
# Delete workspace metadata only (fails if contains resources)
split-cli delete workspace ws_abc123

# Delete workspace and ALL its contents (flags, segments, environments, traffic types)
split-cli delete workspace ws_abc123 --cascade
```

#### Delete an Environment

**Note:** Accepts environment name or ID.

```bash
# Delete environment metadata only (fails if has resources)
split-cli delete environment Production -w ws_abc123

# Delete environment and all split definitions in it
split-cli delete environment Production -w ws_abc123 --cascade

# Or use environment ID
split-cli delete environment env_xyz789 -w ws_abc123 --cascade
```

#### Delete a Feature Flag (Split)

**Note:** Uses feature flag name, not ID.

```bash
# Delete split metadata only (fails if has definitions)
split-cli delete split my-feature -w ws_abc123

# Delete split and all its definitions across all environments
split-cli delete split my-feature -w ws_abc123 --cascade
```

#### Delete a Segment

**Note:** Uses segment name, not ID.

```bash
# Delete segment (fails if has keys)
split-cli delete segment beta-users -w ws_abc123

# Delete segment including all keys
split-cli delete segment beta-users -w ws_abc123 --cascade
```

#### Delete a Large Segment

**Note:** Uses segment name, not ID.

```bash
# Delete large segment (fails if has keys)
split-cli delete large-segment enterprise-customers -w ws_abc123

# Delete large segment including all keys
split-cli delete large-segment enterprise-customers -w ws_abc123 --cascade
```

#### Delete a Rule-Based Segment

**Note:** Uses segment name, not ID.

```bash
# Delete rule-based segment (fails if has rules)
split-cli delete rule-based-segment power-users -w ws_abc123

# Delete rule-based segment including all rules
split-cli delete rule-based-segment power-users -w ws_abc123 --cascade
```

#### Delete a Traffic Type

**Note:** Requires traffic type ID, not name.

```bash
split-cli delete traffic-type tt_user123 -w ws_abc123
```

### Options

#### Global Options

- `--api-key <key>`: Split.io API key (or use `SPLIT_API_KEY` env var)
- `--base-url <url>`: Split.io API base URL (default: `https://api.split.io/internal/api/v2`)
- `-w, --workspace <id>`: Workspace ID (required for most commands)
- `--cascade`: Delete all child resources (default: false)
- `--dry-run`: Preview what would be deleted without actually deleting
- `--debug`: Enable debug logging with detailed API request/response information

### Examples

#### Preview Workspace Deletion

```bash
# See what would be deleted without actually deleting
split-cli delete workspace ws_old123 --cascade --dry-run
```

#### Debug Mode

```bash
# Enable detailed logging to troubleshoot API issues
split-cli delete split my-feature -w ws_abc123 --debug
```

#### Custom API Base URL

```bash
# Use a custom Split.io API base URL (e.g., for different regions or environments)
split-cli delete workspace ws_abc123 --base-url https://api.custom.split.io/internal/api/v2 --cascade
```

#### Complete Workspace Cleanup

```bash
# Delete everything in a workspace (requires workspace ID)
split-cli delete workspace ws_old123 --cascade
```

This will:
1. List all resources to be deleted in a tree structure
2. Ask for confirmation
3. Delete resources in the correct order:
   - Split definitions (in each environment)
   - Splits (feature flags)
   - Segments (all types)
   - Environments
   - Traffic types
   - Workspace

## Cascading Delete Behavior

### With `--cascade` Flag

| Resource Type | What Gets Deleted |
|--------------|-------------------|
| Workspace | All splits, segments (all types), environments, and traffic types |
| Environment | All split definitions in that environment |
| Split | All definitions across all environments |
| Segment | The segment including all keys |
| Large Segment | The large segment including all keys |
| Rule-Based Segment | The rule-based segment including all rules |
| Traffic Type | The traffic type only |

### Without `--cascade` Flag

All resource deletions will **fail** if the resource has any child resources or data:
- Workspace: Fails if contains any flags, segments, environments, or traffic types
- Environment: Fails if has any split definitions or segments
- Split: Fails if has any definitions in any environment
- Segment: Fails if has any keys
- Large Segment: Fails if has any keys
- Rule-Based Segment: Fails if has any rules
- Traffic Type: Can be deleted if not referenced

## Safety Features

1. **Explicit Cascade Requirement**: You must explicitly use `--cascade` to delete resources with children
2. **Interactive Confirmation**: Shows a tree of all resources to be deleted and requires confirmation
3. **Dry-Run Mode**: Test deletions without making changes
4. **Error Handling**: Interactive prompts to retry, skip, or abort on errors
5. **Sanitized Logging**: API keys are never shown in debug logs

## Architecture

The CLI follows the architecture and patterns from the data-migration-cli:

```
src/
├── api/                      # API layer
│   ├── BaseApi.ts           # Abstract base with common HTTP logic
│   ├── SplitApi.ts          # Interface definition
│   ├── LegacySplitApi.ts    # Split.io API implementation
│   └── ApiErrorHandler.ts   # Error handling utilities
├── services/                 # Business logic layer
│   └── DeleteService.ts     # Orchestrates cascading deletes
├── types/                    # TypeScript type definitions
│   ├── config.ts            # Configuration types
│   └── split.ts             # Domain model types
├── utils/                    # Utility functions
│   └── stdin.ts             # User input utilities
└── index.ts                  # CLI entry point
```

## Technology Stack

- **TypeScript 5.3+** with maximum strictness enabled
- **Commander.js 13+** for CLI framework
- **Axios 1.9+** for HTTP requests
- **Node.js** runtime

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev -- delete workspace my-workspace --dry-run

# Clean build artifacts
npm run clean
```

## Contributing

When adding new features:
1. Follow the existing architecture patterns
2. Maintain TypeScript strict mode compliance
3. Add appropriate error handling
4. Update this README with new features

## License

[Add your license here]
