// Point d'entrée Passenger stable, à copier dans ~/azmg-sourcing/app/app.js (racine de l'application cPanel).
// cPanel enregistre le chemin réel de la racine et non le lien « current » : cette racine fixe charge donc
// la version pointée par « current » à chaque démarrage. auto-deploy.sh redémarre via app/tmp/restart.txt.
require(require('node:path').join(__dirname, '..', 'current', 'app.js'));
