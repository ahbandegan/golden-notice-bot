import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { CONFIG } from '../config.js';

export function getProxyAgent(customProxy?: string | null) {
  const proxyUrl = customProxy || CONFIG.PROXY_URL;
  if (!proxyUrl) return undefined;

  try {
    if (proxyUrl.startsWith('socks')) {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  } catch (err) {
    console.error('❌ Failed to initialize proxy agent:', err);
    return undefined;
  }
}
