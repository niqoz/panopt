/* Moteur solaire de SolarDim Panel Optimizer.
   Convention d'azimut utilisée partout : 0 = plein sud, négatif vers l'est,
   positif vers l'ouest (même convention que PVGIS et que les fiches
   d'installateur françaises). Angles en degrés a l'interface, radians en
   interne. Hémisphère nord uniquement.

   Le modèle d'irradiation est volontairement simple : indice de clarté
   mensuel -> décomposition direct/diffus par la corrélation d'Erbs ->
   transposition isotrope sur le plan incline. Il ne remplace pas PVGIS pour
   un chiffrage de production, mais il donne l'inclinaison optimale et les
   pertes relatives, qui sont ce que l'on cherche ici. */

const RAD = Math.PI / 180;
export const toRad = (d) => d * RAD;
export const toDeg = (r) => r / RAD;

/** Constante solaire, W/m². */
const GSC = 1367;

/** Jours représentatifs de Klein : le jour de chaque mois dont la déclinaison
    est la plus proche de la moyenne mensuelle. Sert a ramener une année a
    12 journées de calcul sans biais saisonnier. */
export const KLEIN_DAYS = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES = ["janv.", "févr.", "mars", "avril", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Numéro de jour dans l'année (1-365), année non bissextile. */
export function dayOfYear(month, day) {
  let n = day;
  for (let m = 0; m < month - 1; m++) n += MONTH_LENGTHS[m];
  return n;
}

/** Déclinaison solaire en degrés (Cooper). */
export function declination(n) {
  return 23.45 * Math.sin(toRad(360 * (284 + n) / 365));
}

/** Équation du temps en minutes (Spencer simplifie). */
export function equationOfTime(n) {
  const b = toRad(360 * (n - 81) / 364);
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/** Heure solaire vraie a partir de l'heure légale.
    @param clock heure légale décimale (13.5 = 13 h 30)
    @param lon longitude en degrés, positive vers l'est
    @param utcOffset décalage du fuseau en heures (France : 1 hiver, 2 été) */
export function solarTime(clock, lon, utcOffset, n) {
  return clock - utcOffset + lon / 15 + equationOfTime(n) / 60;
}

/** Inverse de solarTime : heure légale correspondant a une heure solaire. */
export function clockTime(solar, lon, utcOffset, n) {
  return solar + utcOffset - lon / 15 - equationOfTime(n) / 60;
}

/** Angle horaire en degrés : 0 au midi solaire, négatif le matin. */
export function hourAngle(solarHour) {
  return 15 * (solarHour - 12);
}

/** Position du soleil.
    @returns {{élévation:number, azimuth:number}} en degrés, azimut depuis le sud. */
export function sunPosition(lat, n, solarHour) {
  const phi = toRad(lat);
  const dec = toRad(declination(n));
  const w = toRad(hourAngle(solarHour));
  const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(w);
  const elevation = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
  // atan2 gère les quadrants sans cas particulier, contrairement a l'arcsin.
  const azimuth = toDeg(Math.atan2(
    Math.sin(w),
    Math.cos(w) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
  ));
  return { elevation, azimuth };
}

/** Heure solaire du lever de soleil (l'horizon est suppose plat).
    Renvoie null si le soleil ne se lève pas / ne se couche pas ce jour-la. */
export function sunriseHour(lat, n) {
  const c = -Math.tan(toRad(lat)) * Math.tan(toRad(declination(n)));
  if (c <= -1 || c >= 1) return null;
  return 12 - toDeg(Math.acos(c)) / 15;
}

/** Cosinus de l'angle d'incidence sur un plan d'inclinaison beta et
    d'azimut gamma (Duffie & Beckman). Négatif = le soleil est derrière. */
export function cosIncidence(lat, n, solarHour, tilt, azimuth) {
  const phi = toRad(lat), dec = toRad(declination(n)), w = toRad(hourAngle(solarHour));
  const b = toRad(tilt), g = toRad(azimuth);
  return Math.sin(dec) * Math.sin(phi) * Math.cos(b)
    - Math.sin(dec) * Math.cos(phi) * Math.sin(b) * Math.cos(g)
    + Math.cos(dec) * Math.cos(phi) * Math.cos(b) * Math.cos(w)
    + Math.cos(dec) * Math.sin(phi) * Math.sin(b) * Math.cos(g) * Math.cos(w)
    + Math.cos(dec) * Math.sin(b) * Math.sin(g) * Math.sin(w);
}

/** Irradiance extraterrestre sur plan horizontal, W/m². */
export function extraterrestrialHorizontal(lat, n, solarHour) {
  const alt = sunPosition(lat, n, solarHour).elevation;
  if (alt <= 0) return 0;
  return GSC * (1 + 0.033 * Math.cos(toRad(360 * n / 365))) * Math.sin(toRad(alt));
}

/* Indices de clarté mensuels par forme de ciel, obtenus
   en divisant les irradiations globales horizontales mensuelles de référence
   (ordre de grandeur PVGIS SARAH) par l'irradiation extraterrestre calculée
   ici. La répartition saisonnière compte autant que le total annuel : des Kt
   d'hiver surévalues suffisent a raidir l'inclinaison optimale de 4 degrés.

   Ces cinq formes, calées sur la France, couvrent toute l'Europe de l'Ouest :
   mesuré sur 62 villes de douze pays, l'écart sur ce que l'application affiche
   — optimum annuel, d'hiver, d'été, perte d'orientation, perte de plat —
   reste sous 3° et 2 points (`tools/kt-pvgis.mjs`). C'est la **forme** du
   ciel que la zone porte, pas le niveau : la latitude, réglée à part, fait le
   reste. Le niveau, lui, n'est jamais affiché — l'écart au site réel atteint
   7 % à Faro, ce qui interdirait d'en tirer un productible.

   Leurs noms ne sont donc plus régionaux : « Nord et Picardie » n'aurait
   aucun sens à Glasgow, qui relève pourtant de la même forme de ciel. */
export const CLIMATES = {
  mediterraneen: {
    // Cale sur Marseille, 1650 kWh/m²/an sur plan horizontal.
    kt: [0.529, 0.566, 0.592, 0.581, 0.581, 0.626, 0.662, 0.645, 0.636, 0.577, 0.523, 0.505]
  },
  sudouest: {
    // Cale sur Toulouse, 1395 kWh/m²/an.
    kt: [0.429, 0.467, 0.501, 0.497, 0.496, 0.534, 0.556, 0.555, 0.555, 0.491, 0.429, 0.413]
  },
  atlantique: {
    // Cale sur Nantes, 1259 kWh/m²/an.
    kt: [0.366, 0.418, 0.466, 0.507, 0.493, 0.518, 0.519, 0.525, 0.529, 0.445, 0.378, 0.348]
  },
  continental: {
    // Cale sur Strasbourg, 1187 kWh/m²/an.
    kt: [0.316, 0.390, 0.450, 0.499, 0.480, 0.496, 0.515, 0.518, 0.506, 0.413, 0.321, 0.300]
  },
  oceanique: {
    // Cale sur Lille, 1066 kWh/m²/an.
    kt: [0.293, 0.361, 0.414, 0.469, 0.460, 0.462, 0.465, 0.471, 0.458, 0.379, 0.300, 0.269]
  }
};

/** Pas d'intégration horaire. 0.25 h reste rapide et supprime les marches
    d'escalier au lever et au coucher. */
const STEP = 0.25;

/* Un mois n'est pas fait de journées moyennes : il alterne des journées
   claires, très directionnelles, et des journées couvertes ou tout est
   diffus. Calculer avec le seul indice de clarté moyen revient a un ciel
   uniformément voile : cela aplatit l'inclinaison optimale et efface la
   pénalité des toitures est-ouest. Chaque mois est donc décompose en deux
   journées types, dont la pondération est choisie pour redonner exactement
   l'irradiation horizontale du climat retenu. */

/* Les trois paramètres libres du modèle de ciel, regroupes pour pouvoir les
   recaler d'un bloc contre les références PVGIS (cf. tests/solar.test.mjs).
   `clearK` est l'extinction atmosphérique du ciel clair : l'augmenter assombrit
   les belles journées ; `ktHazy` et `ktOvercast` sont les indices de clarté
   des deux autres ciels types. */
export const TUNING = { clearK: 0.44, ktHazy: 0.26, ktOvercast: 0.13 };

/** Transmittance directe d'un ciel clair (Hottel, atmosphère de plaine).
    Elle s'effondre quand le soleil descend, la masse d'air traversée
    augmentant : c'est ce qui empêche de surévaluer le direct rasant, et
    donc de raidir a tort l'inclinaison optimale. */
function clearBeamTransmittance(sinAlt) {
  if (sinAlt <= 0.02) return 0;
  return 0.1243 + 0.7493 * Math.exp(-TUNING.clearK / sinAlt);
}

/** Fraction diffuse d'une JOURNÉE d'indice de clarté donne (Erbs, forme
    journalière). Elle diffère nettement de la forme horaire ci-dessus :
    appliquer l'horaire a un Kt journalier surévalue le diffus de moitie et
    rend le modèle aveugle a l'orientation.
    @param sunsetAngle angle horaire du coucher, en degrés. */
export function dailyDiffuseFraction(kt, sunsetAngle) {
  const k = Math.max(0.05, Math.min(0.8, kt));
  const f = sunsetAngle < 81.4
    ? 1.391 - 3.560 * k + 4.189 * k ** 2 - 2.137 * k ** 3
    : 1.311 - 3.022 * k + 3.427 * k ** 2 - 1.821 * k ** 3;
  return Math.max(0.1, Math.min(1, f));
}

/* Trois ciels types suffisent a décrire un mois français. Le ciel voile est
   le plus important des trois : c'est le régime dominant sous nos latitudes,
   celui ou le diffus porte l'essentiel de l'énergie. Un modèle binaire
   clair/couvert l'ignore et surévalue de 4 degrés l'inclinaison optimale. */

/** Irradiances instantanées sur plan horizontal, en W/m². */
function skyIrradiance(sky, gon, sinAlt, g0, sunsetAngle) {
  if (sky === "clear") {
    const tb = clearBeamTransmittance(sinAlt);
    const td = Math.max(0, 0.271 - 0.294 * tb); // diffus de ciel clair, Liu-Jordan
    return { dni: gon * tb, gd: gon * sinAlt * td };
  }
  const kt = sky === "hazy" ? TUNING.ktHazy : TUNING.ktOvercast;
  const gh = kt * g0;
  const gd = dailyDiffuseFraction(kt, sunsetAngle) * gh;
  return { dni: (gh - gd) / sinAlt, gd };
}

/** Irradiation extraterrestre du jour sur plan horizontal, en Wh/m². */
function dayExtraterrestrial(lat, n) {
  let wh = 0;
  for (let h = 0; h < 24; h += STEP) wh += extraterrestrialHorizontal(lat, n, h + STEP / 2) * STEP;
  return wh;
}

/** Irradiation horizontale d'une journée type, en Wh/m². Ne sert qu'a
    pondérer les ciels entre eux ; le calcul sur plan incline passe ensuite
    par les series mises en cache. */
function dayHorizontal(lat, n, sky) {
  const gon = GSC * (1 + 0.033 * Math.cos(toRad(360 * n / 365)));
  const sr = sunriseHour(lat, n);
  const sunsetAngle = sr === null ? 90 : 15 * (12 - sr);
  let wh = 0;
  for (let h = 0; h < 24; h += STEP) {
    const t = h + STEP / 2;
    const g0 = extraterrestrialHorizontal(lat, n, t);
    if (g0 <= 0) continue;
    const sinAlt = Math.max(Math.sin(toRad(sunPosition(lat, n, t).elevation)), 0.02);
    const { dni, gd } = skyIrradiance(sky, gon, sinAlt, g0, sunsetAngle);
    wh += (dni * sinAlt + gd) * STEP;
  }
  return wh;
}

/** Pondération des ciels types reproduisant l'irradiation horizontale visée.
    Les trois ciels sont ordonnes ; on n'en mélange que deux a la fois, ceux
    qui encadrent la cible. La pondération étant posée sur l'horizontale, le
    climat retenu redonne exactement son irradiation de référence, quelle que
    soit la latitude.
    @returns {Array<[string, number]>} paires ciel / poids. */
export function skyMix(lat, n, ktMonth) {
  const target = ktMonth * dayExtraterrestrial(lat, n);
  const h = {
    overcast: dayHorizontal(lat, n, "overcast"),
    hazy: dayHorizontal(lat, n, "hazy"),
    clear: dayHorizontal(lat, n, "clear")
  };
  const blend = (lo, hi) => {
    const f = (target - h[lo]) / (h[hi] - h[lo]);
    const c = Math.max(0, Math.min(1, f));
    return [[lo, 1 - c], [hi, c]];
  };
  return target <= h.hazy ? blend("overcast", "hazy") : blend("hazy", "clear");
}

/* Le balayage d'inclinaison rejoue les mêmes journées pour 91 angles. Tout
   ce qui ne dépend ni de l'inclinaison ni de l'azimut est donc calcule une
   fois et mis en cache. L'angle d'incidence se sépare proprement :

     cos(theta) = P·cos(beta) + sin(beta)·( Q·cos(gamma) + R·sin(gamma) )

   ou P, Q et R ne dépendent que de la latitude, du jour et de l'heure. Un
   balayage complet passe ainsi de quelques centaines de millisecondes a
   quelques unes, ce qui rend les curseurs réellement continus. */

/** Échantillons horaires d'une année type, pour une latitude et un climat. */
function buildSeries(lat, climate) {
  const kt = CLIMATES[climate].kt;
  const P = [], Q = [], R = [], dni = [], gd = [], gh = [], w = [], mois = [];
  const phi = toRad(lat);
  for (let mth = 0; mth < 12; mth++) {
    const n = KLEIN_DAYS[mth];
    const dec = toRad(declination(n));
    const gon = GSC * (1 + 0.033 * Math.cos(toRad(360 * n / 365)));
    const sr = sunriseHour(lat, n);
    const sunsetAngle = sr === null ? 90 : 15 * (12 - sr);
    const jours = MONTH_LENGTHS[mth] / 1000; // Wh -> kWh, sur le mois entier
    for (const [sky, poids] of skyMix(lat, n, kt[mth])) {
      if (poids <= 0) continue;
      for (let h = 0; h < 24; h += STEP) {
        const t = h + STEP / 2; // milieu de pas
        const om = toRad(hourAngle(t));
        const p = Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(om);
        if (p <= 0) continue; // soleil sous l'horizon
        const sinAlt = Math.max(p, 0.02);
        const g0 = gon * p;
        const ray = skyIrradiance(sky, gon, sinAlt, g0, sunsetAngle);
        P.push(p);
        Q.push(-Math.sin(dec) * Math.cos(phi) + Math.cos(dec) * Math.sin(phi) * Math.cos(om));
        R.push(Math.cos(dec) * Math.sin(om));
        dni.push(ray.dni);
        gd.push(ray.gd);
        gh.push(ray.dni * sinAlt + ray.gd);
        w.push(poids * STEP * jours);
        mois.push(mth);
      }
    }
  }
  return { P, Q, R, dni, gd, gh, w, mois, n: P.length };
}

/* Cache borne : l'utilisateur déplace la latitude par pas de 0,1 degré, on
   garde les derniers réglages sans laisser la mémoire filer. */
const seriesCache = new Map();
function series(lat, climate) {
  const cle = `${lat.toFixed(2)}|${climate}`;
  let s = seriesCache.get(cle);
  if (!s) {
    s = buildSeries(lat, climate);
    if (seriesCache.size >= 8) seriesCache.delete(seriesCache.keys().next().value);
    seriesCache.set(cle, s);
  }
  return s;
}

/** Irradiation sur un plan incline, en kWh/m² pour la période demandée.
    @param months indices 0-11 des mois a sommer (défaut : les douze). */
export function irradiation(lat, tilt, azimuth, climate, albedo = 0.2, months = null) {
  const s = series(lat, climate);
  const b = toRad(tilt), g = toRad(azimuth);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cg = Math.cos(g), sg = Math.sin(g);
  const fDiff = (1 + cb) / 2, fRefl = albedo * (1 - cb) / 2;
  const garde = months ? new Set(months) : null;
  let total = 0;
  for (let i = 0; i < s.n; i++) {
    if (garde && !garde.has(s.mois[i])) continue;
    const cosT = s.P[i] * cb + sb * (s.Q[i] * cg + s.R[i] * sg);
    const direct = cosT > 0 ? s.dni[i] * cosT : 0;
    total += s.w[i] * (direct + s.gd[i] * fDiff + s.gh[i] * fRefl);
  }
  return total;
}

/** Saisons prédéfinies, exprimées en listes de mois. Leurs libellés, comme
    ceux des climats, vivent dans i18n.js. */
export const SEASONS = {
  annee: { months: null },
  hiver: { months: [9, 10, 11, 0, 1, 2] },
  ete: { months: [3, 4, 5, 6, 7, 8] }
};

/** Balayage d'inclinaison de 0 a 90 degrés.
    @returns {{tilt:number[], yield:number[], best:{tilt:number, value:number}}} */
export function tiltSweep(lat, azimuth, climate, albedo = 0.2, months = null, step = 1) {
  const tilts = [], values = [];
  let best = { tilt: 0, value: -1 };
  for (let t = 0; t <= 90; t += step) {
    const v = irradiation(lat, t, azimuth, climate, albedo, months);
    tilts.push(t); values.push(v);
    if (v > best.value) best = { tilt: t, value: v };
  }
  return { tilt: tilts, yield: values, best };
}

/** Inclinaison optimale et perte relative pour une inclinaison imposée. */
export function tiltAnalysis(lat, tilt, azimuth, climate, albedo = 0.2, months = null) {
  const sweep = tiltSweep(lat, azimuth, climate, albedo, months);
  const actual = irradiation(lat, tilt, azimuth, climate, albedo, months);
  return {
    optimal: sweep.best.tilt,
    optimalYield: sweep.best.value,
    actualYield: actual,
    loss: (1 - actual / sweep.best.value) * 100,
    sweep
  };
}

/** Production mensuelle sur le plan incline, 12 valeurs en kWh/m². */
export function monthlyProfile(lat, tilt, azimuth, climate, albedo = 0.2) {
  return MONTH_NAMES.map((_, m) => irradiation(lat, tilt, azimuth, climate, albedo, [m]));
}
