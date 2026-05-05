/**
 * Service for orchestrating cascading deletes of Split.io resources
 */

import { SplitApi } from '../api/SplitApi';
import { confirmDeletion } from '../utils/stdin';
import { DeletionReport } from './DeletionReport';
import {
  ResourceType,
  DeleteTreeNode,
} from '../types/split';
import { DeleteOptions } from '../types/config';

export class DeleteService {
  constructor(
    private readonly api: SplitApi,
    private readonly workspaceId: string
  ) {}

  /**
   * Delete a resource with optional cascading
   */
  async deleteResource(
    type: ResourceType,
    identifier: string,
    options: DeleteOptions
  ): Promise<boolean> {
    // First, look up the resource to get its name and verify it exists
    const resourceInfo = await this.lookupResource(type, identifier);

    if (!resourceInfo) {
      console.error(`${this.formatResourceType(type)} '${identifier}' not found.`);
      return false;
    }

    // Build the deletion tree
    const tree = await this.buildDeletionTree(type, identifier, options.cascade, resourceInfo.name);

    if (!tree) {
      console.error(`Unable to build deletion tree for ${this.formatResourceType(type)} '${resourceInfo.name}'.`);
      return false;
    }

    // Show the deletion tree and get confirmation
    if (options.yes) {
      const message = this.formatDeletionTree(tree, options.cascade);
      console.log(message);
    } else {
      const confirmed = await this.confirmDeletion(tree, options.cascade);
      if (!confirmed) {
        console.log('Deletion cancelled.');
        return false;
      }
    }

    // Execute the deletion
    const report = new DeletionReport();
    await this.executeDeletion(tree, !!options.skipOnError, report);
    report.print();
    return !report.hadFailures;
  }

  /**
   * Look up a resource to get its name and verify it exists
   */
  private async lookupResource(
    type: ResourceType,
    identifier: string
  ): Promise<{ name: string; id: string } | null> {
    try {
      switch (type) {
        case 'workspace': {
          const workspace = await this.api.getWorkspace(identifier);
          if (!workspace || !workspace.id) {
            return null;
          }
          // Use name if available, otherwise fall back to ID
          const name = workspace.name || workspace.id;
          return { name, id: workspace.id };
        }
        case 'environment': {
          const environment = await this.api.getEnvironment(this.workspaceId, identifier);
          if (!environment || !environment.id) {
            return null;
          }
          const name = environment.name || environment.id;
          return { name, id: environment.id };
        }
        case 'traffic-type': {
          const trafficType = await this.api.getTrafficType(this.workspaceId, identifier);
          if (!trafficType || !trafficType.id) {
            return null;
          }
          const name = trafficType.name || trafficType.id;
          return { name, id: trafficType.id };
        }
        case 'split': {
          const split = await this.api.getSplit(this.workspaceId, identifier);
          if (!split || !split.name) {
            return null;
          }
          return { name: split.name, id: split.name };
        }
        case 'segment': {
          const segment = await this.api.getSegment(this.workspaceId, identifier);
          if (!segment || !segment.name) {
            return null;
          }
          return { name: segment.name, id: segment.name };
        }
        case 'large-segment': {
          const segment = await this.api.getLargeSegment(this.workspaceId, identifier);
          if (!segment || !segment.name) {
            return null;
          }
          return { name: segment.name, id: segment.name };
        }
        case 'rule-based-segment': {
          const segment = await this.api.getRuleBasedSegment(this.workspaceId, identifier);
          if (!segment || !segment.name) {
            return null;
          }
          return { name: segment.name, id: segment.name };
        }
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error looking up ${type}:`, error);
      return null;
    }
  }

  /**
   * Build a tree of resources to be deleted
   */
  private async buildDeletionTree(
    type: ResourceType,
    identifier: string,
    cascade: boolean,
    displayName: string
  ): Promise<DeleteTreeNode | null> {
    const node: DeleteTreeNode = {
      type,
      name: displayName,
      id: identifier,
      children: [],
    };

    // If cascade is disabled, check if the resource has children and fail if it does
    if (!cascade) {
      const hasChildren = await this.hasChildren(type, identifier);
      if (hasChildren) {
        throw new Error(
          `Cannot delete ${this.formatResourceType(type)} '${displayName}' because it has child resources. Use --cascade to delete all children.`
        );
      }
      return node;
    }

    // Build children based on resource type
    switch (type) {
      case 'workspace':
        node.children = await this.buildWorkspaceChildren(identifier);
        break;
      case 'environment':
        node.children = await this.buildEnvironmentChildren(identifier);
        break;
      case 'split':
        node.children = await this.buildSplitChildren(identifier);
        break;
      case 'segment':
        node.children = await this.buildSegmentChildren(identifier, 'segment');
        break;
      case 'large-segment':
        node.children = await this.buildSegmentChildren(identifier, 'large-segment');
        break;
      case 'rule-based-segment':
        node.children = await this.buildSegmentChildren(identifier, 'rule-based-segment');
        break;
      case 'traffic-type':
        // Traffic types don't cascade
        break;
    }

    return node;
  }

  /**
   * Check if a resource has children
   */
  private async hasChildren(type: ResourceType, name: string): Promise<boolean> {
    switch (type) {
      case 'workspace':
        return await this.workspaceHasChildren(name);
      case 'environment':
        return await this.environmentHasChildren(name);
      case 'split':
        return await this.splitHasChildren(name);
      case 'segment':
        return await this.segmentHasKeys(name, 'segments');
      case 'large-segment':
        return await this.segmentHasKeys(name, 'large-segments');
      case 'rule-based-segment':
        return await this.ruleBasedSegmentHasRules(name);
      default:
        return false;
    }
  }

  /**
   * Check if workspace has children
   */
  private async workspaceHasChildren(workspaceId: string): Promise<boolean> {
    const [environments, trafficTypes, splits, segments, largeSegments, ruleBasedSegments] = await Promise.all([
      this.api.listEnvironments(workspaceId),
      this.api.listTrafficTypes(workspaceId),
      this.api.listSplits(workspaceId),
      this.api.listSegments(workspaceId),
      this.api.listLargeSegments(workspaceId),
      this.api.listRuleBasedSegments(workspaceId),
    ]);

    return (
      environments.length > 0 ||
      trafficTypes.length > 0 ||
      splits.length > 0 ||
      segments.length > 0 ||
      largeSegments.length > 0 ||
      ruleBasedSegments.length > 0
    );
  }

  /**
   * Check if environment has children
   */
  private async environmentHasChildren(environmentId: string): Promise<boolean> {
    // Get all splits and check if any have definitions in this environment
    const splits = await this.api.listSplits(this.workspaceId);

    for (const split of splits) {
      const definitions = await this.api.listSplitDefinitions(this.workspaceId, split.name);
      const hasDefinitionInEnv = definitions.some(
        (def) => def.environment?.name === environmentId
      );
      if (hasDefinitionInEnv) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if split has children (definitions)
   */
  private async splitHasChildren(splitName: string): Promise<boolean> {
    const definitions = await this.api.listSplitDefinitions(this.workspaceId, splitName);
    return definitions.length > 0;
  }

  /**
   * Check if segment has keys
   */
  private async segmentHasKeys(segmentName: string, type: 'segments' | 'large-segments'): Promise<boolean> {
    const keys =
      type === 'segments'
        ? await this.api.getSegmentKeys(this.workspaceId, segmentName)
        : await this.api.getLargeSegmentKeys(this.workspaceId, segmentName);
    return keys.length > 0;
  }

  /**
   * Check if rule-based segment has rules
   */
  private async ruleBasedSegmentHasRules(segmentName: string): Promise<boolean> {
    const segment = await this.api.getRuleBasedSegment(this.workspaceId, segmentName);
    return segment ? (segment.rules?.length || 0) > 0 : false;
  }

  /**
   * Build children for workspace deletion
   */
  private async buildWorkspaceChildren(workspaceId: string): Promise<DeleteTreeNode[]> {
    const children: DeleteTreeNode[] = [];

    // Fetch all child resources
    const [environments, trafficTypes, splits, segments, largeSegments, ruleBasedSegments] = await Promise.all([
      this.api.listEnvironments(workspaceId),
      this.api.listTrafficTypes(workspaceId),
      this.api.listSplits(workspaceId),
      this.api.listSegments(workspaceId),
      this.api.listLargeSegments(workspaceId),
      this.api.listRuleBasedSegments(workspaceId),
    ]);

    // Add splits (with their definitions)
    // Splits are deleted first (along with their environment definitions)
    for (const split of splits) {
      const splitNode: DeleteTreeNode = {
        type: 'split',
        name: split.name,
        children: await this.buildSplitChildren(split.name),
      };
      children.push(splitNode);
    }

    // Add segments (with their environment definitions)
    // Segments must be deleted before environments
    for (const segment of segments) {
      children.push({
        type: 'segment',
        name: segment.name,
        children: await this.buildSegmentChildren(segment.name, 'segment'),
      });
    }

    // Add large segments (with their environment definitions)
    for (const segment of largeSegments) {
      children.push({
        type: 'large-segment',
        name: segment.name,
        children: await this.buildSegmentChildren(segment.name, 'large-segment'),
      });
    }

    // Add rule-based segments (with their environment definitions)
    for (const segment of ruleBasedSegments) {
      children.push({
        type: 'rule-based-segment',
        name: segment.name,
        children: await this.buildSegmentChildren(segment.name, 'rule-based-segment'),
      });
    }

    // Add environments
    // Environments are deleted after segments and splits
    for (const env of environments) {
      children.push({
        type: 'environment',
        name: env.name,
        id: env.id,
        children: await this.buildEnvironmentChildren(env.id),
      });
    }

    // Add traffic types
    // Traffic types are deleted last
    for (const tt of trafficTypes) {
      children.push({
        type: 'traffic-type',
        name: tt.name,
        id: tt.id,
        children: [],
      });
    }

    return children;
  }

  /**
   * Build children for environment deletion
   */
  private async buildEnvironmentChildren(environmentId: string): Promise<DeleteTreeNode[]> {
    const children: DeleteTreeNode[] = [];

    // Note: We don't list API tokens here because there's no reliable endpoint to list them.
    // Instead, the deleteEnvironment method will handle API token deletion automatically
    // by parsing the error message if the environment has associated tokens.

    // Note: We don't list segments here either, because segment definitions are shown
    // as children of the segments themselves (at the workspace level), not as children
    // of environments. This avoids duplication in the tree.

    // Get all splits and their definitions in this environment
    const splits = await this.api.listSplits(this.workspaceId);

    for (const split of splits) {
      const definitions = await this.api.listSplitDefinitions(this.workspaceId, split.name);
      const defsInEnv = definitions.filter((def) =>
        def.environment?.name === environmentId || def.environment?.id === environmentId
      );

      if (defsInEnv.length > 0) {
        children.push({
          type: 'split',
          name: `${split.name} (definition)`,
          children: [],
        });
      }
    }

    return children;
  }

  /**
   * Build children for split deletion
   */
  private async buildSplitChildren(splitName: string): Promise<DeleteTreeNode[]> {
    const children: DeleteTreeNode[] = [];

    // Get all definitions for this split
    const definitions = await this.api.listSplitDefinitions(this.workspaceId, splitName);

    for (const def of definitions) {
      const envName = def.environment?.name || 'unknown';
      children.push({
        type: 'split',
        name: `definition in ${envName}`,
        children: [],
      });
    }

    return children;
  }

  /**
   * Build children for segment deletion
   */
  private async buildSegmentChildren(
    segmentName: string,
    segmentType: 'segment' | 'large-segment' | 'rule-based-segment'
  ): Promise<DeleteTreeNode[]> {
    const children: DeleteTreeNode[] = [];

    // Get all environments and check which ones contain this segment
    const environments = await this.api.listEnvironments(this.workspaceId);

    for (const env of environments) {
      // Fetch segments for this environment to check if our segment exists in it
      let envSegments: any[] = [];
      if (segmentType === 'segment') {
        envSegments = await this.api.listSegments(this.workspaceId);
      } else if (segmentType === 'large-segment') {
        envSegments = await this.api.listLargeSegments(this.workspaceId);
      } else if (segmentType === 'rule-based-segment') {
        envSegments = await this.api.listRuleBasedSegments(this.workspaceId);
      }

      // Since listSegments returns deduplicated segments across all environments,
      // we need to check if this segment exists. For now, we'll assume it exists
      // in all environments (the API will fail gracefully if it doesn't)
      // TODO: Need a better way to determine which environments contain the segment
      const segmentExists = envSegments.some(s => s.name === segmentName);

      if (segmentExists) {
        children.push({
          type: segmentType,
          name: `${segmentName} in environment ${env.name}`,
          id: env.id,
          children: [],
        });
      }
    }

    return children;
  }

  /**
   * Show deletion tree and get user confirmation
   */
  private async confirmDeletion(tree: DeleteTreeNode, cascade: boolean): Promise<boolean> {
    const message = this.formatDeletionTree(tree, cascade);
    return await confirmDeletion(message);
  }

  /**
   * Format deletion tree as a string for display
   */
  private formatDeletionTree(node: DeleteTreeNode, cascade: boolean, indent: string = ''): string {
    let output = '';

    if (indent === '') {
      output += '⚠️  The following resources will be deleted:\n\n';
    }

    // Show both name and ID if they differ (for workspaces, environments, traffic types)
    const displayText = node.id && node.id !== node.name
      ? `${node.name} (${node.id})`
      : node.name;

    output += `${indent}${this.getResourceIcon(node.type)} ${this.formatResourceType(node.type)}: ${displayText}\n`;

    if (node.children.length > 0) {
      for (const child of node.children) {
        output += this.formatDeletionTree(child, cascade, indent + '  ');
      }
    }

    return output;
  }

  /**
   * Get icon for resource type
   */
  private getResourceIcon(type: ResourceType): string {
    const icons: Record<ResourceType, string> = {
      'workspace': '🗂️',
      'environment': '🌍',
      'split': '🚩',
      'segment': '📦',
      'large-segment': '📦',
      'rule-based-segment': '📦',
      'traffic-type': '🚦',
      'api-token': '🔑',
    };
    return icons[type] || '📄';
  }

  /**
   * Format resource type for display
   */
  private formatResourceType(type: ResourceType): string {
    const formatted: Record<ResourceType, string> = {
      'workspace': 'Workspace',
      'environment': 'Environment',
      'split': 'Split',
      'segment': 'Segment',
      'large-segment': 'Large Segment',
      'rule-based-segment': 'Rule-Based Segment',
      'traffic-type': 'Traffic Type',
      'api-token': 'API Token',
    };
    return formatted[type] || type;
  }

  /**
   * Execute deletion of the tree (children first, parent last)
   */
  private async executeDeletion(node: DeleteTreeNode, skipOnError: boolean, report: DeletionReport): Promise<boolean> {
    for (const child of node.children) {
      const success = await this.executeDeletion(child, skipOnError, report);
      if (!success && !skipOnError) {
        return false;
      }
    }

    const success = await this.deleteNode(node);
    report.record(node.type, node.name, success, success ? undefined : 'deletion failed');

    if (!success && !skipOnError) {
      return false;
    }

    return true;
  }

  /**
   * Delete a single node
   */
  private async deleteNode(node: DeleteTreeNode): Promise<boolean> {
    try {
      const nodeId = node.id || node.name;

      switch (node.type) {
        case 'workspace':
          return await this.api.deleteWorkspace(nodeId);
        case 'environment':
          return await this.api.deleteEnvironment(this.workspaceId, nodeId);
        case 'traffic-type':
          return await this.api.deleteTrafficType(this.workspaceId, nodeId);
        case 'split':
          // Check if this is a definition or the split itself
          if (node.name.includes('definition in')) {
            // Extract environment name from "definition in <env>"
            const envMatch = node.name.match(/definition in (.+)/);
            const envName = envMatch?.[1];
            if (!envName) {
              console.error(`Failed to extract environment name from: ${node.name}`);
              return false;
            }
            const splitName = node.name.split(' (definition)')[0];
            if (!splitName) {
              console.error(`Failed to extract split name from: ${node.name}`);
              return false;
            }
            return await this.api.deleteSplitDefinition(this.workspaceId, envName, splitName);
          } else {
            return await this.api.deleteSplit(this.workspaceId, node.name);
          }
        case 'segment':
          // Check if this is a segment in an environment or the segment itself
          if (node.name.includes(' in environment ')) {
            // Extract segment name and environment ID
            const match = node.name.match(/^(.+) in environment .+$/);
            const segmentName = match?.[1];
            const envId = node.id;

            if (!segmentName || !envId) {
              console.error(`Failed to extract segment name or environment ID from: ${node.name}`);
              return false;
            }

            return await this.api.deleteSegmentFromEnvironment(this.workspaceId, envId, segmentName);
          } else {
            // Delete workspace-level segment metadata after all environment definitions are deleted
            return await this.api.deleteSegment(this.workspaceId, node.name);
          }
        case 'large-segment':
          // Check if this is a large segment in an environment or the segment itself
          if (node.name.includes(' in environment ')) {
            // Extract segment name and environment ID
            const match = node.name.match(/^(.+) in environment .+$/);
            const segmentName = match?.[1];
            const envId = node.id;

            if (!segmentName || !envId) {
              console.error(`Failed to extract segment name or environment ID from: ${node.name}`);
              return false;
            }

            return await this.api.deleteLargeSegmentFromEnvironment(this.workspaceId, envId, segmentName);
          } else {
            // Delete workspace-level large segment metadata after all environment definitions are deleted
            return await this.api.deleteLargeSegment(this.workspaceId, node.name);
          }
        case 'rule-based-segment':
          // Check if this is a rule-based segment in an environment or the segment itself
          if (node.name.includes(' in environment ')) {
            // Extract segment name and environment ID
            const match = node.name.match(/^(.+) in environment .+$/);
            const segmentName = match?.[1];
            const envId = node.id;

            if (!segmentName || !envId) {
              console.error(`Failed to extract segment name or environment ID from: ${node.name}`);
              return false;
            }

            return await this.api.deleteRuleBasedSegmentFromEnvironment(this.workspaceId, envId, segmentName);
          } else {
            // Delete workspace-level rule-based segment metadata after all environment definitions are deleted
            return await this.api.deleteRuleBasedSegment(this.workspaceId, node.name);
          }
        default:
          console.error(`Unknown resource type: ${node.type}`);
          return false;
      }
    } catch (error) {
      console.error(`Error deleting ${node.type} '${node.name}':`, error);
      return false;
    }
  }
}
