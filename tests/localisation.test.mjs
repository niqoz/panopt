import { test } from "node:test";
import assert from "node:assert/strict";
import { creerLocalisation, positionDifferente } from "../docs/localisation.js";

const lyon = { lat: 45.8, lon: 4.85 };
const gpsLyon = { latitude: 45.75, longitude: 4.85, accuracy: 20 };
const gpsParis = { latitude: 48.86, longitude: 2.35, accuracy: 20 };

function scenario({ permission = "granted", coords = gpsParis, erreur, disponible = true } = {}) {
  let site = { ...lyon };
  let vue;
  let demandes = 0;
  let applications = 0;
  let repondre;
  const navigateur = {
    permissions: { query: async () => ({ state: permission }) },
    geolocation: disponible ? {
      getCurrentPosition(ok, ko) {
        demandes++;
        repondre = () => erreur ? ko(erreur) : ok({ coords });
      }
    } : null
  };
  const controle = creerLocalisation({
    navigateur,
    lireSite: () => site,
    appliquer: (c) => {
      applications++;
      site = { lat: Math.round(c.latitude * 10) / 10, lon: c.longitude };
      return () => "Position relevée.";
    },
    afficher: (v) => { vue = v; }
  });
  return {
    controle, navigateur,
    get vue() { return vue; },
    get demandes() { return demandes; },
    get applications() { return applications; },
    get site() { return site; },
    repondre: () => repondre(),
    changerSite: (s) => { site = s; controle.actualiser(); }
  };
}

test("la comparaison porte sur les deux coordonnées et tolère l'arrondi du calcul", () => {
  assert.equal(positionDifferente(lyon, gpsLyon), false);
  assert.equal(positionDifferente(lyon, gpsParis), true);
  assert.equal(positionDifferente(lyon, { ...gpsLyon, longitude: 8 }), true);
  assert.equal(positionDifferente(lyon, null), true);
  assert.equal(positionDifferente(lyon, { ...gpsLyon, latitude: NaN }), true);
});

test("une mesure imprécise ne crée pas de fausse différence", () => {
  assert.equal(positionDifferente(lyon, { ...gpsLyon, latitude: 46, accuracy: 50000 }), false);
});

test("une permission non accordée ne déclenche jamais de relevé automatique", async () => {
  for (const permission of ["prompt", "denied"]) {
    const s = scenario({ permission });
    await s.controle.verifier();
    assert.equal(s.demandes, 0);
    assert.equal(s.vue.visible, true);
    assert.equal(s.applications, 0);
  }
});

test("un GPS différent propose l'action sans changer le chantier", async () => {
  const s = scenario();
  await s.controle.verifier();
  s.repondre();
  assert.equal(s.vue.visible, true);
  assert.equal(s.applications, 0);
  assert.deepEqual(s.site, lyon);
  assert.equal(s.vue.message, "");
});

test("la position correspondante masque le raccourci", async () => {
  const s = scenario({ coords: gpsLyon });
  await s.controle.verifier();
  s.repondre();
  assert.equal(s.vue.visible, false);
  s.changerSite({ lat: 48.86, lon: 2.35 });
  assert.equal(s.vue.visible, true);
});

test("le clic applique le GPS puis masque le raccourci, sans double relevé", () => {
  const s = scenario({ permission: "prompt" });
  s.controle.relever();
  assert.equal(s.vue.enCours, true);
  s.controle.relever();
  assert.equal(s.demandes, 1);
  s.repondre();
  assert.equal(s.applications, 1);
  assert.equal(s.site.lat, 48.9);
  assert.equal(s.vue.visible, false);
  assert.equal(s.vue.enCours, false);
  assert.equal(s.vue.message, "Position relevée.");
});

test("un refus ou timeout conserve le chantier et permet de réessayer", () => {
  const s = scenario({ erreur: { code: 1 } });
  s.controle.relever();
  s.repondre();
  assert.equal(s.vue.enCours, false);
  assert.equal(s.vue.visible, true);
  assert.match(s.vue.message, /refusée ou indisponible/);
  assert.deepEqual(s.site, lyon);
  s.controle.relever();
  assert.equal(s.demandes, 2);
});

test("une position hors des latitudes couvertes n'est pas appliquée", () => {
  const s = scenario({ coords: { latitude: -33, longitude: 18 } });
  s.controle.relever();
  s.repondre();
  assert.equal(s.applications, 0);
  assert.match(s.vue.message, /hors de la zone/);
});

test("sans Permissions API, le bouton manuel reste fonctionnel", async () => {
  const s = scenario();
  delete s.navigateur.permissions;
  await s.controle.verifier();
  assert.equal(s.demandes, 0);
  s.controle.relever();
  s.repondre();
  assert.equal(s.applications, 1);
});

test("sans géolocalisation, aucun raccourci trompeur n'est proposé", async () => {
  const s = scenario({ disponible: false });
  await s.controle.verifier();
  assert.equal(s.vue.visible, false);
  s.controle.relever();
  assert.match(s.vue.message, /ne donne pas la position/);
});

test("un choix manuel peut effacer le compte rendu de l'ancien relevé", () => {
  const s = scenario();
  s.controle.relever();
  s.repondre();
  s.changerSite(lyon);
  s.controle.effacerMessage();
  assert.equal(s.vue.message, "");
  assert.equal(s.vue.visible, true);
});
