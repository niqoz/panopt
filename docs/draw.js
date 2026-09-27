/* Rendu des schémas. Le parti pris de l'application tient ici : les
   résultats ne sont pas affiches a cote du dessin, ils SONT les cotes du
   dessin. On lit un plan d'exécution, pas un tableau de chiffres. */

const NS = "http://www.w3.org/2000/svg";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

import { nombre, gabarit, TEXTES } from "./i18n.js";

/** Formatage métier : au centimètre pour les longueurs, au degré pour les
    angles. Afficher le millimètre serait une précision mensongère. Le
    séparateur décimal suit la langue, point en anglais, virgule ailleurs. */
export const m = (v, langue = "fr") => `${nombre(v, 2, langue)} m`;
export const deg = (v) => `${Math.round(v)}°`;
export const pct = (v, langue = "fr") => `${nombre(v, 1, langue)} %`;
export const hm = (h) => {
  const t = Math.round(h * 60), mn = t % 60;
  return `${Math.floor(t / 60)} h${mn ? ` ${String(mn).padStart(2, "0")}` : ""}`;
};

/** Définitions communes : hachures du terrain et de l'ombre, pointes de cote. */
function defs() {
  return `<defs>
    <pattern id="sol" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" class="p-sol-trait"/>
    </pattern>
    <pattern id="ombre" width="5" height="5" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="5" class="p-ombre-trait"/>
    </pattern>
    <marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
            orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="p-cote-pointe"/></marker>
    <marker id="fl-soleil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6"
            orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="p-soleil-pointe"/></marker>
  </defs>`;
}

/** Cote horizontale, ligne d'attache comprise. */
function dimH(x1, x2, y, label, { tie = 0, cls = "" } = {}) {
  const mid = (x1 + x2) / 2;
  const court = Math.abs(x2 - x1) < 46;
  return `<g class="cote ${cls}">
    ${tie ? `<line x1="${x1}" y1="${y - tie}" x2="${x1}" y2="${y + 4}" class="p-attache"/>
             <line x1="${x2}" y1="${y - tie}" x2="${x2}" y2="${y + 4}" class="p-attache"/>` : ""}
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="p-cote"
          marker-start="url(#fl)" marker-end="url(#fl)"/>
    <text x="${court ? x2 + 6 : mid}" y="${y - 6}" class="p-cote-txt"
          text-anchor="${court ? "start" : "middle"}">${esc(label)}</text>
  </g>`;
}

/** Cote verticale. */
function dimV(y1, y2, x, label, { tie = 0 } = {}) {
  return `<g class="cote">
    ${tie ? `<line x1="${x - 4}" y1="${y1}" x2="${x + tie}" y2="${y1}" class="p-attache"/>
             <line x1="${x - 4}" y1="${y2}" x2="${x + tie}" y2="${y2}" class="p-attache"/>` : ""}
    <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="p-cote"
          marker-start="url(#fl)" marker-end="url(#fl)"/>
    <text x="${x - 7}" y="${(y1 + y2) / 2}" class="p-cote-txt" text-anchor="end"
          dominant-baseline="middle">${esc(label)}</text>
  </g>`;
}

/** Arc d'angle mesure depuis l'horizontale, sens trigonométrique. */
function angleArc(cx, cy, r, angle, label) {
  const a = angle * Math.PI / 180;
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  const lx = cx + (r + 15) * Math.cos(a / 2), ly = cy - (r + 15) * Math.sin(a / 2);
  return `<g class="cote">
    <path d="M${cx + r},${cy} A${r},${r} 0 0,1 ${x},${y}" class="p-cote" fill="none"/>
    <text x="${lx}" y="${ly}" class="p-cote-txt p-cote-txt-fort" text-anchor="middle"
          dominant-baseline="middle">${esc(label)}</text>
  </g>`;
}

/** Échelle graphique : un mètre étalon rend les proportions lisibles d'un
    coup d'oeil, ce qu'aucune valeur chiffrée ne fait. */
function scaleBar(x, y, pxPerM, maxPx) {
  let unit = 1;
  for (const u of [1, 2, 5, 10, 20, 50]) if (u * pxPerM <= maxPx) unit = u;
  const w = unit * pxPerM;
  return `<g class="echelle">
    <line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" class="p-echelle"/>
    <line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 4}" class="p-echelle"/>
    <line x1="${x + w}" y1="${y - 4}" x2="${x + w}" y2="${y + 4}" class="p-echelle"/>
    <text x="${x + w + 6}" y="${y}" class="p-echelle-txt" dominant-baseline="middle">${unit} m</text>
  </g>`;
}

const frame = (w, h, inner) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="${NS}" role="img" preserveAspectRatio="xMidYMid meet">${defs()}${inner}</svg>`;

/** Panneau vu en coupe : segment épais, pied a gauche. */
function panel(x0, y0, length, tilt, px, cls = "p-panneau") {
  const a = tilt * Math.PI / 180;
  return `<line x1="${x0}" y1="${y0}" x2="${x0 + length * Math.cos(a) * px}"
    y2="${y0 - length * Math.sin(a) * px}" class="${cls}"/>`;
}

/* --- Schéma 1 : inclinaison ------------------------------------------------ */

export function drawTilt({ tilt, optimal, length = 1.7, langue = "fr" }) {
  const W = 360, H = 196, sol = 150, x0 = 80;
  const px = 126 / length; // le panneau occupe une largeur fixe a plat
  const a = tilt * Math.PI / 180;
  const hx = x0 + length * Math.cos(a) * px, hy = sol - length * Math.sin(a) * px;

  // Rayon solaire arrivant perpendiculairement au panneau : il montre d'un
  // trait ce que l'inclinaison cherche a obtenir.
  const n = (tilt + 90) * Math.PI / 180;
  const f = 0.72; // ancre haute : a 90 degres, le milieu du panneau tombait
  const mx = x0 + (hx - x0) * f, my = sol + (hy - sol) * f; // sur la cote de hauteur
  const ray = 62;

  return frame(W, H, `
    <line x1="16" y1="${sol}" x2="${W - 16}" y2="${sol}" class="p-sol"/>
    <rect x="16" y="${sol}" width="${W - 32}" height="16" fill="url(#sol)" stroke="none"/>
    ${optimal !== undefined && Math.abs(optimal - tilt) >= 1
      ? panel(x0, sol, length, optimal, px, "p-panneau-fantome") : ""}
    ${panel(x0, sol, length, tilt, px)}
    <line x1="${mx + ray * Math.cos(n)}" y1="${my - ray * Math.sin(n)}" x2="${mx}" y2="${my}"
          class="p-soleil" marker-end="url(#fl-soleil)"/>
    ${angleArc(x0, sol, 46, tilt, deg(tilt))}
    ${dimV(sol, hy, x0 - 16, m(length * Math.sin(a), langue), { tie: 16 })}
    ${dimH(x0, hx, sol + 34, m(length * Math.cos(a), langue), { tie: 30 })}
    ${optimal !== undefined && Math.abs(optimal - tilt) >= 1
      ? `<text x="${W - 18}" y="26" class="p-note" text-anchor="end">${esc(gabarit(TEXTES[langue].optimumNote, { v: deg(optimal) }))}</text>` : ""}`);
}

/* --- Schéma 2 : rangées ---------------------------------------------------- */

export function drawRows({ length, tilt, layout, langue = "fr" }) {
  const W = 360;
  const a = tilt * Math.PI / 180;
  const total = 2 * layout.pitch + length * Math.cos(a);
  const px = (W - 74) / total;
  const x = (i) => 40 + i * layout.pitch * px;
  const rise = length * Math.sin(a) * px, run = length * Math.cos(a) * px;
  // Le cadre suit la hauteur reelle du dessin : a 60 degres les rangees
  // montent beaucoup plus qu'a 10, et un cadre fixe les rognerait ou
  // laisserait un grand vide.
  const sol = Math.max(76, rise + 58), H = sol + 86;

  // Le rayon rasant part du haut d'une rangée et vient mourir au pied de la
  // suivante : c'est la définition même de l'écartement retenu.
  const hx = x(1) + run, hy = sol - rise, tx = x(2);
  const dx = tx - hx, dy = sol - hy;
  const ext = 46 / Math.hypot(dx, dy);

  return frame(W, H, `
    <line x1="14" y1="${sol}" x2="${W - 14}" y2="${sol}" class="p-sol"/>
    <rect x="14" y="${sol}" width="${W - 28}" height="14" fill="url(#sol)" stroke="none"/>
    <rect x="${hx}" y="${sol - 9}" width="${Math.max(0, tx - hx)}" height="9" fill="url(#ombre)" stroke="none"/>
    <line x1="${hx - dx * ext}" y1="${hy - dy * ext}" x2="${tx}" y2="${sol}"
          class="p-soleil" marker-end="url(#fl-soleil)"/>
    ${[0, 1, 2].map((i) => panel(x(i), sol, length, tilt, px)).join("")}
    <text x="${hx - dx * ext + 4}" y="${hy - dy * ext - 6}" class="p-soleil-txt">${deg(layout.sun.elevation)}</text>
    ${dimV(sol, hy, x(1) - 7, m(layout.rise, langue), { tie: 7 })}
    ${dimH(hx, tx, sol + 24, m(layout.spacing, langue), { tie: 20 })}
    ${dimH(x(1), x(2), sol + 50, m(layout.pitch, langue), { tie: 46 })}
    ${scaleBar(40, H - 8, px, 130)}`);
}

/* --- Courbe de perte ------------------------------------------------------- */

/** La plage utile compte plus que l'optimum : sur un toit existant on ne
    choisit pas l'inclinaison, on vérifie qu'elle reste acceptable. */
export function drawLossCurve({ sweep, tilt, tolerance = 5, langue = "fr" }) {
  const W = 360, H = 168, l = 34, r = 12, t = 14, b = 30;
  const best = sweep.best.value;
  const loss = sweep.yield.map((v) => (1 - v / best) * 100);
  const maxLoss = Math.max(22, Math.ceil(Math.max(...loss.slice(0, 76)) / 10) * 10);
  const X = (d) => l + d / 90 * (W - l - r);
  const Y = (p) => t + Math.min(p, maxLoss) / maxLoss * (H - t - b);

  const dans = loss.map((p, i) => (p <= tolerance ? i : -1)).filter((i) => i >= 0);
  const a = dans[0], z = dans[dans.length - 1];
  const path = loss.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p).toFixed(1)}`).join("");
  const grad = [0, 5, 10, 20, 30].filter((g) => g <= maxLoss);

  return frame(W, H, `
    ${grad.map((g) => `<line x1="${l}" y1="${Y(g)}" x2="${W - r}" y2="${Y(g)}" class="p-grille"/>
      <text x="${l - 6}" y="${Y(g)}" class="p-axe" text-anchor="end" dominant-baseline="middle">${g}%</text>`).join("")}
    <rect x="${X(a)}" y="${t}" width="${X(z) - X(a)}" height="${H - t - b}" class="p-plage"/>
    <path d="${path}" class="p-courbe"/>
    <line x1="${X(tilt)}" y1="${t}" x2="${X(tilt)}" y2="${H - b}" class="p-curseur"/>
    <circle cx="${X(tilt)}" cy="${Y(loss[Math.round(tilt)])}" r="5" class="p-point"/>
    <text x="${X(a) + (X(z) - X(a)) / 2}" y="${H - b - 8}" class="p-plage-txt" text-anchor="middle">${a}° ${TEXTES[langue].plageConn} ${z}°</text>
    ${[0, 30, 60, 90].map((d) => `<text x="${X(d)}" y="${H - b + 16}" class="p-axe" text-anchor="middle">${d}°</text>`).join("")}
    <text x="${W - r}" y="${H - 4}" class="p-axe" text-anchor="end">${esc(TEXTES[langue].axeInclinaison)}</text>`);
}
