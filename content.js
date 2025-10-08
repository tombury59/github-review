let popup = null;
let hoverTimeout = null;

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

function showPopup(event, data) {
  if (!popup) return;

  popup.querySelector('#card-title').textContent = data.title;
  popup.querySelector('#card-description').textContent = data.description;
  popup.querySelector('#card-footer').textContent = data.footer;

  const statsContainer = popup.querySelector('.card-content #card-stats');
  statsContainer.innerHTML = ''; // Vider les anciennes stats
  data.stats.forEach(stat => {
    statsContainer.innerHTML += `
      <div class="stat-item">
        <div class="stat-value">${stat.icon} ${stat.value.toLocaleString ? stat.value.toLocaleString('en-US') : stat.value}</div>
        <div class="stat-label">${stat.label}</div>
      </div>
    `;
  });

  const margin = 20;
  popup.style.top = `${margin}px`;
  popup.style.right = `${margin}px`;
  popup.style.left = 'auto';
  popup.style.bottom = 'auto';

  // Contrôle de l'animation : passer de l'état de chargement à l'état chargé
  popup.classList.remove('loading');
  popup.classList.add('loaded');
  popup.classList.add('visible');
}

function hidePopup() {
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

      // Attacher les écouteurs d'événements
      link.addEventListener('mouseenter', (event) => {
        clearTimeout(hoverTimeout);
        if (chrome.runtime?.id) {
          if (matchedService) {
            // Si un service correspond, utiliser la logique existante
            chrome.runtime.sendMessage({ action: 'getData', serviceName: matchedService.name, matches }, (response) => {
              if (!chrome.runtime.lastError && response?.success) {
                hoverTimeout = setTimeout(() => showPopup(event, response.data), 300);
              }
            });
          } else {
            // Sinon, demander un aperçu générique de la page
            chrome.runtime.sendMessage({ action: 'getPageOverview', url: link.href }, (response) => {
               if (!chrome.runtime.lastError && response?.success) {
                  hoverTimeout = setTimeout(() => showPopup(event, response.data), 300);
               }
            });
          }
        }
      });

      link.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        hidePopup();
      });
    });
  } catch (error) {
    console.error("Erreur lors du chargement de la config ou de l'attachement des listeners:", error);
  }
}

const observer = new MutationObserver(scanAndAttachListeners);
createPopup();
scanAndAttachListeners();
observer.observe(document.body, { childList: true, subtree: true });

