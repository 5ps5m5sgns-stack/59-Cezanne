/* Page Logements, section « Le chantier » : lecture des vidéos hébergées sur le site.
   Sans JavaScript, chaque vidéo garde ses commandes natives ; avec JavaScript, un bouton « Lire » remplace les commandes jusqu'au premier clic.
   Une seule vidéo joue à la fois. */
(function () {
  'use strict';
  var figures = document.querySelectorAll('.ch-video');
  if (!figures.length) return;
  var videos = [];

  Array.prototype.forEach.call(figures, function (fig) {
    var video = fig.querySelector('video');
    var play = fig.querySelector('.ch-play');
    if (!video || !play) return;
    videos.push(video);

    // L'image d'aperçu n'est chargée qu'à l'approche de la vidéo, pour ne pas ralentir le haut de la page.
    var poster = video.getAttribute('data-poster');
    function loadPoster() { if (poster) { video.poster = poster; poster = null; } }
    if ('IntersectionObserver' in window) {
      var po = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { loadPoster(); po.disconnect(); }
      }, { rootMargin: '600px 0px' });
      po.observe(video);
    } else { loadPoster(); }

    function idle() { video.controls = false; play.hidden = false; }
    idle();

    play.addEventListener('click', function () {
      videos.forEach(function (v) { if (v !== video && !v.paused) v.pause(); });
      video.controls = true;
      play.hidden = true;
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(idle);
    });
    video.addEventListener('play', function () {
      videos.forEach(function (v) { if (v !== video && !v.paused) v.pause(); });
    });
    video.addEventListener('ended', function () { video.currentTime = 0; idle(); });
  });
})();
