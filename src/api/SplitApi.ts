/**
 * Interface defining the contract for Split.io API operations
 */

import {
  Workspace,
  Environment,
  TrafficType,
  Split,
  SplitDefinition,
  Segment,
  LargeSegment,
  RuleBasedSegment,
  ApiToken,
} from '../types/split';

export interface SplitApi {
  // Workspace operations
  listWorkspaces(): Promise<Workspace[]>;
  getWorkspace(workspaceId: string): Promise<Workspace | null>;
  deleteWorkspace(workspaceId: string): Promise<boolean>;

  // Environment operations
  listEnvironments(workspaceId: string): Promise<Environment[]>;
  getEnvironment(workspaceId: string, environmentId: string): Promise<Environment | null>;
  deleteEnvironment(workspaceId: string, environmentId: string): Promise<boolean>;

  // Traffic Type operations
  listTrafficTypes(workspaceId: string): Promise<TrafficType[]>;
  getTrafficType(workspaceId: string, trafficTypeId: string): Promise<TrafficType | null>;
  deleteTrafficType(workspaceId: string, trafficTypeId: string): Promise<boolean>;

  // Split (Feature Flag) operations
  listSplits(workspaceId: string, trafficType?: string): Promise<Split[]>;
  getSplit(workspaceId: string, splitName: string): Promise<Split | null>;
  listSplitDefinitions(workspaceId: string, splitName: string): Promise<SplitDefinition[]>;
  deleteSplit(workspaceId: string, splitName: string, trafficType?: string): Promise<boolean>;
  deleteSplitDefinition(workspaceId: string, environmentName: string, splitName: string): Promise<boolean>;

  // Segment operations (regular)
  listSegments(workspaceId: string, trafficType?: string): Promise<Segment[]>;
  getSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<Segment | null>;
  getSegmentKeys(workspaceId: string, segmentName: string, trafficType?: string): Promise<string[]>;
  deleteSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<boolean>;
  deleteSegmentFromEnvironment(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;
  removeSegmentKeys(environmentId: string, segmentName: string, keys: string[]): Promise<boolean>;

  // Large segment operations
  listLargeSegments(workspaceId: string, trafficType?: string): Promise<LargeSegment[]>;
  getLargeSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<LargeSegment | null>;
  getLargeSegmentKeys(workspaceId: string, segmentName: string, trafficType?: string): Promise<string[]>;
  deleteLargeSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<boolean>;
  deleteLargeSegmentFromEnvironment(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;
  removeLargeSegmentKeys(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;

  // Rule-based segment operations
  listRuleBasedSegments(workspaceId: string, trafficType?: string): Promise<RuleBasedSegment[]>;
  getRuleBasedSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<RuleBasedSegment | null>;
  deleteRuleBasedSegment(workspaceId: string, segmentName: string, trafficType?: string): Promise<boolean>;
  deleteRuleBasedSegmentFromEnvironment(workspaceId: string, environmentId: string, segmentName: string): Promise<boolean>;

  // API Token operations
  listApiTokens(environmentId: string): Promise<ApiToken[]>;
  deleteApiToken(environmentId: string, tokenId: string): Promise<boolean>;
}
