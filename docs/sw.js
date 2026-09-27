/* Service worker — SolarDim Panel Optimizer.

   L'application doit marcher sans réseau sur un chantier, et se mettre à
   jour toute seule dès qu'il y en a. Les deux exigences se concilient par
   une stratégie « servir le cache, rafraîchir derrière » : la réponse part
   immédiatement du cache, et la version du réseau, quand elle arrive, y
   prend sa place pour le lancement suivant.

   Incrémenter CACHE purge tout d'un coup ; ce n'est plus indispensable à la
   diffusion d'une mise à jour, seulement à l'éviction de fichiers retirés. */
const CACHE = "panopt-v17";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./style.css?v=15",
  "./brandmark-panel.svg",
  "./panel-optimizer-logo.svg",
  "./app.js",
  "./draw.js",
  "./solar.js",
  "./layout.js",
  "./sites.js",
  "./i18n.js",
  "./localisation.js",
  "./curseur.js",
  "./installer.js",
  "./maj.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./solardim-banniere.webp",
  "./vendor/fonts/fraunces.woff2",
  "./vendor/fonts/dm_sans.woff2"
];

self.addEventListener("install", (e) => {
  // Le cache HTTP peut encore contenir l'ancien habillage : la nouvelle
  // version hors ligne doit repartir des fichiers du serveur.
  const requetes = ASSETS.map((chemin) => new Request(
    new URL(chemin, self.location.href), { cache: "reload" }
  ));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(requetes)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const accesCache = caches.open(CACHE);
  // Revalider même si le cache HTTP juge encore l'ancienne réponse fraîche.
  const surLeReseau = accesCache.then((cache) => fetch(e.request, { cache: "no-cache" })
      .then(async (reponse) => {
        if (reponse && reponse.ok) {
          try { await cache.put(e.request, reponse.clone()); }
          catch { /* Un stockage plein ne doit pas masquer la réponse réseau. */ }
        }
        return reponse;
      })
      .catch(() => null));
  // Sans waitUntil, le worker peut s'arrêter dès que le cache a répondu,
  // avant le téléchargement ou l'écriture de la version suivante.
  e.waitUntil(surLeReseau.then(() => {}));
  e.respondWith(accesCache.then(async (cache) => {
    const enCache = await cache.match(e.request);
    return enCache || surLeReseau.then((r) => r || new Response("", { status: 504 }));
  }));
});
