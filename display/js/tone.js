/* النغمة القصيرة عند دخول وقت الصلاة (WebAudio). */
(function () {
  'use strict';
  var audioCtx = null;

  MD.playTone = function () {
    var cfg = MD.cfg;
    if (!cfg.tone || !cfg.tone.enabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var dur = Math.min(2, Math.max(0.5, cfg.tone.durationSec || 1.5));
      var vol = cfg.tone.volume != null ? cfg.tone.volume : 0.7;
      [0, 0.25].forEach(function (offset) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + offset);
        g.gain.exponentialRampToValueAtTime(vol, audioCtx.currentTime + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + dur / 2);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + offset); o.stop(audioCtx.currentTime + offset + dur / 2);
      });
    } catch (e) { /* الصوت غير متاح */ }
  };
})();
