import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGUES, langueInitiale, separateur, nombre, heure, gabarit, TEXTES } from "../docs/i18n.js";
import { CLIMATES, SEASONS } from "../docs/solar.js";
import { CRITERIA } from "../docs/layout.js";
import { COUNTRIES } from "../docs/sites.js";

/* La langue suit l'appareil, avec le français comme repli : un navigateur
   en néerlandais (pays couvert, langue non livrée) retombe dessus plutôt
   que sur une langue à moitié devinée. */

test("les étiquettes d'appareil se ramènent aux langues livrées", () => {
  const de = (etiquette) => langueInitiale({ langues: [etiquette] });
  assert.equal(de("fr-FR"), "fr");
  assert.equal(de("de-CH"), "de");
  assert.equal(de("pt_BR"), "pt");
  assert.equal(de("en-US"), "en");
  assert.equal(de("nl"), "fr");
  assert.equal(langueInitiale(), "fr");
});

test("le choix enregistré prime sur l'appareil", () => {
  assert.equal(langueInitiale({ enregistree: "de", langues: ["fr-FR"] }), "de");
  assert.equal(langueInitiale({ enregistree: "xx", langues: ["it-IT"] }), "it");
  assert.equal(langueInitiale({ enregistree: null, langues: ["es-ES", "fr-FR"] }), "es");
  assert.equal(langueInitiale({ enregistree: null, langues: ["nl", "en-US"] }), "en");
  assert.equal(langueInitiale({ enregistree: null, langues: [] }), "fr");
});

test("le séparateur décimal suit la langue", () => {
  assert.equal(separateur("en"), ".");
  for (const l of ["fr", "de", "it", "es", "pt"]) assert.equal(separateur(l), ",");
  assert.equal(nombre(2.26, 2, "fr"), "2,26");
  assert.equal(nombre(2.26, 2, "en"), "2.26");
});

test("l'heure suit les usages de chaque langue", () => {
  assert.equal(heure(9, "fr"), "9 h");
  assert.equal(heure(9.5, "fr"), "9 h 30");
  assert.equal(heure(9, "en"), "9 am");
  assert.equal(heure(12, "en"), "12 pm");
  assert.equal(heure(15.25, "en"), "3:15 pm");
  assert.equal(heure(9, "de"), "9 Uhr");
  assert.equal(heure(9.5, "it"), "9:30");
  assert.equal(heure(9, "es"), "9 h");
  assert.equal(heure(9.5, "pt"), "9h30");
});

test("les modèles remplacent toutes leurs clés", () => {
  assert.equal(gabarit("<b>{tilt} {azimut}</b>", { tilt: "30°", azimut: "plein sud" }), "<b>30° plein sud</b>");
});

/* Un libellé oublié dans une langue ferait réapparaître du français au
   milieu d'une page allemande : les six dictionnaires ont la même forme. */

function forme(t) {
  if (Array.isArray(t)) return t.map(forme);
  if (t && typeof t === "object") {
    const cles = Object.keys(t).sort();
    return cles.map((k) => [k, forme(t[k])]);
  }
  return typeof t;
}

test("les six langues partagent la même forme de dictionnaire", () => {
  const reference = JSON.stringify(forme(TEXTES.fr));
  for (const l of LANGUES) {
    assert.equal(JSON.stringify(forme(TEXTES[l])), reference, `clés de « ${l} »`);
  }
});

test("les libellés de données couvrent les clés du moteur", () => {
  for (const l of LANGUES) {
    const t = TEXTES[l];
    for (const k of Object.keys(CLIMATES)) assert.ok(k in t.climats, `${l} : climat ${k}`);
    for (const k of Object.keys(SEASONS)) assert.ok(k in t.saisons, `${l} : saison ${k}`);
    for (const k of Object.keys(CRITERIA)) assert.ok(k in t.criteres, `${l} : critère ${k}`);
    for (const code of COUNTRIES) assert.ok(code in t.pays, `${l} : pays ${code}`);
    assert.equal(t.mois.length, 12, `${l} : mois`);
    assert.equal(t.azimuts.length, 9, `${l} : azimuts`);
    assert.equal(t.reperes.length, 5, `${l} : repères`);
  }
});

/* Une variable perdue en traduction ne casse rien : elle disparaît du
   texte sans bruit. Chaque chaîne doit donc porter, dans chaque langue,
   exactement les mêmes {variables} qu'en français. */

function chaines(t, chemin = "") {
  if (typeof t === "string") return [[chemin, t]];
  return Object.entries(t).flatMap(([k, v]) => chaines(v, chemin ? `${chemin}.${k}` : k));
}
const variables = (texte) => (texte.match(/\{\w+\}/g) || []).sort().join(" ");

test("chaque gabarit garde ses variables dans chaque langue", () => {
  const reference = new Map(chaines(TEXTES.fr).map(([c, t]) => [c, variables(t)]));
  assert.ok([...reference.values()].filter(Boolean).length >= 12, "trop peu de gabarits trouvés");
  for (const l of LANGUES) {
    for (const [c, t] of chaines(TEXTES[l])) assert.equal(variables(t), reference.get(c), `${l} : ${c}`);
  }
});
