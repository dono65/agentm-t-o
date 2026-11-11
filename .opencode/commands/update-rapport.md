---
description: Met à jour le rapport météo du Sud-Ouest à partir des modèles Météociel et régénère les données du site
---

# Commande /update-rapport

Tu dois produire une **nouvelle édition du rapport météo du Sud-Ouest de la France**
(21 départements de Nouvelle-Aquitaine et d'Occitanie ouest) couvrant
**aujourd'hui (J0), demain (J1) et après-demain (J2)**, puis l'intégrer aux
fichiers de données du site web `src/`. Le site (`src/index.html`) lit
`src/data/rapport.json` pour colorer les départements sur la carte et afficher
le texte du rapport.

Réponds toujours en français et suis les règles de `AGENTS.md`
(commit + push après chaque fichier modifié).

## Étape 1 — Collecter les sources (obligatoires)

Récupère avec l'outil webfetch les **quatre cartes modèles** ci-dessous. Elles
sont la base de l'interprétation météorologique (situation, répartition spatiale,
évolutions) :

1. AROME HD 1,3 km (Météo-France, Sud-Ouest) — carte de précipitations :
   https://www.meteociel.fr/modeles/arome.php?ech=3&mode=101&map=3
2. WRF-NMM 5 km (Sud-Ouest) — carte de précipitations :
   https://www.meteociel.fr/modeles/wrfnmm.php?ech=3&mode=1&map=3
3. CEP/ECMWF 9 km (zoom Sud-Ouest) — carte de précipitations :
   https://www.meteociel.fr/modeles/ecmwf_ctrl.php?ech=6&mode=2&carte=13&type=&
4. ICON-EU 7 km (Sud-Ouest) — carte de précipitations :
   https://www.meteociel.fr/modeles/icon-eu.php?ech=3&mode=1&map=503

### Paramètres utiles de ces pages (déjà identifiés)

- Les pages sont surtout des **images** ; extrais tout le texte disponible :
  titre, domaine (toujours `map=3` / `map=503` / `carte=13` = zoom « Sud-Ouest »),
  échéances affichées, numéros de run, légendes textuelles, précisions du modèle.
- Les cartes **numériques** à viser sur la même page, en changeant `mode` :
  - Température 2 m : AROME HD `mode=100` (ou `141` avec isothermes), WRF `mode=0`,
    ECMWF `mode=9`, ICON-EU `mode=0` ; températures max/min : AROME `mode=131/132`,
    WRF & ICON-EU `mode=31/32`, ECMWF `mode=20/21`.
  - Rafales : AROME HD `mode=111` (rafales 10 m) ou `mode=152` (max de l'échéance),
    WRF & ICON-EU `mode=11` (1 h) ou `mode=52` (max), ECMWF `mode=27` ou `32`.
  - Cumuls de précipitations : AROME `mode=125`, WRF/ICON-EU/ECMWF `mode=25`.
- Horaires de publication des runs : AROME ≈ 16h00/23h10/04h00/11h10,
  WRF ≈ 17h10/23h10/05h10/11h10, ECMWF ≈ 6h15/12h15/18h15/00h15.

## Étape 2 — Calibrer chiffré par département (Open-Meteo)

Les cartes étant des images, ancre les **valeurs numériques** du rapport avec
l'API Open-Meteo (sans clé), qui diffuse AROME-France HD de Météo-France :

- Pour **J0** : modèle `meteofrance_arome_france_hd`
  (`https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max&timezone=Europe%2FParis&forecast_days=3&models=meteofrance_arome_france_hd`).
- Pour **J1 et J2** : même URL sans `models` (choix optimal Open-Meteo).
- Les 21 points de référence par département sont dans
  `src/data/geo/centroids.json` (codes, noms, lat, lon). Utilise un seul appel
  par département (l'outil `execute` permet de tous les faire en parallèle).
- Conserve : temp max, temp min (°C, arrondies), précipitations (cumul 24 h en mm,
  à 0,1), rafale max (km/h, arrondie).
- Si l'AROME ne couvre pas une échéance (il s'arrête vers 51 h), prends le
  résultat « best_match » et mentionne-le dans la méthodologie.

## Étape 3 — Analyser, synthétiser, projeter

Croise les quatre modèles et les valeurs chiffrées pour produire :

1. **Situation synoptique** : type de temps, flux dominant, position des
   perturbations, contrastes littoral/intérieur/montagne.
2. **Analyse par échéance (J0, J1, J2)** pour chaque couche :
   températures (max/min, zones les plus douces/fraîches, gelées),
   précipitations (cumuls, zones les plus arrosées/protégées),
   rafales (secteurs exposés : couloirs du SO, tramontane/cers, littoral).
3. **Évolutions possibles** : ce qui peut changer entre J2 et J+4 selon les
   modèles (divergences, fiabilité décroissante), scénarios alternatifs.
4. **Alertes** : phénomènes notables (fortes pluies, vents ≥ 70 km/h, gelées,
   orages) formulés en une phrase par département ou groupe concerné.
5. **Groupes de zones** : réutilise ceux de l'édition précédente
   (`groupes` dans `src/data/rapport.json`) pour garder des comparaisons stables :
   littoral atlantique, intérieur aquitain, bassin toulousain, piémont et chaîne
   pyrénéenne, versant méditerranéen.

Reste honnête : distingue ce qui vient des cartes (interprétation) de ce qui
vient des valeurs chiffrées (calibrage). Si une source est indisponible, note-le
et base-toi sur les autres en l'expliquant.

## Étape 4 — Écrire les fichiers

### `src/data/rapport.json` (schéma strict à respecter)

```json
{
  "schema": 1,
  "meta": {
    "genere_le": "ISO 8601",
    "generateur": "/update-rapport",
    "titre": "Rapport météo — Sud-Ouest de la France",
    "perimetre": "21 départements du Sud-Ouest (Nouvelle-Aquitaine + Occitanie ouest)",
    "validite": { "de": "AAAA-MM-JJ", "a": "AAAA-MM-JJ" },
    "sources": [ { "nom": "…", "url": "…" } ],
    "methodologie": "résumé court de la méthode et des limites"
  },
  "periodes": [
    { "id": "j0", "date": "AAAA-MM-JJ", "label": "Mercredi 11 novembre", "court": "Aujourd'hui" },
    { "id": "j1", "date": "AAAA-MM-JJ", "label": "…", "court": "Demain" },
    { "id": "j2", "date": "AAAA-MM-JJ", "label": "…", "court": "Après-demain" }
  ],
  "villes": [
    { "nom": "Bordeaux", "dept": "33", "lat": 44.838, "lon": -0.579 }
  ],
  "valeurs": {
    "j0": { "33": { "temperature_max": 20, "temperature_min": 13, "precipitation": 0.5, "rafale": 27 } },
    "j1": { "…": { "…": "…" } },
    "j2": { "…": { "…": "…" } }
  },
  "groupes": [ { "id": "littoral", "nom": "Littoral atlantique", "depts": ["17","33","40","64"], "commentaire": "…" } ],
  "synthese": "markdown court (3 à 6 phrases)",
  "evolutions": "markdown court",
  "conseils": "markdown court",
  "alertes": [ "…" ],
  "confiance": { "j0": "élevée", "j1": "bonne", "j2": "modérée" }
}
```

Règles : `valeurs` couvre **les 21 codes** de `src/data/geo/centroids.json`
pour **les 3 périodes** ; les codes sont des chaînes à 2 chiffres ; n'invente
aucun département hors périmètre ; garde la structure exactement identique
d'une édition à l'autre pour que le site continue de fonctionner.

### `src/data/rapport.md` (rapport complet, en français)

Structure imposée : titre + horodatage/validité ; 1. Synthèse ; 2. Situation
synoptique ; 3. Analyse détaillée J0/J1/J2 (températures, précipitations,
rafales, avec tableaux par groupe de zones) ; 4. Évolutions possibles et
incertitudes ; 5. Conseils pratiques ; 6. Méthodologie et sources ; 7. Limites.
Le site affiche ce fichier tel quel : le markdown doit rester simple
(titres, gras, listes, tableaux).

### `src/data/historique-rapports.md`

Ajoute une entrée en tête de liste : date, heure, run/échéances couvertes,
une phrase de synthèse, et les changements notables par rapport à l'édition
précédente.

## Étape 5 — Valider

1. `node -e "JSON.parse(require('fs').readFileSync('src/data/rapport.json','utf8'));console.log('JSON valide')"`
2. Vérifie que chaque code de `centroids.json` a ses 3 périodes dans `valeurs`.
3. Vérifie que les coordonnées de `villes` sont bien dans le Sud-Ouest
   (lat 42,3–46,7 ; lon -2,1–3,7).

## Étape 6 — Commit et push

Un commit détaillé en français par fichier modifié (règles `AGENTS.md`,
format `type(scope): résumé à l'impératif`), suivi d'un `git push`. Termine par
un résumé pour l'utilisateur : points clés de la nouvelle édition, alertes,
niveau de confiance, et un rappel des limites.
