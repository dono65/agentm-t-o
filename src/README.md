# Météo Sud-Ouest — application web

Application web statique qui affiche, sur une carte interactive du
Sud-Ouest de la France, le rapport météo produit par la commande
OpenCode `/update-rapport` : températures, précipitations et rafales de
vent, chaque donnée activable/désactivable, avec zones colorées
cohérentes et valeurs affichées.

## Lancer le site

Le site est statique (aucun build) mais doit être servi via HTTP
(pour permettre le chargement des données JSON/MD) :

```sh
cd src
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

Tout serveur statique convient (`npx serve src`, nginx, etc.).

## Utiliser la carte

- **Boutons Aujourd'hui / Demain / Après-demain** (en haut) : changent
  d'échéance (J0, J1, J2).
- **Couches** (panneau gauche) : `Température`, `Précipitations`,
  `Rafales de vent`, activables/désactivables et combinables :
  - Température : fond coloré du département (violet ≤ 0 °C → rouge
    sombre ≥ 28 °C) ;
  - Précipitations : hachures bleues/violettes superposées au fond
    (ou remplissage si la température est désactivée), densité
    proportionnelle au cumul 24 h ;
  - Rafales : contour épais coloré autour du département, épaisseur
    et couleur proportionnelles à l'intensité.
- **Pastilles des villes** : valeurs des couches actives.
- **Survol d'un département** : valeurs détaillées.
- **Ouvrir le rapport complet** : affiche `rapport.md` (synthèse,
  analyse détaillée, évolutions, conseils, méthodologie) rendu en HTML,
  plus un lien vers l'historique des éditions.
- Un bandeau prévient si le rapport date de plus de 36 h.

## Mettre à jour le rapport

Dans OpenCode, lancer :

```
/update-rapport
```

La commande (définition : `.opencode/commands/update-rapport.md`)
collecte les quatre cartes modèles Météociel (zoom « Sud-Ouest »),
calibre les valeurs par département via Open-Meteo, synthétise, puis
réécrit :

- `src/data/rapport.json` — données structurées lues par la carte ;
- `src/data/rapport.md` — rapport textuel complet affiché par le site ;
- `src/data/historique-rapports.md` — journal des éditions.

Recharger simplement la page ensuite.

## Structure

```
src/
├── index.html            Page principale
├── css/style.css         Thème sombre « tableau de bord »
├── js/app.js             Carte Leaflet, couches, légende, rendu markdown
├── data/
│   ├── rapport.json      Rapport (généré par /update-rapport)
│   ├── rapport.md        Rapport textuel complet
│   ├── historique-rapports.md
│   └── geo/
│       ├── departements-sudouest.geojson   Contours des 21 départements
│       ├── departements-fr.geojson         Source nationale (Etalab)
│       └── centroids.json                  Points de référence par département
└── tools/preparer-donnees-geo.mjs        Regénère les fichiers geo/
```

## Dépendances

- [Leaflet 1.9](https://leafletjs.com/) (CDN unpkg) et fonds de carte
  CARTO/OSM : seule dépendance runtime, aucune compilation.
- Node.js uniquement pour l'outil de préparation géographique et les
  validations (`node -e "JSON.parse(...)"`).

## Schéma des données (`rapport.json`)

Voir la section « Étape 4 » de `.opencode/commands/update-rapport.md` :
le schéma doit rester stable d'une édition à l'autre pour que le site
continue de fonctionner sans modification.

## Attributions

- Contours des départements : Etalab / projet france-geojson (licence ouverte).
- Fond de carte : © OpenStreetMap, © CARTO.
- Modèles météo consultés : Météociel (AROME Météo-France 1,3 km,
  WRF-NMM 5 km, CEP/ECMWF 9 km, ICON-EU 7 km — données métiers
  respectivelement Météo-France, Météociel, ECMWF CC BY 4.0, DWD).
- Calibrage chiffré : Open-Meteo.
- Le rapport ne remplace pas la vigilance officielle de Météo-France.
