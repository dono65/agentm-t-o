# OpenCode dans ce dépôt

Comment utiliser et étendre OpenCode dans ce projet.

## Fichiers

- `opencode.json` : configuration du projet (modèle, permissions, agents,
  formatter, etc.).
- `AGENTS.md` : instructions générales données à tous les agents.
- `.opencode/agent/` : agents personnalisés (Markdown avec frontmatter).
- `.opencode/command/` : commandes slash personnalisées.
- `.opencode/skill/` : skills (un répertoire par skill avec un `SKILL.md`).

## Utilisation

```sh
opencode                 # lancer le TUI
opencode run "question"  # one-shot en CLI
```

Dans le TUI : `/reload` pour recharger la configuration, `/agents` pour voir
les agents, `/help` pour l'aide.

## Références

- Docs officielles : <https://opencode.ai/docs/>
- Schéma de config : <https://opencode.ai/config.json>
