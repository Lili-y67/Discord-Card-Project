# Audit de tri du projet

## Suppression probablement sûre

- `test.txt` et `test2.txt` : fichiers de test non référencés.
- `functions/embedAvatar.js` : aucun import actif après l’intégration directe des avatars dans les rendus.
- `newPlayerUpdateDB.js` : ancien wrapper qui ne fait qu’importer `syncGuildPlayers.js`; les scripts actuels utilisent directement `syncGuildPlayers.js`.
- `lookForButtonsInButtonGroup` dans `functions/buttonCenter.js` : fonction privée jamais appelée. Sa boucle contient aussi une condition erronée (`keyIndex.length`).
- `isStringAnHexadecimalColorCode` dans `functions/utilsFunctions.js` : export jamais consommé.

## À vérifier avant suppression

- `deploy.js` : simple wrapper de `deploy-commands.js`, mais il est documenté dans le README et peut être lancé manuellement.
- `buttonCenter.js` et `utilsFunctions.js` : code ancien, mais encore utilisé par `/blitzers`, `/sell`, `/discard`, `/rankup` et `/trade`; ne pas supprimer les fichiers entiers.
- Plusieurs anciennes fonctions basées sur les embeds restent nécessaires aux commandes qui n’ont pas encore migré vers Components V2.

## Configuration cassée ou incomplète

- Le script npm `start:vps` vise `vps-start.js`, absent du dépôt. Il faut soit ajouter ce fichier spécifique au serveur, soit retirer le script.

## Correctif appliqué pendant l’audit

- `makePickFor` utilisait une variable `user` inexistante lors de la création de l’embed. La commande admin `/pickfor` pouvait donc échouer après un tirage réussi; elle récupère maintenant correctement l’utilisateur Discord ciblé.
