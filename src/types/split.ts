/**
 * TypeScript types for Split API entities
 */

export interface Workspace {
  id: string;
  name: string;
  type?: string;
}

export interface Environment {
  id: string;
  name: string;
  production?: boolean;
  apiTokens?: ApiToken[];
}

export interface TrafficType {
  id: string;
  name: string;
  displayAttributeId?: string;
}

export interface Segment {
  name: string;
  description?: string;
  trafficTypeId?: string;
  trafficTypeName?: string;
  keys?: string[];
  creationTime?: number;
  lastUpdateTime?: number;
}

export interface RuleBasedSegment {
  name: string;
  description?: string;
  trafficTypeId?: string;
  trafficTypeName?: string;
  rules?: SegmentRule[];
  excludedKeys?: string[];
  creationTime?: number;
  lastUpdateTime?: number;
}

export interface LargeSegment {
  name: string;
  description?: string;
  trafficTypeId?: string;
  trafficTypeName?: string;
  keys?: string[];
  creationTime?: number;
  lastUpdateTime?: number;
}

export interface SegmentRule {
  condition: Condition;
}

export interface Condition {
  combiner: 'AND' | 'OR';
  matchers: Matcher[];
}

export interface Matcher {
  type: string;
  attribute?: string;
  strings?: string[];
  number?: number;
  numbers?: number[];
  negate?: boolean;
  between?: { start: number; end: number };
  dependencyMatcher?: DependencyMatcher;
}

export interface DependencyMatcher {
  splitName: string;
  treatments: string[];
}

export interface Tag {
  name: string;
}

export interface Split {
  name: string;
  description?: string;
  trafficTypeId?: string;
  trafficTypeName?: string;
  owners?: Owner[];
  tags?: (string | Tag)[];
  creationTime?: number;
  lastUpdateTime?: number;
  rolloutStatus?: {
    id: string;
    name: string;
  };
  rolloutStatusTimestamp?: number;
}

export interface SplitDefinition {
  name: string;
  treatments: Treatment[];
  defaultTreatment: string;
  baselineTreatment: string;
  defaultRule: Rule[];
  rules?: Rule[];
  trafficAllocation?: number;
  killed?: boolean;
  id?: string;
  environment?: { id: string; name: string };
  trafficType?: { id: string; name: string };
  creationTime?: number;
  lastUpdateTime?: number;
  changeNumber?: number;
}

export interface Treatment {
  name: string;
  description?: string;
  configurations?: string;
  keys?: string[];
}

export interface Rule {
  buckets: Bucket[];
  condition: Condition;
}

export interface Bucket {
  treatment: string;
  size: number;
}

export interface Owner {
  id: string;
  type: 'user' | 'group';
}

export interface ApiToken {
  id: string;
  name: string;
  type?: string;
  environmentId?: string;
}

// API Response types
export interface PagedResponse<T> {
  objects?: T[];
  totalCount?: number;
  offset?: number;
  limit?: number;
}

// Delete operation types
export type ResourceType = 'workspace' | 'environment' | 'segment' | 'large-segment' | 'rule-based-segment' | 'split' | 'traffic-type' | 'api-token';

export interface DeleteTreeNode {
  type: ResourceType;
  name: string;
  id?: string;
  children: DeleteTreeNode[];
}
