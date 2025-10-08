let popup = null;
let hoverTimeout = null;

// Fonction pour créer la popup (une seule fois)
function createPopup() {
  if (popup) return;
  
  fetch(chrome.runtime.getURL('popup.html'))
    .then(r => r.text())
    .then(html => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // FIX : Utiliser querySelector est plus fiable que firstChild
      popup = tempDiv.querySelector('#github-popup-card'); 
      
      if (popup) {
        document.body.appendChild(popup);
      }
    });
}

// Fonction pour mettre à jour et afficher la popup
function showPopup(event, data) {
  // FIX : On vérifie que la popup est bien prête avant de l'utiliser
  if (!popup) return;

  // Mise à jour des informations
  popup.querySelector('#repo-name').textContent = data.full_name;
  popup.querySelector('#repo-desc').textContent = data.description || 'Pas de description.';
  popup.querySelector('#repo-stars').textContent = data.stargazers_count;
  popup.querySelector('#repo-forks').textContent = data.forks_count;
  popup.querySelector('#repo-issues').textContent = data.open_issues_count;
  
  const lastUpdate = new Date(data.pushed_at).toLocaleDateString();
  popup.querySelector('#repo-last-commit').textContent = `Dernière MàJ : ${lastUpdate}`;
  
  // Positionnement et affichage
  popup.style.top = `${event.pageY + 15}px`;
  popup.style.left = `${event.pageX + 15}px`;
  popup.classList.add('visible');
}

// Fonction pour cacher la popup
function hidePopup() {
    // FIX : On vérifie aussi ici que la popup existe
    if (popup) {
        popup.classList.remove('visible');
    }
}

// Fonction principale pour trouver et gérer les liens GitHub
function setupGitHubLinks() {
  const links = document.querySelectorAll('a[href*="github.com"]');
  const repoRegex = /github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/;

  links.forEach(link => {
    const match = link.href.match(repoRegex);
    
    if (match && match[1] && match[2]) {
      const owner = match[1];
      const repo = match[2].replace(/.git$/, '');

      link.addEventListener('mouseenter', (event) => {
        hoverTimeout = setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'getRepoInfo', owner, repo }, (response) => {
            // S'assurer que la réponse est valide avant d'afficher
            if (chrome.runtime.lastError) {
              // Gérer les erreurs de communication avec le background script
              console.error(chrome.runtime.lastError.message);
              return;
            }
            if (response && response.success) {
              showPopup(event, response.data);
            }
          });
        }, 500);
      });

      link.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        hidePopup();
      });
    }
  });
}

// Initialisation
createPopup();
setupGitHubLinks();