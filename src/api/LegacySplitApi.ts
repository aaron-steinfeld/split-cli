/**
 * Implementation of Split.io API v2 operations
 */

import { AxiosRequestConfig } from 'axios';
import { BaseApi } from './BaseApi';
import {
  Workspace,
  Environment,
  TrafficType,
  Split,
  SplitDefinition,
  Segment,
  LargeSegment,
  RuleBasedSegment,
  PagedResponse,
  ApiToken,
} from '../types/split';

const DEFAULT_SPLIT_API_BASE = 'https://api.split.io/internal/api/v2';

export class LegacySplitApi extends BaseApi {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = DEFAULT_SPLIT_API_BASE, debug: boolean = false, dryRun: boolean = false) {
    super(debug, dryRun);
    this.apiKey = apiKey.trim();
    this.baseUrl = baseUrl;
  }

  protected getBaseUrl(): string {
    return this.baseUrl;
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  // Workspace operations
  async listWorkspaces(): Promise<Workspace[]> {
    this.logApiOperation('*** LIST WORKSPACES ***');
    const workspaces = await this.fetchAllPaginated<Workspace>('workspaces');
    return workspaces;
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    this.logApiOperation(`*** GET WORKSPACE ${workspaceId} ***`);

    try {
      // The API doesn't support getting a single workspace by ID
      // We need to list all workspaces and find the matching one
      const workspaces = await this.listWorkspaces();
      const workspace = workspaces.find(ws => ws.id === workspaceId);
      return workspace || null;
    } catch (error) {
      return null;
    }
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    this.logApiOperation(`*** DELETE WORKSPACE ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `workspaces/${workspaceId}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Workspace '${workspaceId}' deleted successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Environment operations
  async listEnvironments(workspaceId: string): Promise<Environment[]> {
    this.logApiOperation(`*** LIST ENVIRONMENTS for workspace ${workspaceId} ***`);
    const environments = await this.fetchAllPaginated<Environment>(
      `environments/ws/${workspaceId}`
    );
    return environments;
  }

  async getEnvironment(workspaceId: string, environmentId: string): Promise<Environment | null> {
    this.logApiOperation(`*** GET ENVIRONMENT ${environmentId} for workspace ${workspaceId} ***`);

    try {
      // The API doesn't support getting a single environment by ID
      // We need to list all environments and find the matching one
      const environments = await this.listEnvironments(workspaceId);
      const environment = environments.find(env => env.id === environmentId || env.name === environmentId);
      return environment || null;
    } catch (error) {
      return null;
    }
  }

  async deleteEnvironment(workspaceId: string, environmentId: string): Promise<boolean> {
    this.logApiOperation(`*** DELETE ENVIRONMENT ${environmentId} for workspace ${workspaceId} ***`);

    const requestConfig: AxiosRequestConfig = {
      method: 'delete',
      url: `environments/ws/${workspaceId}/${environmentId}`,
    };

    try {
      await this.request<any>(requestConfig);
      console.log(`Environment '${environmentId}' deleted successfully.`);
      return true;
    } catch (error: any) {
      // Check if error is due to associated API tokens
      if (error?.message && error.message.includes('has apitokens associated')) {
        // Extract token IDs from error message
        // Format: "has apitokens associated [token1, token2, ...]"
        const match = error.message.match(/has apitokens associated \[([^\]]+)\]/);
        if (match) {
          const tokenIds = match[1].split(',').map((id: string) => id.trim());
          console.log(`Environment has ${tokenIds.length} API token(s). Deleting them first...`);

          // Delete each token
          for (const tokenId of tokenIds) {
            const deleted = await this.deleteApiToken(environmentId, tokenId);
            if (!deleted) {
              console.error(`Failed to delete API token '${tokenId}'`);
              return false;
            }
          }

          // Retry environment deletion
          console.log(`Retrying environment deletion...`);
          try {
            await this.request<any>(requestConfig);
            console.log(`Environment '${environmentId}' deleted successfully.`);
            return true;
          } catch (retryError) {
            console.error(`Failed to delete environment after removing API tokens`);
            return false;
          }
        }
      }

      return false;
    }
  }

  // Traffic Type operations
  async listTrafficTypes(workspaceId: string): Promise<TrafficType[]> {
    this.logApiOperation(`*** LIST TRAFFIC TYPES for workspace ${workspaceId} ***`);
    const trafficTypes = await this.fetchAllPaginated<TrafficType>(
      `trafficTypes/ws/${workspaceId}`
    );
    return trafficTypes;
  }

  async getTrafficType(_workspaceId: string, trafficTypeId: string): Promise<TrafficType | null> {
    this.logApiOperation(`*** GET TRAFFIC TYPE ${trafficTypeId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `trafficTypes/${trafficTypeId}`,
      };

      const trafficType = await this.request<TrafficType>(requestConfig);
      return trafficType;
    } catch (error) {
      return null;
    }
  }

  async deleteTrafficType(_workspaceId: string, trafficTypeId: string): Promise<boolean> {
    this.logApiOperation(`*** DELETE TRAFFIC TYPE ${trafficTypeId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `trafficTypes/${trafficTypeId}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Traffic type '${trafficTypeId}' deleted successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Split (Feature Flag) operations
  async listSplits(workspaceId: string, _trafficType: string = 'user'): Promise<Split[]> {
    this.logApiOperation(`*** LIST SPLITS for workspace ${workspaceId} ***`);
    const splits = await this.fetchAllPaginated<Split>(
      `splits/ws/${workspaceId}`
    );
    return splits;
  }

  async getSplit(workspaceId: string, splitName: string): Promise<Split | null> {
    this.logApiOperation(`*** GET SPLIT ${splitName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `splits/ws/${workspaceId}/${splitName}`,
      };

      const split = await this.request<Split>(requestConfig);
      return split;
    } catch (error) {
      return null;
    }
  }

  async listSplitDefinitions(workspaceId: string, splitName: string): Promise<SplitDefinition[]> {
    this.logApiOperation(`*** LIST SPLIT DEFINITIONS for ${splitName} in workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `splits/ws/${workspaceId}/${splitName}/definitions`,
      };

      const response = await this.request<PagedResponse<SplitDefinition> | SplitDefinition[]>(requestConfig);

      if (Array.isArray(response)) {
        return response;
      } else if (response.objects) {
        return response.objects;
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  async deleteSplit(workspaceId: string, splitName: string, _trafficType: string = 'user'): Promise<boolean> {
    this.logApiOperation(`*** DELETE SPLIT ${splitName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `splits/ws/${workspaceId}/${splitName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Split '${splitName}' deleted successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteSplitDefinition(
    _workspaceId: string,
    environmentName: string,
    splitName: string
  ): Promise<boolean> {
    this.logApiOperation(`*** DELETE SPLIT DEFINITION ${splitName} in environment ${environmentName} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `splits/${environmentName}/${splitName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Split definition '${splitName}' deleted from environment '${environmentName}' successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Segment operations (regular)
  async listSegments(workspaceId: string, _trafficType: string = 'user'): Promise<Segment[]> {
    this.logApiOperation(`*** LIST SEGMENTS for workspace ${workspaceId} ***`);

    // Segments are scoped to environments, so we need to list all environments first
    // and then get segments from each environment
    const environments = await this.listEnvironments(workspaceId);
    const allSegments: Segment[] = [];
    const seenSegments = new Set<string>();

    for (const env of environments) {
      const envSegments = await this.fetchAllPaginated<Segment>(
        `segments/ws/${workspaceId}/environments/${env.id}`
      );

      // Deduplicate segments by name (same segment can exist in multiple environments)
      for (const segment of envSegments) {
        if (!seenSegments.has(segment.name)) {
          seenSegments.add(segment.name);
          allSegments.push(segment);
        }
      }
    }

    return allSegments;
  }

  async getSegment(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<Segment | null> {
    this.logApiOperation(`*** GET SEGMENT ${segmentName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `segments/ws/${workspaceId}/${segmentName}`,
      };

      const segment = await this.request<Segment>(requestConfig);
      return segment;
    } catch (error) {
      return null;
    }
  }

  async getSegmentKeys(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<string[]> {
    this.logApiOperation(`*** GET SEGMENT KEYS for ${segmentName} in workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `segments/ws/${workspaceId}/${segmentName}/keys`,
      };

      const response = await this.request<{ keys: string[] }>(requestConfig);
      return response.keys || [];
    } catch (error) {
      return [];
    }
  }

  async deleteSegment(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<boolean> {
    this.logApiOperation(`*** DELETE SEGMENT ${segmentName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `segments/ws/${workspaceId}/${segmentName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Segment '${segmentName}' deleted successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async removeSegmentKeys(environmentId: string, segmentName: string, keys: string[]): Promise<boolean> {
    this.logApiOperation(`*** REMOVE ${keys.length} KEYS from segment ${segmentName} in environment ${environmentId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'put',
        url: `segments/${environmentId}/${segmentName}/uploadKeys?replace=true`,
        data: {
          keys: [],
          comment: 'Removing all segment keys for deletion'
        },
      };

      await this.request<any>(requestConfig);
      console.log(`Removed all keys from segment '${segmentName}' in environment '${environmentId}'.`);
      return true;
    } catch (error: any) {
      // If segment doesn't exist in this environment, nothing to remove
      if (error?.status === 404) {
        if (this.debug) {
          console.log(`Segment '${segmentName}' does not exist in environment '${environmentId}' - skipping key removal.`);
        }
        return true;
      }
      return false;
    }
  }

  async deleteSegmentFromEnvironment(_workspaceId: string, environmentId: string, segmentName: string): Promise<boolean> {
    this.logApiOperation(`*** DELETE SEGMENT ${segmentName} from environment ${environmentId} ***`);

    try {
      // First, remove all keys from this environment (using replace API with empty array)
      console.log(`Removing all keys from segment '${segmentName}' in environment '${environmentId}'...`);
      const removed = await this.removeSegmentKeys(environmentId, segmentName, []);
      if (!removed) {
        console.error(`Failed to remove keys from segment '${segmentName}'`);
        return false;
      }

      // Now delete the segment
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `segments/${environmentId}/${segmentName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Segment '${segmentName}' deleted from environment '${environmentId}' successfully.`);
      return true;
    } catch (error: any) {
      // If segment doesn't exist in this environment, that's fine - nothing to delete
      if (error?.status === 404) {
        if (this.debug) {
          console.log(`Segment '${segmentName}' does not exist in environment '${environmentId}' - skipping.`);
        }
        return true;
      }
      return false;
    }
  }

  // Large segment operations
  async listLargeSegments(workspaceId: string, _trafficType: string = 'user'): Promise<LargeSegment[]> {
    this.logApiOperation(`*** LIST LARGE SEGMENTS for workspace ${workspaceId} ***`);

    // Large segments are scoped to environments
    const environments = await this.listEnvironments(workspaceId);
    const allSegments: LargeSegment[] = [];
    const seenSegments = new Set<string>();

    for (const env of environments) {
      const envSegments = await this.fetchAllPaginated<LargeSegment>(
        `large-segments/ws/${workspaceId}/environments/${env.id}`
      );

      // Deduplicate segments by name
      for (const segment of envSegments) {
        if (!seenSegments.has(segment.name)) {
          seenSegments.add(segment.name);
          allSegments.push(segment);
        }
      }
    }

    return allSegments;
  }

  async getLargeSegment(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<LargeSegment | null> {
    this.logApiOperation(`*** GET LARGE SEGMENT ${segmentName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `large-segments/ws/${workspaceId}/${segmentName}`,
      };

      const segment = await this.request<LargeSegment>(requestConfig);
      return segment;
    } catch (error) {
      return null;
    }
  }

  async getLargeSegmentKeys(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<string[]> {
    this.logApiOperation(`*** GET LARGE SEGMENT KEYS for ${segmentName} in workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `large-segments/ws/${workspaceId}/${segmentName}/keys`,
      };

      const response = await this.request<{ keys: string[] }>(requestConfig);
      return response.keys || [];
    } catch (error) {
      return [];
    }
  }

  async deleteLargeSegment(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<boolean> {
    this.logApiOperation(`*** DELETE LARGE SEGMENT ${segmentName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `large-segments/ws/${workspaceId}/${segmentName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Large segment '${segmentName}' deleted successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async removeLargeSegmentKeys(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean> {
    this.logApiOperation(`*** REMOVE ALL KEYS from large segment ${segmentName} in environment ${environmentId} via change request ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'post',
        url: `changeRequests/ws/${workspaceId}/environments/${environmentId}`,
        data: {
          largeSegment: { name: segmentName },
          operationType: 'ARCHIVE',
          title: 'Archiving all user IDs (keys)',
          comment: 'Removing all keys from large segment for deletion',
          approvers: [],
        },
      };

      await this.request<any>(requestConfig);
      console.log(`Created change request to remove all keys from large segment '${segmentName}' in environment '${environmentId}'.`);
      return true;
    } catch (error: any) {
      // If large segment doesn't exist in this environment, nothing to remove
      if (error?.status === 404) {
        if (this.debug) {
          console.log(`Large segment '${segmentName}' does not exist in environment '${environmentId}' - skipping key removal.`);
        }
        return true;
      }
      return false;
    }
  }

  async deleteLargeSegmentFromEnvironment(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean> {
    this.logApiOperation(`*** DELETE LARGE SEGMENT ${segmentName} from environment ${environmentId} ***`);

    try {
      // First, create change request to remove all keys
      console.log(`Creating change request to remove all keys from large segment '${segmentName}' in environment '${environmentId}'...`);
      const removed = await this.removeLargeSegmentKeys(workspaceId, environmentId, segmentName);
      if (!removed) {
        console.error(`Failed to create change request to remove keys from large segment '${segmentName}' in environment '${environmentId}'`);
        return false;
      }

      // Wait for async key removal to complete
      console.log(`Waiting 5 seconds for key removal to complete...`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Now delete the large segment
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `large-segments/${environmentId}/${segmentName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Large segment '${segmentName}' deleted from environment '${environmentId}' successfully.`);
      return true;
    } catch (error: any) {
      // If large segment doesn't exist in this environment, that's fine - nothing to delete
      if (error?.status === 404) {
        if (this.debug) {
          console.log(`Large segment '${segmentName}' does not exist in environment '${environmentId}' - skipping.`);
        }
        return true;
      }
      return false;
    }
  }

  // Rule-based segment operations
  async listRuleBasedSegments(workspaceId: string, _trafficType: string = 'user'): Promise<RuleBasedSegment[]> {
    this.logApiOperation(`*** LIST RULE-BASED SEGMENTS for workspace ${workspaceId} ***`);

    // Rule-based segments are scoped to environments
    const environments = await this.listEnvironments(workspaceId);
    const allSegments: RuleBasedSegment[] = [];
    const seenSegments = new Set<string>();

    for (const env of environments) {
      const envSegments = await this.fetchAllPaginated<RuleBasedSegment>(
        `rule-based-segments/ws/${workspaceId}/environments/${env.id}`
      );

      // Deduplicate segments by name
      for (const segment of envSegments) {
        if (!seenSegments.has(segment.name)) {
          seenSegments.add(segment.name);
          allSegments.push(segment);
        }
      }
    }

    return allSegments;
  }

  async getRuleBasedSegment(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<RuleBasedSegment | null> {
    this.logApiOperation(`*** GET RULE-BASED SEGMENT ${segmentName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `rule-based-segments/ws/${workspaceId}/${segmentName}`,
      };

      const segment = await this.request<RuleBasedSegment>(requestConfig);
      return segment;
    } catch (error) {
      return null;
    }
  }

  async deleteRuleBasedSegment(workspaceId: string, segmentName: string, _trafficType: string = 'user'): Promise<boolean> {
    this.logApiOperation(`*** DELETE RULE-BASED SEGMENT ${segmentName} for workspace ${workspaceId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `rule-based-segments/ws/${workspaceId}/${segmentName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Rule-based segment '${segmentName}' deleted successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteRuleBasedSegmentFromEnvironment(_workspaceId: string, environmentId: string, segmentName: string): Promise<boolean> {
    this.logApiOperation(`*** DELETE RULE-BASED SEGMENT ${segmentName} from environment ${environmentId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `rule-based-segments/${environmentId}/${segmentName}`,
      };

      await this.request<any>(requestConfig);
      console.log(`Rule-based segment '${segmentName}' deleted from environment '${environmentId}' successfully.`);
      return true;
    } catch (error: any) {
      // If rule-based segment doesn't exist in this environment, that's fine - nothing to delete
      if (error?.status === 404) {
        if (this.debug) {
          console.log(`Rule-based segment '${segmentName}' does not exist in environment '${environmentId}' - skipping.`);
        }
        return true;
      }
      return false;
    }
  }

  // API Token operations
  async listApiTokens(environmentId: string): Promise<ApiToken[]> {
    this.logApiOperation(`*** LIST API TOKENS for environment ${environmentId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `apiKeys/query?environmentId=${environmentId}`,
      };

      const response = await this.request<PagedResponse<ApiToken> | ApiToken[]>(requestConfig);

      if (Array.isArray(response)) {
        return response;
      } else if (response.objects) {
        return response.objects;
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  async deleteApiToken(environmentId: string, tokenId: string): Promise<boolean> {
    this.logApiOperation(`*** DELETE API TOKEN ${tokenId} from environment ${environmentId} ***`);

    try {
      const requestConfig: AxiosRequestConfig = {
        method: 'delete',
        url: `apiKeys/${tokenId}`,
      };

      await this.request<any>(requestConfig);
      console.log(`API token '${tokenId}' deleted successfully.`);
      return true;
    } catch (error) {
      return false;
    }
  }
}
