// Fonction pour récupérer les données de l'API GitHub
async function getRepoData(owner, repo) {
  const cacheKey = `repo-${owner}-${repo}`;
  // Vérifier si les données sont dans le cache et pas trop vieilles (15 minutes)
  const cached = await chrome.storage.local.get(cacheKey);
  const now = new Date().getTime();

  if (cached[cacheKey] && (now - cached[cacheKey].timestamp < 15 * 60 * 1000)) {
    console.log("Données servies depuis le cache");
    return cached[cacheKey].data;
  }

  // Si pas dans le cache, appeler l'API
  console.log("Appel à l'API GitHub");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!response.ok) {
    throw new Error('Réponse réseau non OK');
  }
  const data = await response.json();
  
  // Mettre les nouvelles données en cache
  await chrome.storage.local.set({ [cacheKey]: { data: data, timestamp: now } });

  return data;
}

// Écouter les messages venant du content_script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getRepoInfo') {
    getRepoData(request.owner, request.repo)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Indique que la réponse sera envoyée de manière asynchrone
    return true; 
  }
});