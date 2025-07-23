import axios from 'axios';
import { SPLIT_API_BASE, LogLevel } from './types';

export async function deleteFlag(apiKey: string, workspaceId: string, flagName: string, logLevel = LogLevel.DEFAULT): Promise<boolean> {
  const url = `${SPLIT_API_BASE}/splits/ws/${workspaceId}/${flagName}`;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (logLevel >= LogLevel.DEBUG) {
    console.log(`[DEBUG] DELETE FLAG URL:`, url);
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
      console.log(`Feature flag '${flagName}' deleted successfully.`);
      return true;
    } else if (resp.status === 404) {
      console.error(`Feature flag '${flagName}' not found.`);
    } else {
      console.error(`Failed to delete flag: ${resp.status} - ${resp.data && resp.data.message ? resp.data.message : resp.data}`);
    }
  } catch (err: any) {
    console.error(`Error deleting flag:`, err.message);
  }
  return false;
}

export async function listFlags(apiKey: string, workspaceId: string, logLevel = LogLevel.DEFAULT): Promise<string[]> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
  };
  
  const allItems: string[] = [];
  let hasMore = true;
  let offset = 0;
  const limit = 50;

  while (hasMore) {
    const url = `${SPLIT_API_BASE}/splits/ws/${workspaceId}?limit=${limit}&offset=${offset}`;
    if (logLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] LIST FLAGS URL:`, url);
    }
    if (logLevel >= LogLevel.TRACE) {
      const safeHeaders = { ...headers, Authorization: 'Bearer [REDACTED]' };
      console.log('[TRACE] Headers:', safeHeaders);
    }
    try {
      const resp = await axios.get(url, { headers });
      if (logLevel >= LogLevel.DEBUG) {
        console.log(`[DEBUG] List flags response status: ${resp.status}`);
        console.log(`[DEBUG] List flags response data:`, resp.data);
      }
      
      if (resp.status === 200 && resp.data && resp.data.objects) {
        const items = resp.data.objects.map((item: any) => item.name);
        allItems.push(...items);
        
        hasMore = resp.data.objects.length === limit;
        offset += limit;
      } else {
        console.error(`Failed to list flags: ${resp.status} - ${resp.data && resp.data.message ? resp.data.message : resp.data}`);
        break;
      }
    } catch (err: any) {
      console.error(`Error listing flags:`, err.message);
      break;
    }
  }
  
  return allItems;
}
