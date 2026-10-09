/* Page Logements, section « Le chantier » : lecture de la vidéo hébergée sur le site.
   Sans JavaScript, la vidéo garde ses commandes natives ; avec JavaScript, un bouton « Lire » remplace les commandes jusqu'au premier clic. */
(function () {
  'use strict';
  var video = document.querySelector('.ch-video video');
  var play = document.querySelector('.ch-play');
  if (!video || !play) return;

  function idle() { video.controls = false; play.hidden = false; }
  idle();

  play.addEventListener('click', function () {
    video.controls = true;
    play.hidden = true;
    var p = video.play();
    if (p && typeof p.catch === 'function') p.catch(idle);
  });
  video.addEventListener('ended', function () { video.currentTime = 0; idle(); });
})();
