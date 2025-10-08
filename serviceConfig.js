// Le cerveau de notre extension : un plan pour chaque service.
export const services = [

  // =================================================================
  // =                     DÉPÔTS DE CODE                            =
  // =================================================================

  {
    name: 'GitHub',
    domain: 'github.com',
    regex: /github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/,
    buildApiUrl: (matches) => `https://api.github.com/repos/${matches[1]}/${matches[2].replace(/\.git$/, '')}`,
    parseResponse: (data) => ({
      title: data.full_name,
      description: data.description || 'Aucune description fournie.',
      stats: [
        { label: 'Stars', value: data.stargazers_count, icon: '⭐' },
        { label: 'Forks', value: data.forks_count, icon: '🍴' },
        { label: 'Issues', value: data.open_issues_count, icon: '⚫' }
      ],
      footer: `Dernière MàJ : ${new Date(data.pushed_at).toLocaleDateString('fr-FR')}`
    })
  },

  // =================================================================
  // =               GESTIONNAIRES DE PAQUETS                      =
  // =================================================================

  {
    name: 'NPM',
    domain: 'npmjs.com',
    regex: /npmjs\.com\/package\/([a-zA-Z0-9_.-]+)/,
    buildApiUrl: (matches) => `https://api.npms.io/v2/package/${encodeURIComponent(matches[1])}`,
    parseResponse: (data) => ({
      title: data.collected.metadata.name,
      description: data.collected.metadata.description || 'Aucune description fournie.',
      stats: [
        { label: 'Version', value: data.collected.metadata.version, icon: '📦' },
        { label: 'Qualité', value: `${Math.round(data.score.final * 100)}%`, icon: '🏆' },
        { label: 'Popularité', value: `${Math.round(data.score.detail.popularity * 100)}%`, icon: '🔥' }
      ],
      footer: `Licence : ${data.collected.metadata.license || 'N/A'}`
    })
  },
  {
    name: 'Crates.io',
    domain: 'crates.io',
    regex: /crates\.io\/crates\/([a-zA-Z0-9_-]+)/,
    buildApiUrl: (matches) => `https://crates.io/api/v1/crates/${matches[1]}`,
    parseResponse: (data) => ({
      title: data.crate.id,
      description: data.crate.description || 'Aucune description fournie.',
      stats: [
        { label: 'Version', value: data.crate.max_stable_version, icon: '📦' },
        { label: 'DL Récents', value: (data.crate.recent_downloads || 0).toLocaleString('fr-FR'), icon: '📈' },
        { label: 'DL Total', value: (data.crate.downloads || 0).toLocaleString('fr-FR'), icon: '📥' }
      ],
      footer: `Dernière MàJ : ${new Date(data.crate.updated_at).toLocaleDateString('fr-FR')}`
    })
  },
  {
    name: 'Packagist',
    domain: 'packagist.org',
    regex: /packagist\.org\/packages\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/,
    buildApiUrl: (matches) => `https://repo.packagist.org/p2/${matches[1]}.json`,
    parseResponse: (data) => {
      const pkgKey = Object.keys(data.packages)[0];
      const pkg = data.packages[pkgKey][0];
      return {
        title: pkg.name,
        description: pkg.description || 'Aucune description fournie.',
        stats: [
            { label: 'Version', value: pkg.version, icon: '📦' },
            { label: 'Type', value: pkg.type, icon: '📁' },
            { label: 'Licence', value: (pkg.license || []).join(', '), icon: '📜' }
        ],
        footer: `Publié le : ${new Date(pkg.time).toLocaleDateString('fr-FR')}`
      }
    }
  },
  {
    name: 'Homebrew',
    domain: 'formulae.brew.sh',
    regex: /formulae\.brew\.sh\/formula\/([a-zA-Z0-9+_-]+)/,
    buildApiUrl: (matches) => `https://formulae.brew.sh/api/formula/${matches[1]}.json`,
    parseResponse: (data) => ({
      title: data.full_name,
      description: data.desc,
      stats: [
        { label: 'Version', value: data.versions.stable, icon: '📦' },
        { label: 'Licence', value: data.license || 'N/A', icon: '📜' },
        { label: 'Révision', value: data.revision, icon: '⚙️' }
      ],
      footer: `Homepage : ${new URL(data.homepage).hostname}`
    })
  },

  // =================================================================
  // =                 PLATEFORMES & OUTILS                        =
  // =================================================================

  {
    name: 'Docker Hub',
    domain: 'hub.docker.com',
    regex: /hub\.docker\.com\/(?:r\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)|_\/([a-zA-Z0-9_.-]+))/,
    buildApiUrl: (matches) => {
      const namespace = matches[1] || 'library';
      const repository = matches[2] || matches[3];
      return `https://hub.docker.com/v2/repositories/${namespace}/${repository}/`;
    },
    parseResponse: (data) => ({
      title: `${data.user}/${data.name}`,
      description: data.description || 'Aucune description fournie.',
      stats: [
        { label: 'Pulls', value: data.pull_count.toLocaleString('fr-FR'), icon: '📥' },
        { label: 'Stars', value: data.star_count, icon: '⭐' },
        { label: 'Statut', value: data.is_automated ? 'Automatisé' : 'Manuel', icon: '⚙️' }
      ],
      footer: `Dernière MàJ : ${new Date(data.last_updated).toLocaleDateString('fr-FR')}`
    })
  },
  {
    name: 'Mozilla Add-ons',
    domain: 'addons.mozilla.org',
    regex: /addons\.mozilla\.org\/(?:[a-zA-Z-]+\/)?firefox\/addon\/([a-zA-Z0-9_-]+)/,
    buildApiUrl: (matches) => `https://addons.mozilla.org/api/v5/addons/addon/${matches[1]}/`,
    parseResponse: (data) => ({
      title: data.name.fr || data.name.en || 'N/A',
      description: data.summary.fr || data.summary.en || 'Aucune description fournie.',
      stats: [
        { label: 'Note', value: `${data.ratings.average.toFixed(2)} / 5`, icon: '⭐' },
        { label: 'Utilisateurs', value: data.average_daily_users.toLocaleString('fr-FR'), icon: '🧑‍🤝‍🧑' },
        { label: 'Version', value: data.current_version.version, icon: '📦' }
      ],
      footer: `Dernière MàJ : ${new Date(data.last_updated).toLocaleDateString('fr-FR')}`
    })
  },

  // =================================================================
  // =                COMMUNAUTÉS & CONTENUS                       =
  // =================================================================

  
  {
    name: 'Open Library',
    domain: 'openlibrary.org',
    regex: /openlibrary\.org\/(?:works|books)\/([a-zA-Z0-9_]+)/,
    buildApiUrl: (matches) => `https://openlibrary.org/works/${matches[1]}.json`,
    parseResponse: (data) => ({
      title: data.title,
      description: typeof data.description === 'string' ? data.description.substring(0, 150) + '...' : (data.description?.value || 'Aucune description.').substring(0, 150) + '...',
      stats: [
        { label: 'Sujets', value: (data.subjects || []).slice(0, 2).join(', '), icon: '📚' },
        { label: '1ère Publi.', value: data.first_publish_date || 'N/A', icon: '📅' },
        { label: 'Révisions', value: data.revision, icon: '⚙️' }
      ],
      footer: `Dernière modification : ${new Date(data.last_modified.value).toLocaleDateString('fr-FR')}`
    })
  },
  
  // =================================================================
  // =                   DONNÉES OUVERTES                          =
  // =================================================================

  {
    name: 'data.gouv.fr',
    domain: 'data.gouv.fr',
    regex: /data\.gouv\.fr\/(?:[a-z]+\/)?datasets\/([a-zA-Z0-9_-]+)/,
    buildApiUrl: (matches) => `https://www.data.gouv.fr/api/1/datasets/${matches[1]}/`,
    parseResponse: (data) => ({
      title: data.title,
      description: data.description ? data.description.substring(0, 150) + '...' : 'Aucune description.',
      stats: [
        { label: 'Organisation', value: data.organization ? data.organization.name : 'N/A', icon: '🏢' },
        { label: 'Licence', value: data.license || 'N/A', icon: '📜' },
        { label: 'Fréquence', value: data.frequency || 'N/A', icon: '🔄' }
      ],
      footer: `Dernière MàJ : ${new Date(data.last_modified).toLocaleDateString('fr-FR')}`
    })
  }

];

