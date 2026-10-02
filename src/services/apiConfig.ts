export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function getWebSocketUrl(): string {
  const configuredWsUrl = import.meta.env.VITE_WS_URL;
  if (configuredWsUrl) {
    return configuredWsUrl;
  }
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // If API_BASE_URL is a full URL, try to derive WS URL from it if VITE_WS_URL is not provided
  if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    return `${wsUrl}/ws`;
  }
  return `${protocol}//${window.location.host}/ws`;
}
