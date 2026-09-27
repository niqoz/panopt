/* Géométrie des rangées : écartement et emprise au sol.

   Toutes les longueurs sont en mètres. Une "rangée" est une file de panneaux
   perpendiculaire a l'azimut du champ ; L est la longueur du panneau dans le
   sens de la pente (1,13 m pour un module portrait couche, 2,28 m debout).

     h = L·sin(beta)          différence de hauteur bas -> haut du panneau
     d = h·cos(dAz)/tan(alt)  espace libre entre le bas d'une rangée et le
                              haut de la précédente, a l'instant considère
     D = L·cos(beta) + d      pas entre rangées (pitch), = emprise unitaire

   Le critère de dimensionnement est une date et une plage horaire solaire :
   on retient le pire instant de la plage. Le 21 décembre a midi seul donne
   des champs compacts ; 9 h - 15 h le même jour peut doubler l'écartement.
   C'est le choix le plus structurant de tout le calcul. */

import { sunPosition, dayOfYear, toRad, sunriseHour } from "./solar.js";

/** Critères d'ombrage courants. `span` = demi-plage en heures autour du midi
    solaire ; 0 = midi seul. Les libellés vivent dans i18n.js. */
export const CRITERIA = {
  solstice_midi: { month: 12, day: 21, span: 0 },
  solstice_4h: { month: 12, day: 21, span: 2 },
  solstice_6h: { month: 12, day: 21, span: 3 },
  equinoxe_6h: { month: 3, day: 21, span: 3 },
  equinoxe_8h: { month: 3, day: 21, span: 4 }
};

/** Hauteur du bord haut du panneau au-dessus de son bord bas. */
export const panelRise = (length, tilt) => length * Math.sin(toRad(tilt));

/** Projection horizontale du panneau. */
export const panelRun = (length, tilt) => length * Math.cos(toRad(tilt));

/** Espace libre exige entre rangées, en mètres.
    Renvoie aussi l'instant dimensionnant, celui qu'il faut pouvoir citer au
    client quand il demande pourquoi les rangées sont si espacées. */
export function rowSpacing(lat, length, tilt, fieldAzimuth, criterion) {
  const c = CRITERIA[criterion] || criterion;
  const n = dayOfYear(c.month, c.day);
  const rise = panelRise(length, tilt);
  let worst = { spacing: 0, hour: 12, elevation: 0, azimuth: 0 };

  // Balayage par pas de 5 min : le maximum tombe rarement pile sur une heure
  // ronde. Indices entiers plutôt qu'accumulation de flottants, pour que le
  // matin et le soir restent exactement symétriques a azimut nul.
  const steps = Math.round(c.span * 12);
  for (let i = -steps; i <= steps; i++) {
    const t = 12 + i / 12;
    const sun = sunPosition(lat, n, t);
    if (sun.elevation <= 0.5) continue; // sous l'horizon ou rasant : hors critère
    const dAz = Math.cos(toRad(sun.azimuth - fieldAzimuth));
    if (dAz <= 0) continue; // soleil derrière le champ, pas d'ombre vers l'arrière
    const spacing = rise * dAz / Math.tan(toRad(sun.elevation));
    if (spacing > worst.spacing) {
      worst = { spacing, hour: t, elevation: sun.elevation, azimuth: sun.azimuth };
    }
  }
  return worst;
}

/** Dimensionnement complet d'un champ de rangées. */
export function rowLayout(lat, length, tilt, fieldAzimuth, criterion) {
  const s = rowSpacing(lat, length, tilt, fieldAzimuth, criterion);
  const run = panelRun(length, tilt);
  const pitch = run + s.spacing;
  return {
    rise: panelRise(length, tilt),
    run,
    spacing: s.spacing,
    pitch,
    gcr: length / pitch, // taux de couverture du sol
    sun: { hour: s.hour, elevation: s.elevation, azimuth: s.azimuth }
  };
}

/** Fenêtre horaire sans ombrage obtenue avec un pas impose, le jour donne.
    Sert a répondre a « et si je resserre a 4 m, je perds quoi ? ».
    @returns {{start:number, end:number, hours:number}|null} heures solaires. */
export function shadeFreeWindow(lat, length, tilt, fieldAzimuth, pitch, month, day) {
  const n = dayOfYear(month, day);
  const rise = panelRise(length, tilt);
  const free = pitch - panelRun(length, tilt);
  const sr = sunriseHour(lat, n);
  if (sr === null) return null;
  let start = null, end = null;
  for (let t = sr; t <= 24 - sr; t += 1 / 60) {
    const sun = sunPosition(lat, n, t);
    let shaded = false;
    if (sun.elevation > 0) {
      const dAz = Math.cos(toRad(sun.azimuth - fieldAzimuth));
      if (dAz > 0) shaded = rise * dAz / Math.tan(toRad(sun.elevation)) > free + 1e-3;
    } else {
      shaded = true;
    }
    if (!shaded && start === null) start = t;
    if (!shaded) end = t;
  }
  if (start === null) return null;
  return { start, end, hours: end - start };
}
