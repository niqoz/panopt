# SolarDim Panel Optimizer — notes pour les sessions suivantes

Application satellite de SolarDim, utilisable hors connexion, pour calculer
l'inclinaison et la distance entre rangées. Deux onglets, Inclinaison et
Rangées. Voir `README.md` pour le modèle et ses limites.

## Conventions

- Pas de dépendance, pas de build. Modules ES chargés directement par le
  navigateur ; les tests tournent sous `node --test` sur les mêmes fichiers.
- Tout ce qui est livré vit dans `docs/` (GitHub Pages sert ce dossier). Les
  tiers sont versionnés dans `docs/vendor/`, jamais récupérés au build.
- Commentaires et libellés en français accentué. Les identifiants de code
  restent sans accents (`etat`, `critere`, `rangees`) : ne pas les « corriger ».
- Un test vérifie que la liste `ASSETS` de `docs/sw.js` couvre bien tous les
  fichiers livrés. Incrémenter `CACHE` n'est plus nécessaire pour diffuser une
  mise à jour, seulement pour évincer des fichiers retirés.

## Habillage

Palette « Terrasse » reprise de SolarDim (`~/Projets/solardim-site/index.html`
pour les variables CSS, `SolairDimDroid/.../ui/theme/Color.kt` pour leur
commentaire d'origine) : beige papier, encre brune, terracotta en accent,
Fraunces en titres et valeurs chiffrées, DM Sans en corps, étiquettes en
petites capitales monospacées. La séparation se fait au trait, jamais à
l'ombre. Le mode sombre est porté à l'identique, avec les trois sélecteurs de
la source : `:root`, le `@media` et `:root[data-theme="dark"]` — ce dernier
sert aussi à vérifier le rendu sombre en capture.

Fraunces est nettement plus large que la condensée employée auparavant :
toute reprise des schémas doit revérifier que les cotes tiennent dans leur
cadre.

Les schémas prennent leurs couleurs des variables CSS, jamais de littéraux :
le mode sombre suit alors sans retouche.

## Pièges déjà rencontrés

- **Corrélation d'Erbs** : la forme horaire et la forme journalière diffèrent
  nettement. Appliquer l'horaire à un indice de clarté journalier surévalue le
  diffus de moitié et rend le modèle aveugle à l'orientation.
- **Ciel voilé** : un modèle binaire clair/couvert suffit à fausser
  l'inclinaison optimale de 4°. Le régime voilé est dominant en France.
- **Attribut `hidden`** : son `display:none` est de faible priorité et se fait
  écraser par toute règle de mise en page. D'où le `[hidden]{display:none
  !important}` de `style.css`.
- **Ancres d'onglet** : elles ne doivent correspondre à aucun `id` de champ,
  sinon le navigateur fait défiler la page à l'ouverture du lien.
- **Zone climatique** : elle est celle du repère le plus proche dans
  `sites.js`, et non un découpage géographique séparé. Une heuristique lat/lon
  avait été écrite en parallèle du tableau : les deux divergeaient sur six
  villes. Une seule source de vérité, le tableau.
- **Le nom d'un repère est sa clé**, dans le menu comme dans l'état
  enregistré. Deux « Valence » — la Drôme et l'Espagne — se sont glissées à
  l'ouverture européenne : choisir l'une chargeait les coordonnées de l'autre.
  L'espagnole est devenue « Valencia », et un test interdit les homonymes.
- **Les cinq zones ne sont pas des régions**, ce sont des **formes de ciel** :
  elles portent la répartition saisonnière et la part diffuse, pas le niveau
  d'irradiation, que la latitude reprend à son compte. C'est pourquoi elles
  couvrent l'Europe de l'Ouest sans qu'il faille en ajouter — mesuré, non
  supposé (`tools/kt-pvgis.mjs`, 62 villes). Corollaire : **le niveau absolu
  n'est pas garanti hors de France** (7 % d'écart à Faro). Rien ne l'affiche
  aujourd'hui ; afficher un kWh/m² imposerait de recaler les zones d'abord.
- Les paramètres du modèle de ciel (`TUNING` dans `solar.js`) sont dégénérés :
  les optimiser tous les trois ensemble les envoie aux bornes du domaine sans
  gain réel. Les valeurs actuelles sont un compromis assumé.

## Structure d'une vue

Chaque onglet se découpe en trois blocs, enfants directs de la `section` :
`.apercu` (schéma + verdict, précédés du choix de période dans Inclinaison ;
dans Rangées, il contient aussi le choix du panneau et les deux curseurs),
`.details` (courbe ou tableau de chiffres) et `.reglages` (les autres champs).
Dans Inclinaison seulement, l'aperçu reste `sticky` sur téléphone afin que le
schéma accompagne les curseurs. Celui de Rangées doit au contraire défiler :
ses curseurs sont placés directement sous le schéma dans `.reglages-directs`.

Les curseurs ne répondent qu'à une prise sur leur poignée (`curseur.js`) :
sur un chantier, un appui sur la piste pendant un défilement modifiait un
réglage sans qu'on le voie. **`preventDefault()` sur `pointerdown` ne suffit
pas** — les navigateurs déplacent la poignée dans leur code natif, hors de
portée de l'événement. Le mécanisme laisse donc le déplacement se produire
puis restaure la valeur, via un écouteur `input` posé sur le `document` en
phase de capture, qui passe avant tout écouteur de l'application.

L'orientation et l'inclinaison sont **une seule valeur** partagée par les
deux onglets, pas une copie propagée : elles décrivent le même chantier. Un
même réglage est donc porté par plusieurs curseurs, que `rendre()` recale
tous à chaque rendu ; leurs bornes `min` et `max` doivent rester identiques,
sinon passer d'un onglet à l'autre tronquerait la valeur.

Les champs sont numérotés dans l'ordre de réglage réel sur le terrain. Dans
Rangées, le panneau ouvre désormais la vue afin que sa géométrie soit fixée
avant de lire le schéma ; viennent ensuite l'orientation, l'inclinaison et le
critère d'ombrage.

## Couverture géographique

Les repères de `sites.js` couvrent les douze pays d'Europe de l'Ouest où
SolarDim se distribue, groupés par pays dans le menu — quatre-vingt-dix à la
file seraient illisibles au pouce. Le curseur de latitude va de 35 à 60° :
ses bornes et le contenu du tableau se tiennent, un repère hors course se
recalerait en silence, et un test le vérifie.

Tout est **hémisphère nord**, et le rester est une hypothèse du code, pas une
limite du moteur : les critères d'ombrage de `layout.js` sont datés au 21
décembre, qui est le solstice d'**été** au sud de l'équateur. Un champ chilien
y obtiendrait 0,10 m d'écartement au lieu de 1,21 m, avec un taux de
couverture de 105 %. Aujourd'hui le curseur de latitude l'interdit ; l'ouvrir
sans retourner les critères, les saisons et le sens de l'azimut ferait un
calcul faux qui ne se signale pas.

## Diffusion et référencement

L'outil est le produit d'appel de SolarDim, payante sur le Play Store : il doit
donc être **trouvable**, ce qu'une page dont tout est calculé en JavaScript
n'est pas. D'où le fond de page — les six questions sous l'outil, seule matière
lisible par un moteur —, masqué en `display-mode: standalone` puisqu'une
application installée n'a plus de moteur de recherche derrière elle.

**L'adresse du site est écrite en dur à sept endroits** : `canonical`,
`og:url`, `og:image` et le JSON-LD d'`index.html`, plus `sitemap.xml` et
`robots.txt`. Sans build, rien ne les dérive d'une variable — un changement de
domaine est un `sed` sur `docs/`, décrit dans le README. `robots.txt` n'agit
qu'à la racine d'un domaine : sous un sous-chemin de `github.io` il est ignoré.

`docs/partage.png` est **produit**, pas dessiné : `tools/image-partage.html`
rejoue le schéma de l'application sur un calcul réel, et Chrome en tire le PNG.
Une vignette qui montre autre chose que le produit vieillit mal.

Ces trois fichiers — vignette, `robots.txt`, `sitemap.xml` — sont **hors du
cache hors ligne**, et le test le vérifie : ils ne servent qu'aux moteurs et
aux aperçus de partage, les mettre en cache ferait porter la vignette au
forfait d'un installateur sur un chantier.

Rien n'est mesuré dans l'application. L'acquisition se lira côté Play Console,
par le `referrer` du lien vers la fiche — lien qui attend la publication.

## Bannière SolarDim

Le pied de page porte la bannière publicitaire de l'application, reprise de
`~/Projets/SolairDimDroid/publicite/traductions/` (six langues, toutes
livrées, seule la française préchargée) et convertie en WebP — le PNG d'origine pèse
1,2 Mo, ce qui n'a rien à faire dans un cache hors ligne. Elle est carrée :
`.promo` plafonne sa largeur, sans quoi elle mange l'écran. Pas de lien tant
que la fiche Play Store n'est pas publiée ; l'URL de campagne attend dans le
README.

## Invite d'installation

`installer.js` propose un bouton là où le navigateur émet
`beforeinstallprompt`, et décrit la manœuvre sur iOS, qui n'a pas d'API :
seul Safari installe vraiment, les autres navigateurs iOS n'ont pas accès au
moteur. Deux pièges de détection, couverts par les tests : iPadOS 13 et
suivants envoient une signature de Mac — seul `maxTouchPoints` les en
distingue — et tous les navigateurs iOS portent « Safari » dans la leur.

Le bloc reste caché tant qu'aucune installation n'est possible : mieux vaut
ne rien afficher que promettre ce que le navigateur ne fera pas.

## Mise à jour d'une application installée

Une application lancée depuis l'écran d'accueil n'est jamais rechargée : elle
est mise en veille puis reprise, et le tirer-pour-rafraîchir n'existe pas en
mode autonome. Un service worker « cache d'abord » sert alors indéfiniment la
version qu'il a mise de côté — c'est le symptôme qui a été signalé.

Deux pièces y répondent : `sw.js` sert le cache puis le rafraîchit derrière,
et `maj.js` appelle `update()` au démarrage, à chaque retour au premier plan
et au retour du réseau, puis recharge la page quand le nouveau service worker
prend la main. Le rechargement est sans risque, les réglages étant enregistrés
à chaque modification. Attention au premier lancement : il n'y a alors aucun
contrôleur, et la prise de contrôle initiale ne doit pas déclencher de
rechargement.

`tests/navigateur/mise-a-jour.sh` rejoue le scénario complet. Il a été vérifié
qu'il échoue bien avec l'ancien service worker.

**Le câblage est aussi fragile que le mécanisme.** `addEventListener("load",
initMiseAJour)` passe l'objet Event en premier argument, donc en guise de
chemin : `register()` demande « [object Event] », le 404 tombe dans le `catch`
du hors-ligne, et l'application cesse silencieusement de se mettre à jour. Le
défaut a vécu du commit `bd321d1` au 3 septembre 2026 sans que rien le montre
— `mise-a-jour.sh` appelle `initMiseAJour()` lui-même et n'éprouve donc jamais
la ligne d'`app.js`. La fonction ignore désormais un argument qui n'est pas une
chaîne, et `tests/maj.test.mjs` verrouille les deux côtés : le chemin demandé
au navigateur, et la forme du câblage dans `app.js`.

## Essais en navigateur

`tests/navigateur/lancer.sh` exécute **toutes** les pages de
`tests/navigateur/` dans Chrome et lit leur verdict via `--dump-dom` ; il ne
s'arrête pas à la première en échec, sans quoi une page cacherait les
suivantes. Ces essais portent sur l'ordre
des écouteurs et la propagation des événements, que node ne reproduit pas.
Ils ne sont pas dans `npm test`, qui reste sans dépendance au navigateur.

## Vérification visuelle

L'extension Chrome n'était pas connectée ; les captures se font en headless :

```sh
python3 -m http.server 8931 -d docs &
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --window-size=390,1150 \
  --screenshot=/tmp/vue.png "http://127.0.0.1:8931/#rangees"
```

Les ancres `#inclinaison` et `#rangees` ouvrent directement un onglet, ce
qui permet de capturer chaque vue sans clic.

## Langues

Six langues (fr, en, de, it, es, pt) dans le seul `docs/i18n.js`. La langue
suit l'appareil, un sélecteur de l'entête la fixe (`panopt.langue`), le
français sert de repli. Le français reste **en dur dans `index.html`** : c'est
ce que lisent les moteurs de recherche, le JavaScript le remplace au
démarrage via les attributs `data-i18n*`.

- **Les libellés n'existent qu'une fois**, dans `i18n.js`. Le moteur ne porte
  que des clés : `CLIMATES`, `SEASONS`, `CRITERIA` et `COUNTRIES` n'ont plus
  de `label`. Y remettre du texte recréerait deux sources qui divergent.
- **Aucun texte affiché ne se garde tout fait.** Un message conservé en
  chaîne reste dans l'ancienne langue après un changement : les messages de
  `localisation.js` et d'`installer.js` sont des fonctions rejouées à
  l'affichage, et un relevé GPS enregistre `ville` + `pres` et non « Près de
  Lyon ». Les réglages antérieurs, qui portaient ce libellé français, sont
  convertis au chargement dans `app.js`.
- Un test impose aux six dictionnaires la même forme, et à chaque chaîne les
  mêmes `{variables}` qu'en français : une variable perdue disparaîtrait du
  texte sans bruit.
- L'heure passe par `heure()` : « 9 h » en français n'est pas lisible en
  anglais (« 9 am ») ni en allemand (« 9 Uhr »).
- Les six bannières sont livrées, mais seule la française est préchargée ;
  les autres entrent dans le cache à leur premier affichage.

## Ce qui a été retiré

L'onglet « Terrain » — calepinage sur profondeur contrainte : `fieldSweep`,
`rowSteps`, `rowCount`, `fieldYield`, paliers de rangées et estimation en
MWc/ha — a été retiré à la demande de l'utilisateur, avec son moteur, ses
tests et ses styles plutôt que laissé sans emploi. Le tout reste récupérable
au commit `1349813`.

La **reprise des réglages dans SolarDim** — `transfert.js`, son « transfer
v2 », ses tests node et sa page d'essai navigateur — a été retirée de même :
l'utilisateur ne veut pas d'échange de paramètres entre les deux applications.
La bannière occupe désormais sa place dans le pied.
