/* Repères géographiques : de quoi régler l'application en un geste sur le
   chantier, sans avoir a chercher sa latitude.

   La couverture est celle des pays où SolarDim se distribue : la France, puis
   l'Europe de l'Ouest. Les repères français portent les zones d'origine ; les
   autres ont été affectés par le calcul, en comparant ce que chaque zone rend
   à ce que rendent les indices de clarté PVGIS du site lui-même — optimum
   annuel, d'hiver et d'été à 3° près, pertes d'orientation et de plat à 2
   points (`tools/kt-pvgis.mjs`). Aucune n'a été posée à vue de carte : les
   cinq formes de ciel françaises suffisent, ce qui a été mesuré et non
   supposé. */

/** Codes des pays couverts, dans l'ordre où le menu les présente. Leurs
    noms vivent dans i18n.js, dans chacune des six langues. */
export const COUNTRIES = ["FR", "DE", "AT", "BE", "ES", "IE", "IT", "LU", "NL", "PT", "GB", "CH"];

/** Villes de référence : nom, latitude, longitude, zone climatique, pays. */
export const CITIES = [
  // France
  ["Porto-Vecchio", 41.59, 9.28, "mediterraneen", "FR"],
  ["Ajaccio", 41.93, 8.74, "mediterraneen", "FR"],
  ["Aléria", 42.11, 9.51, "mediterraneen", "FR"],
  ["Corte", 42.31, 9.15, "mediterraneen", "FR"],
  ["Cervione", 42.33, 9.49, "mediterraneen", "FR"],
  ["Bastia", 42.70, 9.45, "mediterraneen", "FR"],
  ["Perpignan", 42.70, 2.90, "mediterraneen", "FR"],
  ["Marseille", 43.30, 5.37, "mediterraneen", "FR"],
  ["Toulouse", 43.60, 1.44, "sudouest", "FR"],
  ["Montpellier", 43.61, 3.88, "mediterraneen", "FR"],
  ["Nice", 43.70, 7.27, "mediterraneen", "FR"],
  ["Bordeaux", 44.84, -0.58, "sudouest", "FR"],
  ["Valence", 44.93, 4.89, "sudouest", "FR"],
  ["Lyon", 45.75, 4.85, "sudouest", "FR"],
  ["Clermont-Ferrand", 45.78, 3.08, "continental", "FR"],
  ["Limoges", 45.83, 1.26, "atlantique", "FR"],
  ["La Rochelle", 46.16, -1.15, "atlantique", "FR"],
  ["Nantes", 47.22, -1.55, "atlantique", "FR"],
  ["Dijon", 47.32, 5.04, "continental", "FR"],
  ["Tours", 47.39, 0.69, "atlantique", "FR"],
  ["Orléans", 47.90, 1.90, "continental", "FR"],
  ["Rennes", 48.11, -1.68, "atlantique", "FR"],
  ["Brest", 48.39, -4.49, "atlantique", "FR"],
  ["Strasbourg", 48.58, 7.75, "continental", "FR"],
  ["Paris", 48.86, 2.35, "continental", "FR"],
  ["Rouen", 49.44, 1.10, "oceanique", "FR"],
  ["Amiens", 49.89, 2.30, "oceanique", "FR"],
  ["Lille", 50.63, 3.06, "oceanique", "FR"],
  // Allemagne
  ["Fribourg-en-B.", 47.99, 7.85, "continental", "DE"],
  ["Munich", 48.14, 11.58, "atlantique", "DE"],
  ["Stuttgart", 48.78, 9.18, "atlantique", "DE"],
  ["Nuremberg", 49.45, 11.08, "continental", "DE"],
  ["Francfort", 50.11, 8.68, "continental", "DE"],
  ["Cologne", 50.94, 6.96, "continental", "DE"],
  ["Dresde", 51.05, 13.74, "continental", "DE"],
  ["Leipzig", 51.34, 12.37, "continental", "DE"],
  ["Hanovre", 52.37, 9.73, "oceanique", "DE"],
  ["Berlin", 52.52, 13.40, "continental", "DE"],
  ["Hambourg", 53.55, 9.99, "oceanique", "DE"],
  ["Rostock", 54.09, 12.14, "continental", "DE"],
  // Autriche
  ["Graz", 47.07, 15.44, "atlantique", "AT"],
  ["Innsbruck", 47.27, 11.39, "sudouest", "AT"],
  ["Salzbourg", 47.81, 13.04, "atlantique", "AT"],
  ["Vienne", 48.21, 16.37, "atlantique", "AT"],
  // Belgique
  ["Liège", 50.63, 5.57, "oceanique", "BE"],
  ["Bruxelles", 50.85, 4.35, "continental", "BE"],
  ["Anvers", 51.22, 4.40, "continental", "BE"],
  // Espagne
  ["Málaga", 36.72, -4.42, "mediterraneen", "ES"],
  ["Séville", 37.39, -5.99, "mediterraneen", "ES"],
  ["Murcie", 37.99, -1.13, "mediterraneen", "ES"],
  ["Valencia", 39.47, -0.38, "mediterraneen", "ES"],
  ["Madrid", 40.42, -3.70, "mediterraneen", "ES"],
  ["Barcelone", 41.39, 2.17, "mediterraneen", "ES"],
  ["Saragosse", 41.65, -0.89, "mediterraneen", "ES"],
  ["Saint-Jacques", 42.88, -8.54, "sudouest", "ES"],
  ["Bilbao", 43.26, -2.93, "atlantique", "ES"],
  // Irlande
  ["Cork", 51.90, -8.47, "continental", "IE"],
  ["Dublin", 53.35, -6.26, "continental", "IE"],
  // Italie
  ["Catane", 37.51, 15.09, "mediterraneen", "IT"],
  ["Palerme", 38.12, 13.36, "mediterraneen", "IT"],
  ["Cagliari", 39.22, 9.12, "mediterraneen", "IT"],
  ["Naples", 40.85, 14.27, "mediterraneen", "IT"],
  ["Bari", 41.12, 16.87, "mediterraneen", "IT"],
  ["Rome", 41.90, 12.50, "mediterraneen", "IT"],
  ["Florence", 43.77, 11.26, "mediterraneen", "IT"],
  ["Bologne", 44.49, 11.34, "sudouest", "IT"],
  ["Turin", 45.07, 7.69, "sudouest", "IT"],
  ["Venise", 45.44, 12.32, "sudouest", "IT"],
  ["Milan", 45.46, 9.19, "sudouest", "IT"],
  // Luxembourg
  ["Luxembourg", 49.61, 6.13, "continental", "LU"],
  // Pays-Bas
  ["Rotterdam", 51.92, 4.48, "continental", "NL"],
  ["Amsterdam", 52.37, 4.90, "continental", "NL"],
  ["Groningue", 53.22, 6.57, "oceanique", "NL"],
  // Portugal
  ["Faro", 37.02, -7.93, "mediterraneen", "PT"],
  ["Lisbonne", 38.72, -9.14, "mediterraneen", "PT"],
  ["Porto", 41.15, -8.61, "mediterraneen", "PT"],
  // Royaume-Uni
  ["Bristol", 51.45, -2.59, "continental", "GB"],
  ["Cardiff", 51.48, -3.18, "oceanique", "GB"],
  ["Londres", 51.51, -0.13, "continental", "GB"],
  ["Birmingham", 52.49, -1.89, "continental", "GB"],
  ["Manchester", 53.48, -2.24, "oceanique", "GB"],
  ["Belfast", 54.60, -5.93, "oceanique", "GB"],
  ["Newcastle", 54.98, -1.61, "continental", "GB"],
  ["Glasgow", 55.86, -4.25, "oceanique", "GB"],
  ["Édimbourg", 55.95, -3.19, "oceanique", "GB"],
  ["Aberdeen", 57.15, -2.09, "oceanique", "GB"],
  // Suisse
  ["Lugano", 46.01, 8.96, "sudouest", "CH"],
  ["Genève", 46.20, 6.14, "sudouest", "CH"],
  ["Berne", 46.95, 7.45, "atlantique", "CH"],
  ["Zurich", 47.37, 8.54, "continental", "CH"]
];

/** Repère le plus proche de coordonnées données : son nom, sa distance en
    kilomètres, et sa zone climatique.

    La zone est celle du repère le plus proche, et non le résultat d'un
    découpage géographique séparé : une seule source de vérité, celle du
    tableau ci-dessus, évite de voir les deux diverger. Le relevé place le
    curseur au bon endroit pour démarrer, l'utilisateur reste libre de
    corriger la zone d'un geste. */
export function nearestCity(lat, lon) {
  let best = CITIES[0], bestD = Infinity;
  for (const c of CITIES) {
    const dx = (c[2] - lon) * Math.cos(lat * Math.PI / 180), dy = c[1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return { name: best[0], km: Math.round(Math.sqrt(bestD) * 111), zone: best[3] };
}
