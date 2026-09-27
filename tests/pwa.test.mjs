import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;

/* Un fichier oublie dans la liste du service worker ne casse rien tant qu'on
   a du reseau : la panne n'apparait que sur le chantier, hors connexion.
   D'ou ce test, qui compare la liste au contenu reel du dossier. */

const lire = (f) => readFileSync(join(DOCS, f), "utf8");

function assets() {
  const sw = lire("sw.js");
  const bloc = sw.slice(sw.indexOf("ASSETS = ["), sw.indexOf("];"));
  return bloc.match(/"\.\/[^"]*"/g).map((s) => s.slice(3, -1)).map((f) => f || "index.html");
}

function fichiers(dir = DOCS, prefixe = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...fichiers(join(dir, e.name), `${prefixe}${e.name}/`));
    else out.push(prefixe + e.name);
  }
  return out;
}

/* sw.js ne se met pas lui-meme en cache, la licence n'est pas chargee par la
   page. Les trois dernieres ne servent qu'aux moteurs de recherche et aux
   apercus de partage : les mettre en cache ferait porter 66 ko de vignette au
   forfait d'un installateur qui installe l'application sur un chantier. */
const HORS_CACHE = new Set(["sw.js", "vendor/fonts/Fraunces-OFL.txt", "vendor/fonts/DMSans-OFL.txt",
  "robots.txt", "sitemap.xml", "partage.png"]);

/* Les bannières traduites ne sont chargées que dans leur langue : les
   précharger toutes ferait porter 440 ko au forfait pour en afficher une.
   Le service worker garde celle qui s'affiche, au premier passage en ligne. */
const A_LA_DEMANDE = new Set(["en", "de", "it", "es", "pt"].map((l) => `solardim-banniere-${l}.webp`));

test("tout fichier livre est mis en cache pour le hors ligne", () => {
  const liste = new Set(assets());
  for (const f of fichiers()) {
    if (HORS_CACHE.has(f) || A_LA_DEMANDE.has(f)) continue;
    assert.ok(liste.has(f), `${f} absent de la liste ASSETS de sw.js`);
  }
});

test("la liste du service worker ne reference aucun fichier disparu", () => {
  const surDisque = new Set(fichiers());
  for (const f of assets()) assert.ok(surDisque.has(f.split("?")[0]), `${f} liste dans sw.js mais absent de docs/`);
});

test("les modules charges par la page sont tous listes", () => {
  const html = lire("index.html");
  const liste = new Set(assets());
  for (const m of html.matchAll(/(?:src|href)="(?!https?:)([^"#]+)"/g)) {
    assert.ok(liste.has(m[1]), `${m[1]} reference par index.html mais pas mis en cache`);
  }
  // Les modules s'importent entre eux : leurs dependances comptent aussi.
  for (const f of assets().filter((x) => x.endsWith(".js"))) {
    for (const i of lire(f).matchAll(/from "\.\/([^"]+)"/g)) {
      assert.ok(liste.has(i[1]), `${i[1]} importe par ${f} mais pas mis en cache`);
    }
  }
});

test("le manifeste et la page pointent les memes icones", () => {
  const manifeste = JSON.parse(lire("manifest.webmanifest"));
  const liste = new Set(assets());
  for (const i of manifeste.icons) assert.ok(liste.has(i.src), `${i.src} absent du cache`);
  assert.equal(manifeste.start_url, manifeste.scope, "start_url et scope doivent coincider");
});

test("le nouvel entete ne reutilise pas la feuille de style de l'ancien logo", () => {
  const html = lire("index.html");
  const style = html.match(/rel="stylesheet" href="([^"]+)"/)[1];
  assert.match(style, /^style\.css\?v=\d+$/);
  assert.ok(assets().includes(style), "la feuille versionnee doit fonctionner hors ligne");
  const logo = html.match(/<img class="marque-logo"[^>]+>/)[0];
  assert.match(logo, /width="604"/);
  assert.match(logo, /height="245"/);
});

test("le bandeau conserve le climat sans afficher de coordonnées", () => {
  const detail = lire("index.html").match(/id="site-detail">([^<]*)</)[1];
  assert.equal(detail, "Ensoleillé");
  assert.match(lire("app.js"), /\$\("site-detail"\)\.textContent = T\(\)\.climats\[etat\.climat\]\.label;/);
});

test("une bannière traduite existe pour chaque langue, hors du précache", () => {
  const surDisque = new Set(fichiers());
  const liste = new Set(assets());
  for (const f of A_LA_DEMANDE) {
    assert.ok(surDisque.has(f), `${f} absente de docs/`);
    assert.ok(!liste.has(f), `${f} ne doit pas être préchargée`);
  }
  assert.match(lire("app.js"), /`solardim-banniere-\$\{langue\}\.webp`/);
});
