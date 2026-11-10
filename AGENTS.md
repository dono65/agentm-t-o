# AGENTS.md

Instructions pour les agents OpenCode travaillant dans ce dépôt.

## Contexte du projet

- **Nom** : agentm-t-o
- **Description** : (à compléter — décrivez ici l'objectif du projet)
- **Stack** : (à compléter — langages, frameworks, outils de build)

## Structure du dépôt

```
.
├── AGENTS.md          # Ce fichier : instructions pour les agents
├── opencode.json      # Configuration OpenCode du projet
├── .opencode/         # Agents, commandes et skills personnalisés
│   ├── agent/         # Agents définis en Markdown (frontmatter)
│   ├── command/       # Commandes slash personnalisées
│   └── skill/         # Skills (répertoires avec SKILL.md)
└── docs/              # Documentation du projet
```

## Règles impératives

1. **Langue** : les agents s'adressent toujours à l'utilisateur en français,
   ainsi que les messages de commit.
2. **Ouverture de session** : à chaque ouverture d'OpenCode sur ce projet, la
   première action est d'exécuter `git pull` pour synchroniser le dépôt.
3. **Synchronisation git** : chaque modification de fichier entraîne
   obligatoirement, immédiatement :
   - un `git commit` détaillé exprimant conceptuellement les modifications
     (pas seulement le "quoi", mais le "pourquoi") ;
   - un `git push`.

## Règles de travail

1. **Lire avant d'écrire** : inspectez les fichiers existants avant toute
   modification ; présumez que le code non familier est un travail de
   l'utilisateur en cours.
2. **Rester cohérent** : suivez le style, la nommure et les patterns du code
   environnant. Voir `docs/conventions.md`.
3. **Modifications ciblées** : privilégiez les éditions minimales ; n'écrasez
   un fichier que si nécessaire.
4. **Commits** : messages détaillés en français, à l'impératif, avec un
   résumé court (`fix: corrige le calcul X`) et un corps expliquant le
   raisonnement conceptuel de la modification.
5. **Ne pas committer** de secrets, clés API ou fichiers générés.

## Commandes utiles

```sh
opencode              # Lancer le TUI OpenCode
opencode run "..."    # Exécuter une requête en CLI
opencode --reload     # Recharger la config
```

## Documentation

Toute la documentation du projet vit dans `docs/`. Mettez-la à jour quand le
comportement du projet change.
