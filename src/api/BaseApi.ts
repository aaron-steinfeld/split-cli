/**
 * Base API class with shared functionality for Split.io API operations
 *
 * Provides:
 * - Centralized HTTP request handling with axios
 * - Debug logging for API requests/responses with sanitized auth headers
 * - Dry-run mode support
 * - Pagination support for list operations
 * - Error handling with retry logic
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { SplitApi } from './SplitApi';
import {
  Workspace,
  Environment,
  Segment,
  RuleBasedSegment,
  LargeSegment,
  Split,
  SplitDefinition,
  TrafficType,
  PagedResponse,
  ApiToken,
} from '../types/split';

export abstract class BaseApi implements SplitApi {
  protected readonly debug: boolean;
  protected readonly dryRun: boolean;

  protected constructor(debug: boolean = false, dryRun: boolean = false) {
    this.debug = debug;
    this.dryRun = dryRun;
  }

  /**
   * Get the base URL for API requests
   */
  protected abstract getBaseUrl(): string;

  /**
   * Get headers for API requests
   */
  protected abstract getHeaders(): Record<string, string>;

  /**
   * Log API operation details
   */
  protected logApiOperation(message: string): void {
    if (this.debug) {
      console.log(`\n[DEBUG] ${message}`);
    }
  }

  /**
   * Make an API request with debug logging and error handling
   * Includes automatic retry with exponential backoff for 429 (rate limit) responses
   */
  protected async request<T>(config: AxiosRequestConfig): Promise<T> {
    const fullUrl = `${this.getBaseUrl()}/${config.url || ''}`;

    const requestConfig: AxiosRequestConfig = {
      ...config,
      url: fullUrl,
      headers: {
        ...this.getHeaders(),
        ...config.headers,
      },
      validateStatus: () => true, // Handle all status codes manually
    };

    // In dry-run mode, return early for write operations
    if (this.dryRun && config.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
      console.log(`\nDRY-RUN - Skipping ${config.method.toUpperCase()} request to ${fullUrl}`);
      return {} as T;
    }

    // Retry logic for 429 responses
    const maxRetries = 3;
    const retryDelays = [10000, 15000, 20000]; // 10s, 15s, 20s
    let attempt = 0;

    while (attempt <= maxRetries) {
      const response: AxiosResponse<T> = await axios.request(requestConfig);

      // Helper to build request log details
      const buildRequestLog = (): string[] => {
        const logLines: string[] = [];

        logLines.push(`\nAPI CALL`);
        logLines.push(`  Request:`);
        logLines.push(`    Method: ${config.method?.toUpperCase()}`);
        logLines.push(`    URL: ${fullUrl}`);

        // Sanitize headers for logging
        const headers = requestConfig.headers || {};
        const sanitizedHeaders: Record<string, string> = {};
        for (const key in headers) {
          if (key === 'Authorization' || key === 'x-api-key') {
            const value = String(headers[key]);
            // Show format (e.g., "Bearer [REDACTED 36 chars]") without revealing the key
            if (value.startsWith('Bearer ')) {
              const keyLength = value.substring(7).length;
              sanitizedHeaders[key] = `Bearer [REDACTED ${keyLength} chars]`;
            } else {
              sanitizedHeaders[key] = `[REDACTED ${value.length} chars]`;
            }
          } else {
            sanitizedHeaders[key] = String(headers[key]);
          }
        }
        logLines.push(`    Headers: ${JSON.stringify(sanitizedHeaders, null, 2).split('\n').join('\n    ')}`);

        if (config.params) {
          logLines.push(`    Params: ${JSON.stringify(config.params, null, 2).split('\n').join('\n    ')}`);
        }
        if (config.data) {
          const dataStr = JSON.stringify(config.data, null, 2);
          if (dataStr.length > 1000) {
            logLines.push(`    Body: [${dataStr.length} bytes]`);
          } else {
            logLines.push(`    Body: ${dataStr.split('\n').join('\n    ')}`);
          }
        }

        logLines.push(`  Response:`);
        logLines.push(`    Status: ${response.status} ${response.statusText}`);
        const responseStr = JSON.stringify(response.data, null, 2);
        if (responseStr.length > 1000) {
          logLines.push(`    Body: [${responseStr.length} bytes]`);
        } else {
          logLines.push(`    Body: ${responseStr.split('\n').join('\n    ')}`);
        }

        return logLines;
      };

      // Log request and response together in debug mode
      if (this.debug) {
        console.log(buildRequestLog().join('\n'));
      }

      // Handle 429 (Too Many Requests) with retry
      if (response.status === 429 && attempt < maxRetries) {
        const delayMs = retryDelays[attempt];
        console.log(`\nRate limit hit (429). Retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }

      // Check if the response status indicates success (2xx)
      if (response.status < 200 || response.status >= 300) {
        // Log write operation failures (unless in debug mode or it's a commonly-handled error)
        const isWriteOperation = config.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase());
        const errorData = response.data as any;
        const isApiTokenError = errorData?.message?.includes('has apitokens associated');
        const is404 = response.status === 404;

        // Log if: write operation AND not in debug mode AND not a handled error
        if (!this.debug && isWriteOperation && !isApiTokenError && !is404) {
          console.log(buildRequestLog().join('\n'));
        }

        // Include response body in error for better error handling
        const errorMessage = errorData?.message || response.statusText;
        const error = new Error(`API request failed with status ${response.status}: ${errorMessage}`) as any;
        error.response = response.data;
        error.status = response.status;
        throw error;
      }

      return response.data;
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Max retries exceeded');
  }

  /**
   * Fetch all items with pagination support
   * Handles both array and PagedResponse formats
   */
  protected async fetchAllPaginated<T>(
    url: string,
    limit: number = 50
  ): Promise<T[]> {
    let allItems: T[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const requestConfig: AxiosRequestConfig = {
        method: 'get',
        url: `${url}?offset=${offset}&limit=${limit}`,
      };

      const response = await this.request<PagedResponse<T> | T[]>(requestConfig);

      let items: T[];
      if (Array.isArray(response)) {
        items = response;
      } else if (response.objects) {
        items = response.objects;
      } else {
        items = [];
      }

      allItems = [...allItems, ...items];

      // Check if there are more items
      hasMore = items.length === limit;
      offset += items.length;
    }

    return allItems;
  }

  // Workspace operations
  abstract listWorkspaces(): Promise<Workspace[]>;
  abstract getWorkspace(workspaceId: string): Promise<Workspace | null>;
  abstract deleteWorkspace(workspaceId: string): Promise<boolean>;

  // Environment operations
  abstract listEnvironments(workspaceId: string): Promise<Environment[]>;
  abstract getEnvironment(workspaceId: string, environmentId: string): Promise<Environment | null>;
  abstract deleteEnvironment(workspaceId: string, environmentId: string): Promise<boolean>;

  // Traffic Type operations
  abstract listTrafficTypes(workspaceId: string): Promise<TrafficType[]>;
  abstract getTrafficType(workspaceId: string, trafficTypeId: string): Promise<TrafficType | null>;
  abstract deleteTrafficType(workspaceId: string, trafficTypeId: string): Promise<boolean>;

  // Split (Feature Flag) operations
  abstract listSplits(workspaceId: string, trafficType?: string): Promise<Split[]>;
  abstract getSplit(workspaceId: string, splitName: string): Promise<Split | null>;
  abstract listSplitDefinitions(workspaceId: string, splitName: string): Promise<SplitDefinition[]>;
  abstract deleteSplit(workspaceId: string, splitName: string, trafficType?: string): Promise<boolean>;
  abstract deleteSplitDefinition(workspaceId: string, environmentName: string, splitName: string): Promise<boolean>;

  // Segment operations (regular)
  abstract listSegments(workspaceId: string, trafficType?: string): Promise<Segment[]>;
  abstract getSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<Segment | null>;
  abstract getSegmentKeys(workspaceId: string, segmentName: string, trafficType?: string): Promise<string[]>;
  abstract deleteSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<boolean>;
  abstract deleteSegmentFromEnvironment(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;
  abstract removeSegmentKeys(environmentId: string, segmentName: string, keys: string[]): Promise<boolean>;

  // Large segment operations
  abstract listLargeSegments(workspaceId: string, trafficType?: string): Promise<LargeSegment[]>;
  abstract getLargeSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<LargeSegment | null>;
  abstract getLargeSegmentKeys(workspaceId: string, segmentName: string, trafficType?: string): Promise<string[]>;
  abstract deleteLargeSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<boolean>;
  abstract deleteLargeSegmentFromEnvironment(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;
  abstract removeLargeSegmentKeys(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;

  // Rule-based segment operations
  abstract listRuleBasedSegments(workspaceId: string, trafficType?: string): Promise<RuleBasedSegment[]>;
  abstract getRuleBasedSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<RuleBasedSegment | null>;
  abstract deleteRuleBasedSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<boolean>;
  abstract deleteRuleBasedSegmentFromEnvironment(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;

  // API Token operations
  abstract listApiTokens(environmentId: string): Promise<ApiToken[]>;
  abstract deleteApiToken(environmentId: string, tokenId: string): Promise<boolean>;
}
