import { services } from './serviceConfig.js';

const inMemoryCache = new Map();

async function getData(serviceName, matches) {
  const service = services.find(s => s.name === serviceName);
  if (!service) throw new Error(`Service inconnu: ${serviceName}`);

  const apiUrl = service.buildApiUrl(matches);
  const cacheKey = `${service.name}-${apiUrl}`;
  const now = Date.now();

  // 1. Check cache en mémoire
  if (inMemoryCache.has(cacheKey) && (now - inMemoryCache.get(cacheKey).timestamp < 15 * 60 * 1000)) {
    return inMemoryCache.get(cacheKey).data;
  }
  
  // 2. Appel API
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error('API request failed');
  
  const rawData = await response.json();
  const parsedData = service.parseResponse(rawData);
  
  // 3. Mise en cache
  inMemoryCache.set(cacheKey, { data: parsedData, timestamp: now });

  return parsedData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getData') {
    getData(request.serviceName, request.matches)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Réponse asynchrone
  }
});