// ==================== SOUND (WebAudio, synthesized) ====================
// The original JAR ships 3 Nokia OTT tones (pickup/pop/up). Chromium on
// Cloud Phone blocks audio until a user gesture, so the context is created
// lazily on first key press (see input.js). Sound is purely cosmetic — never gameplay.
var audioCtx = null,
    muted = false;
function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext ||
                window.webkitAudioContext)();
        } catch (e) {
            audioCtx = null;
        }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
// tone(s): array of [freq, startOffset, duration, optEndFreq] using a shared envelope
function tone(type, vol, parts) {
    if (!audioCtx || muted) return;
    var t0 = audioCtx.currentTime;
    parts.forEach(function (p) {
        var o = audioCtx.createOscillator(),
            g = audioCtx.createGain(),
            t = t0 + p[1];
        o.type = type;
        o.frequency.setValueAtTime(p[0], t);
        if (p[3]) o.frequency.exponentialRampToValueAtTime(p[3], t + p[2]);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(t);
        o.stop(t + p[2] + 0.02);
    });
}
function sndJump()   { tone("square",   0.06, [[300, 0, 0.12, 600]]); }
function sndBounce() { tone("square",   0.05, [[440, 0, 0.07]]); }
function sndPickup() { tone("sine",     0.08, [[880, 0, 0.07], [1320, 0.06, 0.14]]); }
function sndDie()    { tone("sawtooth", 0.10, [[400, 0, 0.4, 80]]); }
function sndLevel()  { tone("square",   0.07, [[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1047, 0.27, 0.16]]); }
