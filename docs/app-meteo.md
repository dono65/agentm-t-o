# Application web « Météo Sud-Ouest »

Documentation d'architecture du site placé dans `src/` (usage courant :
voir `src/README.md`).

## Objectif

Afficher visuellement, sur une carte du Sud-Ouest de la France, le
rapport météo synthétisé par la commande OpenCode
[`/update-rapport`](../.opencode/commands/update-rapport.md) :

- **températures**, **précipitations** et **rafales de vent** ;
- chaque donnée activable/désactivable et combinable sur la carte ;
- zones colorées cohérentes avec les données, plus l'affichage des valeurs ;
- le rapport également disponible textuellement dans la page
  (synthèse, évolutions, conseils, rapport complet).

## Choix techniques

| Choix | Justification |
| --- | --- |
| Site statique sans build (HTML/CSS/JS vanilla) | Aucune chaîne de compilation à maintenir ; le dossier `src/` est servi tel quel par n'importe quel serveur HTTP. |
| [Leaflet 1.9](https://leafletjs.com) via CDN + fonds CARTO/OSM | Carte interactive mature, légère, avec rendu SVG permettant les hachures ; dépendance unique. |
| Découpage par **départements** (GeoJSON Etalab, filtré) | Zones colorées alignées sur la carte « Sud-Ouest » des modèles Météociel et sur les données réellement mesurées ; évite des polygones faits main fragiles. |
| `rapport.json` comme contrat entre commande et site | La commande réécrit les données sans toucher au code ; le schéma est figé dans la définition de la commande. |

## Flux de données

```
Météociel (4 cartes modèles, zoom Sud-Ouest)
        │  interprétation (texte)
        ▼
/update-rapport  ──►  calibrage chiffré Open-Meteo (21 centroïdes)
        │
        ├─► src/data/rapport.json      (données de la carte)
        ├─► src/data/rapport.md        (rapport textuel)
        └─► src/data/historique-rapports.md

navigateur ──► index.html ──► app.js ──► rapport.json + geojson
                                    └─► rapport.md (à la demande)
```

## Rendu des couches

Les trois couches partagent les mêmes polygones et se superposent :

- **Température** : remplissage coloré (échelle violet → rouge sombre).
- **Précipitations** : motifs SVG `pattern` diagonaux injectés dans le
  renderer de Leaflet, un motif par seuil d'intensité, superposés au
  fond de température ; repli sur un remplissage translucide si le
  navigateur n'accepte pas `fill: url(#…)` ou si le renderer est en canvas.
- **Rafales** : contour du polygone coloré et épaissi selon l'intensité
  (2 px à 30 km/h, 7 px à 105+ km/h).

La légende du panneau est régénérée selon les couches actives ; les
pastilles des villes et les infobulles des départements reflètent
uniquement les couches affichées.

## Contraintes à préserver lors des évolutions

1. **Schéma de `rapport.json`** : tout changement doit rester rétro-
   compatible avec `src/js/app.js` et être répercuté dans la commande
   `.opencode/commands/update-rapport.md` (section « Étape 4 »).
2. **21 codes départements** : toute extension du périmètre passe par
   `src/tools/preparer-donnees-geo.mjs` (liste `CODES`) puis
   régénération des fichiers `src/data/geo/`.
3. **Le site doit rester statique** : pas d'API côté serveur ; le
   calibrage chiffré est fait par la commande, pas par le navigateur.
4. **Honnêteté des sources** : les valeurs chiffrées proviennent
   d'Open-Meteo (AROME Météo-France pour J0) ; l'interprétation
   provient des quatre pages Météociel. L'écart doit rester explicite
   dans `meta.methodologie` et dans `rapport.md`.
