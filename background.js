import { services } from './serviceConfig.js';

// Durée de vie du cache (15 minutes) en millisecondes
const CACHE_TTL = 15 * 60 * 1000;
const CACHE_KEY = 'superHoverCache';

/**
 * Récupère l'intégralité du cache depuis chrome.storage.local.
 * @returns {Promise<Map<string, {data: object, timestamp: number}>>}
 */
async function getCache() {
  const result = await chrome.storage.local.get(CACHE_KEY);
  // Le résultat est stocké sous forme d'objet simple, le reconvertir en Map si non vide
  return result[CACHE_KEY] ? new Map(Object.entries(result[CACHE_KEY])) : new Map();
}

/**
 * Sauvegarde le cache dans chrome.storage.local.
 * @param {Map<string, {data: object, timestamp: number}>} cache
 */
async function saveCache(cache) {
  // chrome.storage ne peut pas stocker de Map directement, le convertir en objet simple
  const cacheObject = Object.fromEntries(cache);
  await chrome.storage.local.set({ [CACHE_KEY]: cacheObject });
}

async function getData(serviceName, matches) {
  const service = services.find(s => s.name === serviceName);
  if (!service) throw new Error(`Service inconnu: ${serviceName}`);

  const apiUrl = service.buildApiUrl(matches);
  const cacheKey = `${service.name}-${apiUrl}`;
  const now = Date.now();
  
  // 1. Check cache persistant (chrome.storage.local)
  const cache = await getCache();
  if (cache.has(cacheKey)) {
    const cachedItem = cache.get(cacheKey);
    if (now - cachedItem.timestamp < CACHE_TTL) {
      console.log(`[Cache Hit] pour ${serviceName}: ${apiUrl}`);
      return cachedItem.data;
    } else {
      console.log(`[Cache Expired] pour ${serviceName}: ${apiUrl}`);
      // On retire l'entrée expirée pour ne pas encombrer le storage
      cache.delete(cacheKey);
      await saveCache(cache);
    }
  }

  // 2. Appel API
  console.log(`[API Call] pour ${serviceName}: ${apiUrl}`);
  const response = await fetch(apiUrl);
  
  if (!response.ok) {
    if (response.status === 403 && apiUrl.includes('api.github.com')) {
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        if (rateLimitRemaining === '0') {
             throw new Error(`Erreur d'API (${response.status}): Limite de taux (rate limit) de GitHub atteinte. Réessayez plus tard.`);
        }
    }
    throw new Error(`Erreur d'API (${response.status}): ${response.statusText}`);
  }
  
  const rawData = await response.json();
  const parsedData = service.parseResponse(rawData);
  
  // 3. Mise en cache
  cache.set(cacheKey, { data: parsedData, timestamp: now });
  await saveCache(cache); // Sauvegarde le cache mis à jour

  return parsedData;
}

/**
 * Script exécuté dans l'onglet cible pour extraire l'aperçu de la page.
 */
function extractPageInfo() {
  const title = document.title || 'Titre non trouvé';
  const metaDescription = document.querySelector('meta[name="description"]')?.content || 'Aucune méta-description disponible.';
  
  return {
    title: title,
    description: metaDescription,
    stats: [
        { label: 'Domaine', value: new URL(window.location.href).hostname, icon: '🔗' },
        { label: 'Type', value: 'Page Web', icon: '📄' },
        { label: 'Source', value: 'Local', icon: '🏠' }
    ],
    footer: 'Aperçu générique (lien non répertorié).'
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getData') {
    getData(request.serviceName, request.matches)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => {
        // Log l'erreur pour le développeur
        console.error(`Erreur lors du getData pour ${request.serviceName}:`, error.message);
        // On envoie le message d'erreur à content.js
        sendResponse({ success: false, error: error.message });
      });
    return true; // Réponse asynchrone
  }

  if (request.action === 'getPageOverview') {
    // Exécuter le script extractPageInfo dans le contexte de l'onglet qui a envoyé le message
    chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        function: extractPageInfo,
    })
    .then(results => {
        if (results && results[0] && results[0].result) {
            sendResponse({ success: true, data: results[0].result });
        } else {
            sendResponse({ success: false, error: 'Impossible d\'extraire les informations de la page.' });
        }
    })
    .catch(error => {
        console.error("Erreur lors de l'exécution du script de contenu:", error);
        sendResponse({ success: false, error: 'Erreur d\'exécution du script pour l\'aperçu.' });
    });
    return true; // Réponse asynchrone
  }
});