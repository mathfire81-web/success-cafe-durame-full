/*
  MOMENTS VIDEO STRIP CONTROLLER
  The homepage "Moments At Success Cafe" section autoplays a row of
  short, silent, looping clips (muted/loop/playsinline already handles
  the actual autoplay - no click needed). This just pauses whichever
  clips scroll out of view so the browser isn't decoding six videos at
  once when only a couple are visible, and resumes them when they
  scroll back in.
*/

document.addEventListener("DOMContentLoaded", function () {
  var videos = document.querySelectorAll(".moment-video video");
  if (!videos.length) return;

  if (typeof IntersectionObserver === "undefined") return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(function () {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.25 });

  videos.forEach(function (video) { observer.observe(video); });
});
