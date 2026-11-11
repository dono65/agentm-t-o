/**
 * Météo Sud-Ouest — logique de l'application
 *
 * Charge le rapport produit par la commande /update-rapport
 * (src/data/rapport.json) et les contours des départements
 * (src/data/geo/departements-sudouest.geojson), puis dessine :
 *  - les départements colorés par température maximale (fond) ;
 *  - les précipitations (hachures superposées au fond, ou remplissage
 *    si la couche température est désactivée) ;
 *  - les rafales (contour épais coloré autour des départements) ;
 *  - les pastilles des grandes villes affichant les valeurs actives.
 *
 * Les trois couches sont activables/désactivables indépendamment et se
 * combinent ; le sélecteur de période fait passer d'un jour à l'autre.
 */
"use strict";

/* ------------------------------------------------------------------
 * Échelles de couleurs
 * ------------------------------------------------------------------ */

const ECHUELLES = {
  temperature: {
    titre: "Température maximale",
    unite: "°C",
    segments: [
      { max: 0, c: "#7b5fb5", lib: "≤ 0" },
      { max: 4, c: "#3f6fd0", lib: "0–4" },
      { max: 8, c: "#4fa3d9", lib: "4–8" },
      { max: 12, c: "#5fb877", lib: "8–12" },
      { max: 16, c: "#e8c93b", lib: "12–16" },
      { max: 20, c: "#ec9b3d", lib: "16–20" },
      { max: 24, c: "#e2603e", lib: "20–24" },
      { max: 28, c: "#c23a30", lib: "24–28" },
      { max: Infinity, c: "#8e1b2e", lib: "≥ 28" },
    ],
  },
  precipitation: {
    titre: "Précipitations",
    unite: "mm / 24 h",
    segments: [
      { max: 0.05, c: null, lib: "sec" },
      { max: 1, c: "#a8d8f0", lib: "0–1" },
      { max: 3, c: "#64aede", lib: "1–3" },
      { max: 6, c: "#3d7fc4", lib: "3–6" },
      { max: 10, c: "#2b62a8", lib: "6–10" },
      { max: 15, c: "#5c4bc2", lib: "10–15" },
      { max: 25, c: "#7a3fa8", lib: "15–25" },
      { max: Infinity, c: "#4a1f6e", lib: "≥ 25" },
    ],
  },
  rafale: {
    titre: "Rafales de vent",
    unite: "km/h",
    segments: [
      { max: 30, c: "#7f8c8d", lib: "< 30" },
      { max: 40, c: "#e6c229", lib: "30–40" },
      { max: 55, c: "#e08b3a", lib: "40–55" },
      { max: 70, c: "#e05a3a", lib: "55–70" },
      { max: 90, c: "#c23a30", lib: "70–90" },
      { max: 110, c: "#8e44ad", lib: "90–110" },
      { max: Infinity, c: "#5b2c6f", lib: "≥ 110" },
    ],
  },
};

/* Définition des trois couches activables (ordre d'affichage dans le panneau). */
const COUCHES = [
  { id: "temperature", lib: "Température", detail: "maximale journalière" },
  { id: "precipitation", lib: "Précipitations", detail: "cumul 24 h" },
  { id: "rafale", lib: "Rafales de vent", detail: "maximale journalière" },
];

/* ------------------------------------------------------------------
 * État de l'application
 * ------------------------------------------------------------------ */

const ETAT = {
  rapport: null,
  periode: "j0",
  couches: { temperature: true, precipitation: true, rafale: true },
  hachuresOK: false,
};

let CARTE = null;
let coucheDepts = null;
let groupeVilles = null;

/* ------------------------------------------------------------------
 * Utilitaires
 * ------------------------------------------------------------------ */

function echapper(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rendu markdown minimal : titres, gras, `code`, listes, tableaux, séparateurs. */
function markdown(texte) {
  const lignes = echapper(texte).split(/\r?\n/);
  const sortie = [];
  let dansListe = false;
  let dansTable = false;

  const fermerListe = () => {
    if (dansListe) { sortie.push("</ul>"); dansListe = false; }
  };
  const fermerTable = () => {
    if (dansTable) { sortie.push("</table>"); dansTable = false; }
  };

  for (const brut of lignes) {
    const ligne = brut.trim();

    if (ligne.startsWith("|") && ligne.endsWith("|")) {
      const cellules = ligne.slice(1, -1).split("|").map((c) => c.trim());
      const separateur = cellules.every((c) => c === "" || /^:?-{2,}:?$/.test(c));
      if (separateur) continue; // ligne de séparation du tableau
      fermerListe();
      if (!dansTable) { sortie.push("<table>"); dansTable = true; }
      sortie.push("<tr>" + cellules.map((c) => `<td>${enrichir(c)}</td>`).join("") + "</tr>");
      continue;
    }
    fermerTable();

    if (ligne === "") { fermerListe(); continue; }
    if (/^-{3,}$/.test(ligne)) { fermerListe(); sortie.push("<hr>"); continue; }

    const titre = ligne.match(/^(#{1,4})\s+(.*)$/);
    if (titre) {
      fermerListe();
      const niveau = Math.min(titre[1].length + 1, 6);
      sortie.push(`<h${niveau}>${enrichir(titre[2])}</h${niveau}>`);
      continue;
    }

    if (/^[-*•]\s+/.test(ligne)) {
      if (!dansListe) { sortie.push("<ul>"); dansListe = true; }
      sortie.push(`<li>${enrichir(ligne.replace(/^[-*•]\s+/, ""))}</li>`);
      continue;
    }

    fermerListe();
    sortie.push(`<p>${enrichir(ligne)}</p>`);
  }

  fermerListe();
  fermerTable();
  return sortie.join("\n");
}

function enrichir(texte) {
  return texte
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/* ------------------------------------------------------------------
 * Valeurs du rapport
 * ------------------------------------------------------------------ */

/** Valeurs (par couche) du département pour la période courante. */
function valeursPour(code) {
  const brut = (ETAT.rapport.valeurs[ETAT.periode] || {})[code] || {};
  return {
    temperature: brut.temperature_max ?? null,
    precipitation: brut.precipitation ?? null,
    rafale: brut.rafale ?? null,
  };
}

/** Index du premier segment de l'échelle englobant la valeur. */
function segmentPour(couche, v) {
  const segments = ECHUELLES[couche].segments;
  for (let i = 0; i < segments.length; i++) {
    if (v < segments[i].max) return i;
  }
  return segments.length - 1;
}

function couleurPour(couche, v) {
  if (v == null) return "#3a4356";
  return ECHUELLES[couche].segments[segmentPour(couche, v)].c || "#3a4356";
}

/** Dégradé pour la pastille des bascules. */
function gradientCouche(couche) {
  const couleurs = ECHUELLES[couche].segments.filter((s) => s.c).map((s) => s.c);
  return `linear-gradient(90deg, ${couleurs.join(", ")})`;
}

function valeurFormat(couche, v) {
  if (v == null) return "n/d";
  if (couche === "temperature") return `${v} °C`;
  if (couche === "rafale") return `${v} km/h`;
  return v < 0.05 ? "sec" : `${v} mm`;
}

/* ------------------------------------------------------------------
 * Styles de la carte
 * ------------------------------------------------------------------ */

/** Style d'un département selon les couches actives et sa valeur. */
function styleDept(feature) {
  const v = valeursPour(feature.properties.code);
  const opts = {
    color: "#2f3f55",
    weight: 1,
    opacity: 0.85,
    fillColor: "#44566e",
    fillOpacity: 0.1,
  };

  if (ETAT.couches.temperature && v.temperature != null) {
    opts.fillColor = couleurPour("temperature", v.temperature);
    opts.fillOpacity = 0.55;
  }

  if (ETAT.couches.precipitation && v.precipitation != null && v.precipitation >= 0.05) {
    const url = ETAT.hachuresOK
      ? `url(#hachure-${segmentPour("precipitation", v.precipitation)})`
      : null;
    if (url) {
      // superposition : hachures de pluie au-dessus du fond de température
      opts.fillColor = url;
      opts.fillOpacity = 0.95;
    } else if (!ETAT.couches.temperature) {
      opts.fillColor = couleurPour("precipitation", v.precipitation);
      opts.fillOpacity = 0.55;
    } else {
      opts.fillColor = couleurPour("precipitation", v.precipitation);
      opts.fillOpacity = 0.45;
    }
  }

  if (ETAT.couches.rafale && v.rafale != null) {
    opts.color = couleurPour("rafale", v.rafale);
    opts.weight = 2 + Math.min(5, Math.max(0, (v.rafale - 30) / 15));
    opts.opacity = 1;
  }

  // Si aucune couche de remplissage n'est active mais que les rafales le sont,
  // un fond léger garde la carte lisible.
  if (!ETAT.couches.temperature && !ETAT.couches.precipitation && ETAT.couches.rafale && v.rafale != null) {
    opts.fillColor = couleurPour("rafale", v.rafale);
    opts.fillOpacity = 0.45;
  }

  return opts;
}

/** Injecte les motifs de hachures (un par seuil de précipitation) dans le SVG de Leaflet. */
function injecterHachures() {
  try {
    const rendu = CARTE.getRenderer(coucheDepts);
    const svg = rendu && rendu._container;
    if (!svg) return;
    if (svg.querySelector("defs#hachures-pluie")) { ETAT.hachuresOK = true; return; }

    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    defs.setAttribute("id", "hachures-pluie");

    ECHUELLES.precipitation.segments.forEach((seg, i) => {
      if (!seg.c) return;
      const motif = document.createElementNS(ns, "pattern");
      motif.setAttribute("id", `hachure-${i}`);
      motif.setAttribute("width", "8");
      motif.setAttribute("height", "8");
      motif.setAttribute("patternUnits", "userSpaceOnUse");
      motif.setAttribute("patternTransform", "rotate(45)");
      const trace = document.createElementNS(ns, "line");
      trace.setAttribute("x1", "0");
      trace.setAttribute("y1", "0");
      trace.setAttribute("x2", "0");
      trace.setAttribute("y2", "8");
      trace.setAttribute("stroke", seg.c);
      trace.setAttribute("stroke-width", "3");
      motif.appendChild(trace);
      defs.appendChild(motif);
    });

    svg.appendChild(defs);
    ETAT.hachuresOK = true;
  } catch (erreur) {
    console.warn("Hachures indisponibles, repli sur remplissage translucide :", erreur);
    ETAT.hachuresOK = false;
  }
}

/* ------------------------------------------------------------------
 * Infobulles et marqueurs
 * ------------------------------------------------------------------ */

function contenuInfobulle(feature) {
  const v = valeursPour(feature.properties.code);
  const lignes = COUCHES.filter((c) => ETAT.couches[c.id]).map((c) =>
    `<span class="val"><span class="rond" style="background:${couleurPour(c.id, v[c.id])}"></span>` +
    `${c.lib} : <strong>${valeurFormat(c.id, v[c.id])}</strong></span>`,
  );
  return `<span class="nom-dept">${echapper(feature.properties.nom)}</span>${lignes.join("")}`;
}

function marquerVilles() {
  groupeVilles.clearLayers();
  const villes = ETAT.rapport.villes || [];
  for (const ville of villes) {
    const v = valeursPour(ville.dept);
    const lignes = COUCHES.filter((c) => ETAT.couches[c.id]).map((c) =>
      `<span class="val-ville"><i style="background:${couleurPour(c.id, v[c.id])}"></i>` +
      `${valeurFormat(c.id, v[c.id])}</span>`,
    );
    if (!lignes.length) continue;
    const html = `<div class="marqueur-ville"><span class="nom">${echapper(ville.nom)}</span>${lignes.join("")}</div>`;
    L.marker([ville.lat, ville.lon], {
      interactive: false,
      icon: L.divIcon({ className: "ville-div", html, iconSize: [0, 0], iconAnchor: [0, 0] }),
    }).addTo(groupeVilles);
  }
}

/* ------------------------------------------------------------------
 * Panneau latéral
 * ------------------------------------------------------------------ */

function construireBascules() {
  const conteneur = document.getElementById("bascules");
  conteneur.innerHTML = "";
  for (const c of COUCHES) {
    const el = document.createElement("div");
    el.className = "bascule" + (ETAT.couches[c.id] ? " veut" : "");
    el.setAttribute("role", "switch");
    el.setAttribute("aria-checked", String(ETAT.couches[c.id]));
    el.innerHTML =
      `<span class="pastille-couleur" style="background:${gradientCouche(c.id)}"></span>` +
      `<span class="libelle">${c.lib}<br><span class="unite">${ECHUELLES[c.id].unite} · ${c.detail}</span></span>` +
      `<span class="interrupteur"></span>`;
    el.addEventListener("click", () => {
      ETAT.couches[c.id] = !ETAT.couches[c.id];
      construireBascules();
      majTout();
    });
    conteneur.appendChild(el);
  }
}

function construirePeriodes() {
  const conteneur = document.getElementById("periodes");
  conteneur.innerHTML = "";
  for (const p of ETAT.rapport.periodes) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.court;
    b.title = `${p.label} (${p.date}) — confiance : ${(ETAT.rapport.confiance || {})[p.id] || "?"}`;
    if (p.id === ETAT.periode) b.classList.add("actif");
    b.addEventListener("click", () => {
      ETAT.periode = p.id;
      construirePeriodes();
      majTout();
    });
    conteneur.appendChild(b);
  }
}

function rendreLegende() {
  const conteneur = document.getElementById("legende");
  const actives = COUCHES.filter((c) => ETAT.couches[c.id]);
  if (!actives.length) {
    conteneur.innerHTML = '<p class="legende-note">Aucune couche active — activez une couche ci-dessus.</p>';
    return;
  }
  conteneur.innerHTML = actives.map((c) => {
    const echelle = ECHUELLES[c.id].segments
      .map((s) => `<span style="background:${s.c || "repeating-linear-gradient(45deg,#2c3b50,#2c3b50 3px,#44566e 3px,#44566e 6px)"}"></span>`)
      .join("");
    const valeurs = ECHUELLES[c.id].segments
      .map((s) => `<span>${s.lib}</span>`)
      .join("");
    const notes = {
      precipitation: "Hachures superposées au fond coloré quand la température est aussi active.",
      rafale: "Épaisseur du contour proportionnelle à l'intensité.",
    };
    return (
      `<div class="legende-groupe">` +
      `<div class="legende-titre">${c.lib} (${ECHUELLES[c.id].unite})</div>` +
      `<div class="legende-echelle">${echelle}</div>` +
      `<div class="legende-valeurs">${valeurs}</div>` +
      (notes[c.id] ? `<div class="legende-note">${notes[c.id]}</div>` : "") +
      `</div>`
    );
  }).join("");
}

function rendreAlertes() {
  const alertes = ETAT.rapport.alertes || [];
  const bloc = document.getElementById("bloc-alertes");
  if (!alertes.length) { bloc.classList.add("cache"); return; }
  bloc.classList.remove("cache");
  document.getElementById("alertes").innerHTML =
    alertes.map((a) => `<li>${enrichir(echapper(a))}</li>`).join("");
}

function rendreTextes() {
  document.getElementById("synthese").innerHTML = markdown(ETAT.rapport.synthese || "");
  document.getElementById("evolutions").innerHTML = markdown(ETAT.rapport.evolutions || "");
  document.getElementById("conseils").innerHTML = markdown(ETAT.rapport.conseils || "");
}

/* ------------------------------------------------------------------
 * En-tête : badges et avertissements
 * ------------------------------------------------------------------ */

function dateFrancaise(iso, avecHeure) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return echapper(iso);
  return d.toLocaleString("fr-FR", avecHeure
    ? { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }
    : { weekday: "long", day: "numeric", month: "long" });
}

function rendreBadges() {
  const meta = ETAT.rapport.meta || {};
  const badge = document.getElementById("badge-maj");
  badge.textContent = `Rapport généré le ${dateFrancaise(meta.genere_le || "", true)}`;

  const gen = new Date(meta.genere_le || "").getTime();
  if (!Number.isNaN(gen) && Date.now() - gen > 36 * 3600 * 1000) {
    avertir(`Ce rapport date du ${dateFrancaisCourt(meta.genere_le)} — lancez la commande /update-rapport pour l'actualiser.`);
  }
}

function dateFrancaisCourt(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function majBadgePeriode() {
  const p = (ETAT.rapport.periodes || []).find((x) => x.id === ETAT.periode);
  if (!p) return;
  const confiance = (ETAT.rapport.confiance || {})[p.id];
  document.getElementById("badge-periode").textContent =
    `${p.label} · ${dateFrancaise(p.date, false)}${confiance ? ` · confiance ${confiance}` : ""}`;
}

function avertir(message, grave) {
  const el = document.getElementById("avertissement");
  el.classList.remove("cache");
  el.classList.toggle("erreur", Boolean(grave));
  el.textContent = message;
}

/* ------------------------------------------------------------------
 * Mise à jour globale
 * ------------------------------------------------------------------ */

function majTout() {
  if (!coucheDepts) return;
  coucheDepts.eachLayer((c) => {
    c.setStyle(styleDept(c.feature));
    if (c.getTooltip()) c.setTooltipContent(contenuInfobulle(c.feature));
  });
  marquerVilles();
  rendreLegende();
  majBadgePeriode();
}

/* ------------------------------------------------------------------
 * Initialisation de la carte et du rapport
 * ------------------------------------------------------------------ */

function initCarte() {
  CARTE = L.map("carte", { minZoom: 6, maxZoom: 11, zoomSnap: 0.5 });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/" target="_blank" rel="noopener">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(CARTE);
  CARTE.setView([44.6, 0.4], 7);
  groupeVilles = L.layerGroup().addTo(CARTE);
}

function chargerRapport(rapport, geo) {
  ETAT.rapport = rapport;

  coucheDepts = L.geoJSON(geo, {
    style: styleDept,
    onEachFeature: (feature, couche) => {
      couche.bindTooltip(contenuInfobulle(feature), {
        sticky: true,
        direction: "top",
        className: "dept-infobulle",
        opacity: 1,
      });
      couche.on("mouseover", () => {
        couche.setStyle({ weight: styleDept(feature).weight + 2 });
        couche.bringToFront();
      });
      couche.on("mouseout", () => couche.setStyle(styleDept(feature)));
    },
  }).addTo(CARTE);

  injecterHachures();
  CARTE.fitBounds(coucheDepts.getBounds(), { padding: [14, 14] });

  construirePeriodes();
  construireBascules();
  rendreAlertes();
  rendreTextes();
  rendreLegende();
  rendreBadges();
  majBadgePeriode();
  marquerVilles();
}

async function chargerRapportComplet() {
  const reponse = await fetch("data/rapport.md");
  if (!reponse.ok) throw new Error(`rapport.md (${reponse.status})`);
  return markdown(await reponse.text());
}

/* ------------------------------------------------------------------
 * Démarrage
 * ------------------------------------------------------------------ */

window.addEventListener("DOMContentLoaded", async () => {
  const chargement = document.getElementById("chargement");

  initCarte();

  try {
    const [rapport, geo] = await Promise.all([
      fetch("data/rapport.json").then((r) => {
        if (!r.ok) throw new Error(`rapport.json (${r.status})`);
        return r.json();
      }),
      fetch("data/geo/departements-sudouest.geojson").then((r) => {
        if (!r.ok) throw new Error(`departements-sudouest.geojson (${r.status})`);
        return r.json();
      }),
    ]);

    chargerRapport(rapport, geo);
  } catch (erreur) {
    console.error(erreur);
    avertir(
      `Impossible de charger le rapport : ${erreur.message}. ` +
      "Si la page est ouverte directement (file://), servez le dossier src/ via un serveur HTTP " +
      "(par exemple : python -m http.server 8000, puis http://localhost:8000) et relancez la commande /update-rapport pour générer src/data/rapport.json.",
      true,
    );
  } finally {
    chargement.classList.add("cache");
    CARTE.invalidateSize();
  }

  // Rapport complet (chargé à la demande)
  const overlay = document.getElementById("overlay-rapport");
  document.getElementById("btn-rapport-complet").addEventListener("click", async () => {
    const cible = document.getElementById("rapport-complet-texte");
    if (!cible.dataset.charge) {
      cible.innerHTML = '<p class="legende-note">Chargement…</p>';
      try {
        cible.innerHTML = await chargerRapportComplet();
        cible.dataset.charge = "1";
      } catch (e) {
        cible.innerHTML = `<p>Rapport complet indisponible : ${echapper(e.message)}</p>`;
      }
    }
    overlay.classList.remove("cache");
  });
  document.getElementById("btn-fermer-rapport").addEventListener("click", () => overlay.classList.add("cache"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") overlay.classList.add("cache");
  });

  window.addEventListener("resize", () => CARTE.invalidateSize());
});
