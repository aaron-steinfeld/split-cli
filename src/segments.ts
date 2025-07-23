import axios from 'axios';
import { SPLIT_API_BASE, LogLevel, SegmentInfo } from './types';

export async function deleteSegment(apiKey: string, workspaceId: string, segmentName: string, segmentType?: string, logLevel = LogLevel.DEFAULT): Promise<boolean> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  const segmentEndpoints = segmentType ? [segmentType] : ['segments', 'large-segments', 'rule-based-segments'];
  
  for (const endpoint of segmentEndpoints) {
    const url = `${SPLIT_API_BASE}/${endpoint}/ws/${workspaceId}/${segmentName}`;
    if (logLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${segmentType ? 'DELETE' : 'Trying DELETE'} ${endpoint.toUpperCase()} URL:`, url);
    }
    if (logLevel >= LogLevel.TRACE) {
      const safeHeaders = { ...headers, Authorization: 'Bearer [REDACTED]' };
      console.log('[TRACE] Headers:', safeHeaders);
    } 
    try {
      const resp = await axios.delete(url, {
        headers,
        validateStatus: () => true
      });
      if (logLevel >= LogLevel.DEBUG) {
        console.log(`[DEBUG] Response status: ${resp.status}`);
        console.log(`[DEBUG] Response data:`, resp.data);
      }
      if (resp.status === 204 || resp.status === 200) {
        console.log(`Segment '${segmentName}' deleted successfully (${endpoint}).`);
        return true;
      } else if (resp.status !== 404) {
        console.error(`Failed to delete segment from ${endpoint}: ${resp.status} - ${resp.data && resp.data.message ? resp.data.message : resp.data}`);
      }
    } catch (err: any) {
      console.error(`Error deleting segment from ${endpoint}:`, err.message);
    }
  }
  
  console.error(`Segment '${segmentName}' not found${segmentType ? ` in ${segmentType}` : ' in any segment type'}.`);
  return false;
}

export async function listSegmentsFromEndpoint(apiKey: string, workspaceId: string, endpoint: string, logLevel = LogLevel.DEFAULT): Promise<SegmentInfo[]> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
  };
  
  const allItems: SegmentInfo[] = [];
  let hasMore = true;
  let offset = 0;
  const limit = 50;

  while (hasMore) {
    const url = `${SPLIT_API_BASE}/${endpoint}/ws/${workspaceId}?limit=${limit}&offset=${offset}`;
    if (logLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] LIST ${endpoint.toUpperCase()} URL:`, url);
    }
    if (logLevel >= LogLevel.TRACE) {
      const safeHeaders = { ...headers, Authorization: 'Bearer [REDACTED]' };
      console.log('[TRACE] Headers:', safeHeaders);
    }
    try {
      const resp = await axios.get(url, { headers });
      if (logLevel >= LogLevel.DEBUG) {
        console.log(`[DEBUG] List ${endpoint} response status: ${resp.status}`);
        console.log(`[DEBUG] List ${endpoint} response data:`, resp.data);
      }
      
      if (resp.status === 200 && resp.data && resp.data.objects) {
        const items = resp.data.objects.map((item: any) => ({
          name: item.name,
          type: endpoint
        }));
        allItems.push(...items);
        
        hasMore = resp.data.objects.length === limit;
        offset += limit;
      } else {
        console.error(`Failed to list ${endpoint}: ${resp.status} - ${resp.data && resp.data.message ? resp.data.message : resp.data}`);
        break;
      }
    } catch (err: any) {
      console.error(`Error listing ${endpoint}:`, err.message);
      break;
    }
  }
  
  return allItems;
}

export async function listSegments(apiKey: string, workspaceId: string, logLevel = LogLevel.DEFAULT): Promise<SegmentInfo[]> {
  // For segments, combine results from all segment types
  const segmentEndpoints = ['segments', 'large-segments', 'rule-based-segments'];
  const allSegments: SegmentInfo[] = [];
  
  for (const endpoint of segmentEndpoints) {
    const segments = await listSegmentsFromEndpoint(apiKey, workspaceId, endpoint, logLevel);
    allSegments.push(...segments);
  }
  
  // Remove duplicates based on name (in case a segment appears in multiple endpoints)
  const uniqueSegments = allSegments.filter((segment, index, self) => 
    index === self.findIndex(s => s.name === segment.name)
  );
  
  return uniqueSegments;
}
