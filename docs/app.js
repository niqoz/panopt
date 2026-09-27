/* Assemblage de l'interface. Toute la physique vit dans solar.js et
   layout.js, tout le dessin dans draw.js ; ce fichier ne fait que relier
   les commandes aux schémas. */

import { SEASONS, tiltAnalysis, tiltSweep } from "./solar.js";
import { rowLayout, shadeFreeWindow } from "./layout.js";
import { CITIES, COUNTRIES, nearestCity } from "./sites.js";
import { LANGUES, langueInitiale, nombre, gabarit, TEXTES } from "./i18n.js";
import { limiterALaPoignee } from "./curseur.js";
import { initInstallation } from "./installer.js";
import { initMiseAJour } from "./maj.js";
import { creerLocalisation } from "./localisation.js";
import { drawTilt, drawRows, drawLossCurve, m, deg, pct, hm } from "./draw.js";

/** Longueurs de panneau usuelles, mesurées dans le sens de la pente.
    Les modules courants font 113 cm de large pour 196 ou 228 cm de long :
    posés en paysage c'est la largeur qui se trouve dans la pente, en
    portrait c'est la longueur. Deux modules paysage superposés font donc
    2,26 m, à deux centimètres près la même chose qu'un module portrait
    long — ce sont bien deux montages différents, pas un doublon.
    Les libellés vivent dans i18n.js, ici les seules valeurs. */
const LONGUEURS = [1.13, 1.96, 2.26, 2.28];

/* L'orientation et l'inclinaison décrivent un seul et même chantier : elles
   sont communes aux trois onglets, et non recopiées de l'un à l'autre. On
   règle l'inclinaison là où on la voit le mieux, l'écartement des rangées
   suit, et la perte annuelle correspondante reste lisible dans l'onglet
   Inclinaison. */
const defauts = {
  // La longitude ne sert à aucun calcul d'ici — le soleil y est repéré en
  // heure solaire vraie. Elle est retenue parce que le fichier repris par
  // SolarDim décrit un chantier, et qu'un chantier a deux coordonnées.
  lat: 45.8, lon: 4.85, climat: "sudouest", ville: "Lyon",
  azimut: 0, tilt: 30, saison: "annee",
  longueur: 1.96, critere: "solstice_6h"
};

const CLE = "panopt.reglages";
let etat = { ...defauts };
try { Object.assign(etat, JSON.parse(localStorage.getItem(CLE) || "{}")); } catch { /* premier lancement */ }

/* Langue de l'interface : le choix enregistré d'abord, sinon la première
   langue livrée parmi celles de l'appareil, sinon le français. */
const CLE_LANGUE = "panopt.langue";
let langueEnregistree = null;
try { langueEnregistree = JSON.parse(localStorage.getItem(CLE_LANGUE) || "null"); } catch { /* premier lancement */ }
let langue = langueInitiale({
  enregistree: langueEnregistree,
  langues: (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).filter(Boolean)
});
const T = () => TEXTES[langue];
const sauverLangue = () => { try { localStorage.setItem(CLE_LANGUE, JSON.stringify(langue)); } catch { /* mode prive */ } };

const $ = (id) => document.getElementById(id);
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* mode prive */ } };

/** Orientation en toutes lettres : personne ne raisonne en degrés d'azimut
    sur un toit. Les neuf noms vivent dans i18n.js, dans cet ordre. */
function nomAzimut(a) {
  const angles = [-90, -67, -45, -22, 0, 22, 45, 67, 90];
  const noms = T().azimuts;
  return noms[angles.reduce((best, n, i) =>
    (Math.abs(n - a) < Math.abs(angles[best] - a) ? i : best), 4)];
}

/* --- Construction des commandes ------------------------------------------- */

function remplirSelect(el, entrees, valeur) {
  el.innerHTML = entrees.map(([v, t]) =>
    `<option value="${v}"${v === valeur ? " selected" : ""}>${t}</option>`).join("");
}

/** Groupe de boutons exclusifs, plus sur au doigt qu'un menu déroulant. */
function groupeChoix(el, entrees, valeur, onChange) {
  el.innerHTML = entrees.map(([v, t, sous]) =>
    `<button type="button" role="radio" data-v="${v}" aria-checked="${v === valeur}">${t}${
      sous ? `<small>${sous}</small>` : ""}</button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    for (const x of el.querySelectorAll("button")) x.setAttribute("aria-checked", x === b);
    onChange(b.dataset.v);
  };
}

/* --- Vue 1 : inclinaison --------------------------------------------------- */

function rendreInclinaison() {
  const mois = SEASONS[etat.saison].months;
  const a = tiltAnalysis(etat.lat, etat.tilt, etat.azimut, etat.climat, 0.2, mois);

  $("plan-inclinaison").innerHTML = drawTilt({ tilt: etat.tilt, optimal: a.optimal, langue });
  $("courbe-perte").innerHTML = drawLossCurve({ sweep: a.sweep, tilt: etat.tilt, langue });

  const proche = Math.abs(a.optimal - etat.tilt) <= 1;
  $("verdict-inclinaison").innerHTML = proche
    ? gabarit(T().verdictProche, { tilt: deg(etat.tilt), azimut: nomAzimut(etat.azimut) })
    : gabarit(T().verdictPerte, {
      tilt: deg(etat.tilt), azimut: nomAzimut(etat.azimut),
      perte: pct(a.loss, langue), optimal: deg(a.optimal)
    });

  const loss = a.sweep.yield.map((v) => (1 - v / a.sweep.best.value) * 100);
  const dans = loss.map((p, i) => (p <= 5 ? i : -1)).filter((i) => i >= 0);
  $("legende-plage").textContent =
    gabarit(T().legendePlage, { a: dans[0], z: dans[dans.length - 1] }) + " "
    + gabarit(T().calculeSur, {
      periode: T().saisons[etat.saison].hint,
      ciel: T().climats[etat.climat].label.toLowerCase()
    });
}

/* --- Vue 2 : rangées ------------------------------------------------------- */

function rendreRangees() {
  const l = rowLayout(etat.lat, etat.longueur, etat.tilt, etat.azimut, etat.critere);
  $("plan-rangees").innerHTML = drawRows({ length: etat.longueur, tilt: etat.tilt, layout: l, langue });

  $("verdict-rangees").innerHTML =
    gabarit(T().verdictRangees, { esp: m(l.spacing, langue), pas: m(l.pitch, langue) });

  const w = shadeFreeWindow(etat.lat, etat.longueur, etat.tilt, etat.azimut, l.pitch, 12, 21);
  $("chiffres-rangees").innerHTML = [
    [T().hauteur, m(l.rise, langue)],
    [T().emprise, m(l.run, langue)],
    [T().couverture, `${Math.round(l.gcr * 100)} %`],
    [T().soleil, `${deg(l.sun.elevation)} ${T().soleilConn} ${hm(l.sun.hour)}`],
    [gabarit(T().sansOmbre, { mois: T().mois[11] }), w ? gabarit(T().heures, { h: nombre(w.hours, 1, langue) }) : T().jamais]
  ].map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join("");
}

/* --- Orchestration --------------------------------------------------------- */

let vue = "inclinaison";
let localisation;
const rendus = { inclinaison: rendreInclinaison, rangees: rendreRangees };

function rendre() {
  for (const recaler of curseurs) recaler();
  $("site-libelle").textContent = etat.ville;
  $("site-detail").textContent = T().climats[etat.climat].label;
  localisation?.actualiser();
  rendus[vue]();
  sauver();
}

/* Une même valeur est portée par plusieurs curseurs, un par onglet : chacun
   doit se recaler quand un autre l'a modifiée. */
const curseurs = [];

/** Curseur relié à une clé d'état, avec sa valeur affichée en direct. */
function curseur(id, cle, format) {
  const el = $(id), out = $(`${id}-val`);
  limiterALaPoignee(el);
  const afficher = () => { if (out) out.textContent = format(Number(el.value)); };
  const recaler = () => { el.value = etat[cle]; afficher(); };
  curseurs.push(recaler);
  el.addEventListener("input", () => {
    etat[cle] = Number(el.value);
    if (cle === "lat") localisation?.effacerMessage();
    afficher();
    rendre();
  });
  recaler();
}

function initOnglets() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const activer = (tab, ancre = true) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    }
    vue = tab.id.replace("tab-", "");
    if (ancre && location.hash.slice(1) !== vue) history.replaceState(null, "", `#${vue}`);
    rendre();
  };
  const parAncre = () => {
    const t = tabs.find((x) => x.id === `tab-${location.hash.slice(1)}`);
    if (t) activer(t, false);
  };
  addEventListener("hashchange", parAncre);
  parAncre();
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => activer(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const suivant = tabs[(i + d + tabs.length) % tabs.length];
      suivant.focus();
      activer(suivant);
    });
  });
}

function initSite() {
  const bouton = $("ouvrir-site"), panneau = $("site");
  bouton.addEventListener("click", () => {
    const ouvert = panneau.hidden;
    panneau.hidden = !ouvert;
    bouton.setAttribute("aria-expanded", ouvert);
  });

  majVilles();
  $("ville").addEventListener("change", (e) => {
    const c = CITIES.find((x) => x[0] === e.target.value);
    if (!c) return; // entrée « position relevée », rien à recharger
    etat.ville = c[0]; etat.lat = c[1]; etat.lon = c[2]; etat.climat = c[3];
    localisation.effacerMessage();
    $("latitude").value = etat.lat;
    $("latitude-val").textContent = `${nombre(etat.lat, 1, langue)}°`;
    $("climat").value = etat.climat;
    majAideClimat();
    rendre();
  });

  remplirSelect($("climat"), Object.entries(T().climats).map(([k, v]) => [k, v.label]), etat.climat);
  $("climat").addEventListener("change", (e) => { etat.climat = e.target.value; majAideClimat(); rendre(); });

  curseur("latitude", "lat", (v) => `${nombre(v, 1, langue)}°`);

  localisation = creerLocalisation({
    navigateur: navigator,
    lireSite: () => etat,
    lireLangue: () => langue,
    afficher: ({ visible, enCours, message }) => {
      const raccourci = $("ma-loc");
      if (raccourci) {
        raccourci.hidden = !visible;
        raccourci.disabled = enCours;
        raccourci.textContent = enCours ? T().releveEncours : T().meLocaliser;
      }
      $("geoloc").disabled = enCours;
      $("geoloc-etat").textContent = message;
      const retour = $("ma-loc-etat");
      if (retour) retour.textContent = message;
    },
    appliquer: (coords) => {
      // Nommer un repère situé à 70 km induit en erreur : au-delà de
      // 25 km on s'en tient à la position, la latitude et la zone suffisent.
      const proche = nearestCity(coords.latitude, coords.longitude);
      etat.lat = Math.round(coords.latitude * 10) / 10;
      etat.lon = Math.round(coords.longitude * 100) / 100;
      etat.climat = proche.zone;
      etat.ville = proche.km <= 8 ? proche.name
        : proche.km <= 25 ? gabarit(T().presDe, { ville: proche.name }) : T().villePosition;
      $("latitude").value = etat.lat;
      $("latitude-val").textContent = `${nombre(etat.lat, 1, langue)}°`;
      $("climat").value = etat.climat;
      majVilles();
      majAideClimat();
      const message = proche.km <= 25
        ? gabarit(T().positionKm, { km: proche.km, ville: proche.name })
        : T().positionSeule;
      rendre();
      return message;
    }
  });
  $("geoloc").addEventListener("click", () => localisation.relever());
  $("ma-loc")?.addEventListener("click", () => localisation.relever());
  localisation.verifier();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) localisation.verifier();
  });
}

const majAideClimat = () => { $("climat-aide").textContent = T().climats[etat.climat].hint; };

/** Menu des villes, groupé par pays : quatre-vingt-dix repères à la file
    seraient illisibles au pouce. Une position relevée qui ne tombe sur aucun
    repère figure en tête, plutôt que de laisser le menu afficher une ville
    sans rapport avec l'endroit où l'on se trouve. */
function majVilles() {
  const connue = CITIES.some((c) => c[0] === etat.ville);
  const option = (v, t) =>
    `<option value="${v}"${v === (connue ? etat.ville : "") ? " selected" : ""}>${t}</option>`;
  const groupes = COUNTRIES.map(([code]) => {
    const villes = CITIES.filter((c) => c[4] === code);
    return villes.length
      ? `<optgroup label="${T().pays[code]}">${villes.map((c) => option(c[0], c[0])).join("")}</optgroup>`
      : "";
  });
  $("ville").innerHTML = (connue ? "" : option("", etat.ville)) + groupes.join("");
}

/* Listes et groupes de choix, seuls éléments reconstruits à chaque
   changement de langue : tout le reste se recale dans rendre(). */
function reconstruireChoix() {
  groupeChoix($("saison"), Object.entries(T().saisons).map(([k, v]) => [k, v.label, v.hint]), etat.saison,
    (v) => { etat.saison = v; rendre(); });
  groupeChoix($("longueur-choix"), LONGUEURS.map((v) => [v, `${nombre(v, 2, langue)} m`, T().longueurs[String(v)]]),
    etat.longueur, (v) => majLongueur(Number(v)));
  remplirSelect($("climat"), Object.entries(T().climats).map(([k, v]) => [k, v.label]), etat.climat);
  remplirSelect($("critere"), Object.entries(T().criteres).map(([k, v]) => [k, v]), etat.critere);
  majVilles();
  majAideClimat();
}

function initCommandes() {
  curseur("inclinaison-p", "tilt", deg);
  curseur("azimut-p", "azimut", (v) => `${deg(Math.abs(v))} ${nomAzimut(v)}`);

  const saisie = $("longueur");
  saisie.value = etat.longueur;
  saisie.addEventListener("change", () => majLongueur(Number(saisie.value)));

  curseur("azimut-r", "azimut", (v) => `${deg(Math.abs(v))} ${nomAzimut(v)}`);
  curseur("inclinaison-r", "tilt", deg);
  $("critere").addEventListener("change", (e) => { etat.critere = e.target.value; rendre(); });

  reconstruireChoix();
}

/** Longueur saisie au clavier, bornée à la plage du champ. */
function majLongueur(v) {
  etat.longueur = Math.min(8, Math.max(0.5, v));
  $("longueur").value = etat.longueur;
  rendre();
}

/* Textes statiques de la page : le français reste en dur dans index.html
   pour les moteurs de recherche, et ce balayage y substitue la langue
   choisie au démarrage puis à chaque changement. La bannière n'existe
   qu'en français : elle se masque ailleurs. */
function appliquerStatiques() {
  const t = T();
  document.documentElement.lang = langue;
  document.title = t.titre;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t.description);
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const texte = t[el.getAttribute("data-i18n")];
    if (texte !== undefined) el.textContent = texte;
  }
  for (const el of document.querySelectorAll("[data-i18n-html]")) {
    const texte = t[el.getAttribute("data-i18n-html")];
    if (texte !== undefined) el.innerHTML = texte;
  }
  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    el.setAttribute("aria-label", t[el.getAttribute("data-i18n-aria")] ?? "");
  }
  for (const el of document.querySelectorAll("[data-i18n-title]")) {
    el.setAttribute("title", t[el.getAttribute("data-i18n-title")] ?? "");
  }
  for (const el of document.querySelectorAll("[data-i18n-alt]")) {
    el.setAttribute("alt", t[el.getAttribute("data-i18n-alt")] ?? "");
  }
  for (const el of document.querySelectorAll("[data-repere]")) {
    el.textContent = t.reperes[Number(el.getAttribute("data-repere"))];
  }
  $("promo").hidden = langue !== "fr";
}

function initLangue() {
  const select = $("langue");
  select.value = langue;
  appliquerStatiques();
  select.addEventListener("change", (e) => {
    if (!LANGUES.includes(e.target.value)) return;
    langue = e.target.value;
    sauverLangue();
    appliquerStatiques();
    reconstruireChoix();
    rendre();
  });
}

initOnglets();
initSite();
initCommandes();
initLangue();
majAideClimat();
rendre();

initInstallation({
  bloc: $("installer"),
  texte: $("installer-texte"),
  bouton: $("installer-bouton"),
  lireLangue: () => langue
});

addEventListener("load", () => initMiseAJour());
