---
description: Génère un message de commit à partir des changements en cours
agent: build
---

 Analyse les changements en attente (git status + git diff) puis propose un
message de commit au format Conventional Commits (`type: résumé court`).
N'exécute pas le commit sans confirmation.
