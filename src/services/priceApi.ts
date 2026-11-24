import https from 'https';
import { URL } from 'url';
import { CONFIG } from '../config.js';
import { GfwApiResponse } from '../types.js';
import { getProxyAgent } from '../utils/telegramAgent.js';

interface CacheEntry {
  data: GfwApiResponse;
  timestamp: number;
}

let memoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 25 * 1000; // 25 seconds cache

function executeRequest(url: string, agent?: any): Promise<GfwApiResponse> {
  return new Promise<GfwApiResponse>((resolve, reject) => {
    const req = https.get(
      url,
      {
        agent,
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GoldenNoticeBot/1.0',
        },
      },
      (res) => {
        let rawBody = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          rawBody += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(rawBody) as GfwApiResponse;
              if (json && json.success) {
                resolve(json);
              } else {
                reject(new Error(`API returned success=false: ${rawBody}`));
              }
            } catch (err) {
              reject(new Error(`Failed to parse API JSON: ${(err as Error).message}`));
            }
          } else {
            reject(new Error(`API responded with HTTP status ${res.statusCode}: ${rawBody}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API request timed out (15s)'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Fetch gold and currency prices from GFw API with fallback (Direct & Proxy)
 */
export async function fetchGoldPrices(forceFresh = false): Promise<GfwApiResponse> {
  const now = Date.now();
  if (!forceFresh && memoryCache && (now - memoryCache.timestamp < CACHE_TTL_MS)) {
    return memoryCache.data;
  }

  const endpoint = new URL(CONFIG.API_BASE_URL);
  endpoint.searchParams.set('category', 'gold');
  endpoint.searchParams.set('api_key', CONFIG.GFW_API_KEY);
  const targetUrl = endpoint.toString();

  // Try direct connection first (api.gfwdev.ir is a domestic .ir endpoint)
  try {
    const result = await executeRequest(targetUrl, undefined);
    memoryCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (directErr) {
    // If direct connection failed and a proxy is configured, attempt via proxy agent
    const proxyAgent = getProxyAgent();
    if (proxyAgent) {
      try {
        const proxiedResult = await executeRequest(targetUrl, proxyAgent);
        memoryCache = { data: proxiedResult, timestamp: Date.now() };
        return proxiedResult;
      } catch (proxyErr) {
        throw new Error(`API failed directly and via proxy: ${(directErr as Error).message} | ${(proxyErr as Error).message}`);
      }
    }
    throw directErr;
  }
}
