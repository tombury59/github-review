// La carte est créée une seule fois
let popup = null;
let hoverTimeout = null;
const POPUP_WIDTH = 340; // Défini dans popup.css
const POPUP_HEIGHT_ESTIMATE = 180; // Estimation pour le calcul de position
const MARGIN = 15; // Marge par rapport au bord de l'écran ou au curseur

async function createPopup() {
  if (popup) return;
  try {
    const response = await fetch(chrome.runtime.getURL('popup.html'));
    const html = await response.text();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    popup = tempDiv.querySelector('#super-hover-card');
    if (popup) {
      document.body.appendChild(popup);
    } else {
      console.error("L'élément popup avec l'ID 'super-hover-card' n'a pas été trouvé.");
    }
  } catch (error) {
    console.error("Erreur lors de la création de la popup:", error);
  }
}

function displayError(message) {
    if (!popup) return;

    popup.querySelector('#card-title').textContent = 'Erreur de Chargement';
    popup.querySelector('#card-description').textContent = message || 'Une erreur inconnue est survenue lors de la récupération des données.';
    popup.querySelector('#card-footer').textContent = 'Vérifiez votre connexion ou la console.';

    const statsContainer = popup.querySelector('.card-content #card-stats');
    statsContainer.innerHTML = ''; // Vider les stats
    
    // Afficher l'état "loaded" pour remplacer le skeleton par le contenu d'erreur
    popup.classList.remove('loading');
    popup.classList.add('loaded');
}

function positionPopup(event) {
  if (!popup) return;

  const { clientX, clientY } = event;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let finalX, finalY;

  // 1. Positionnement Horizontal (à droite ou à gauche du curseur)
  if (clientX + POPUP_WIDTH + MARGIN < viewportWidth) {
    // Assez d'espace à droite: positionner à droite
    finalX = clientX + MARGIN;
  } else if (clientX - POPUP_WIDTH - MARGIN > 0) {
    // Assez d'espace à gauche: positionner à gauche
    finalX = clientX - POPUP_WIDTH - MARGIN;
  } else {
    // Pas assez d'espace, centrer au mieux ou laisser à droite (peut dépasser)
    finalX = Math.max(MARGIN, viewportWidth - POPUP_WIDTH - MARGIN);
  }
  
  // 2. Positionnement Vertical (en bas ou en haut du curseur)
  if (clientY + POPUP_HEIGHT_ESTIMATE + MARGIN < viewportHeight) {
    // Assez d'espace en bas: positionner en bas
    finalY = clientY + MARGIN;
  } else if (clientY - POPUP_HEIGHT_ESTIMATE - MARGIN > 0) {
    // Assez d'espace en haut: positionner en haut
    finalY = clientY - POPUP_HEIGHT_ESTIMATE - MARGIN;
  } else {
    // Pas assez d'espace, positionner en haut de l'écran ou en bas de l'écran au mieux
    finalY = Math.max(MARGIN, viewportHeight - POPUP_HEIGHT_ESTIMATE - MARGIN);
  }

  // Appliquer les styles de position
  popup.style.top = `${finalY}px`;
  popup.style.left = `${finalX}px`;
  popup.style.right = 'auto'; // Assurer que 'right' est annulé
  popup.style.bottom = 'auto'; // Assurer que 'bottom' est annulé
}


function showPopup(event, data) {
  if (!popup) return;

  // 1. Mise à jour du contenu
  popup.querySelector('#card-title').textContent = data.title;
  popup.querySelector('#card-description').textContent = data.description;
  popup.querySelector('#card-footer').textContent = data.footer;

  const statsContainer = popup.querySelector('.card-content #card-stats');
  statsContainer.innerHTML = ''; // Vider les anciennes stats
  data.stats.forEach(stat => {
    // Utiliser le toLocaleString en 'fr-FR' si la valeur est un nombre
    const statValue = (typeof stat.value === 'number' && stat.value.toLocaleString) ? stat.value.toLocaleString('fr-FR') : stat.value;
    
    statsContainer.innerHTML += `
      <div class="stat-item">
        <div class="stat-value">${stat.icon} ${statValue}</div>
        <div class="stat-label">${stat.label}</div>
      </div>
    `;
  });

  // 2. Positionnement dynamique (fait avant la requête mais mis à jour ici pour le cas de cache)
  positionPopup(event);

  // 3. Contrôle de l'animation : passer de l'état de chargement à l'état chargé
  popup.classList.remove('loading');
  popup.classList.add('loaded');
  popup.classList.add('visible');
}

function hidePopup() {
  clearTimeout(hoverTimeout);
  if (popup) {
    popup.classList.remove('visible');
    
    // Réinitialiser à l'état de chargement pour la prochaine fois
    // Délai pour laisser l'animation de disparition se terminer
    setTimeout(() => {
        popup.classList.remove('loaded');
        popup.classList.add('loading');
    }, 200); // Doit correspondre à la durée de la transition CSS
  }
}

function displayLoading(event) {
    clearTimeout(hoverTimeout);
    if(popup) {
        positionPopup(event); 
        popup.classList.add('loading');
        popup.classList.remove('loaded');
        popup.classList.add('visible');
    }
}

// Nouvelle fonction pour construire les données d'aperçu génériques localement
function getGenericLinkInfo(link) {
    try {
        const url = new URL(link.href);
        return {
            title: url.hostname,
            description: link.href, // L'URL complète comme description
            stats: [
                { label: 'Protocole', value: url.protocol.replace(':', ''), icon: '🌐' },
                { label: 'Chemin', value: url.pathname.length > 20 ? url.pathname.substring(0, 17) + '...' : url.pathname || '/', icon: '📁' },
                { label: 'Source', value: 'Lien Externe', icon: '🔗' }
            ],
            footer: 'Service non répertorié. Cliquez pour visiter.'
        };
    } catch (e) {
        return {
            title: 'Lien Invalide',
            description: link.href || 'URL introuvable.',
            stats: [],
            footer: 'Impossible d\'analyser l\'URL.'
        };
    }
}


async function scanAndAttachListeners() {
  try {
    const src = chrome.runtime.getURL('serviceConfig.js');
    const { services } = await import(src);

    // Scanner tous les liens commençant par http
    document.querySelectorAll('a[href^="http"]').forEach(link => {
      if (link.dataset.hoverHandled) return;
      link.dataset.hoverHandled = true;

      let matchedService = null;
      let matches = null;

      // Essayer de trouver un service correspondant dans notre configuration
      for (const service of services) {
        const regexMatches = link.href.match(service.regex);
        if (regexMatches) {
          matchedService = service;
          matches = regexMatches;
          break; // Arrêter dès qu'un service est trouvé
        }
      }
      
      link.addEventListener('mouseenter', (event) => {
        displayLoading(event);

        if (matchedService) {
            // Cas 1 : Service connu (GitHub, NPM, etc.)
            chrome.runtime.sendMessage({ action: 'getData', serviceName: matchedService.name, matches }, (response) => {
              if (!chrome.runtime.lastError) {
                if (response?.success) {
                  hoverTimeout = setTimeout(() => showPopup(event, response.data), 300);
                } else {
                  hoverTimeout = setTimeout(() => {
                      displayError(response.error);
                      popup.classList.add('visible');
                  }, 300);
                }
              }
            });
        } else {
            // Cas 2 : Service inconnu (Afficher un aperçu du lien localement)
            const genericData = getGenericLinkInfo(link);
            hoverTimeout = setTimeout(() => showPopup(event, genericData), 300);
        }
      });

      link.addEventListener('mouseleave', () => {
        hidePopup();
      });
    });
  } catch (error) {
    console.error("Erreur lors du chargement de la config ou de l'attachement des listeners:", error);
  }
}

// Initialisation
createPopup();
scanAndAttachListeners();

// S'assurer que le script scanne les nouveaux éléments ajoutés dynamiquement
const observer = new MutationObserver(scanAndAttachListeners);
observer.observe(document.body, { childList: true, subtree: true });