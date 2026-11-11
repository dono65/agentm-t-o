/**
 * Prépare les données géographiques du Sud-Ouest :
 * 1. Filtre le GeoJSON national des départements (Etalab / geojson.fr)
 *    sur les 21 départements du Sud-Ouest (Nouvelle-Aquitaine + Occitanie hors est).
 * 2. Calcule pour chaque département un point de référence "représentatif"
 *    (moyenne des sommets, corrigée pour rester dans le polygone) qui servira
 *    à interroger des prévisions chiffrées par département.
 *
 * Usage : node src/tools/preparer-donnees-geo.mjs
 * Sorties :
 *  - src/data/geo/departements-sudouest.geojson
 *  - <temp>\centroids.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Codes départements retenus pour le domaine « Sud-Ouest »
const CODES = new Set([
  "16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87",
  "09", "11", "31", "32", "46", "65", "81", "82", "66",
]);

const racine = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const source = JSON.parse(
  readFileSync(join(racine, "data/geo/departements-fr.geojson"), "utf8"),
);

function coordonnees(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((p) => p[0]);
  return [];
}

// Point moyen des sommets, puis le sommet le plus proche si le point tombe dehors.
function pointRepresentatif(geometry) {
  const anneaux = coordonnees(geometry);
  let sx = 0, sy = 0, n = 0;
  for (const anneau of anneaux) {
    for (const [x, y] of anneau) { sx += x; sy += y; n++; }
  }
  let px = sx / n, py = sy / n;

  const dedans = (x, y) =>
    anneaux.some((r) => {
      let ok = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
      }
      return ok;
    });

  if (!dedans(px, py)) {
    let mieux = null, dmin = Infinity;
    for (const anneau of anneaux) {
      for (const [x, y] of anneau) {
        const d = (x - px) ** 2 + (y - py) ** 2;
        if (d < dmin) { dmin = d; mieux = [x, y]; }
      }
    }
    [px, py] = mieux;
  }
  return [px, py];
}

const features = source.features.filter((f) => CODES.has(String(f.properties.code)));
const centroides = [];

const filtre = {
  type: "FeatureCollection",
  name: "departements-sud-ouest",
  features: features.map((f) => {
    const { code, nom } = f.properties;
    const [lon, lat] = pointRepresentatif(f.geometry);
    centroides.push({ code: String(code), nom, lat: +lat.toFixed(3), lon: +lon.toFixed(3) });
    return { type: "Feature", properties: { code: String(code), nom }, geometry: f.geometry };
  }),
};

writeFileSync(
  join(racine, "data/geo/departements-sudouest.geojson"),
  JSON.stringify(filtre),
);
// Points de référence (centroïdes) réutilisés par la commande /update-rapport
// pour interroger des prévisions chiffrées par département.
writeFileSync(join(racine, "data/geo/centroids.json"), JSON.stringify(centroides, null, 2));
console.log(`${filtre.features.length} départements retenus :`, centroides.map((c) => c.code).join(","));
