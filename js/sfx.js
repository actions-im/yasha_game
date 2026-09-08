let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep(freq, dur, type, gain, slide) {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
    g.gain.value = gain ?? 0.04;
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  laser() { beep(880, 0.06, "square", 0.03, 420); },
  bomb() { beep(180, 0.35, "sawtooth", 0.06, 40); },
  hit() { beep(220, 0.08, "square", 0.05); },
  explode() { beep(90, 0.4, "sawtooth", 0.07, 30); },
  ring() { beep(660, 0.12, "sine", 0.04, 990); },
  damage() { beep(140, 0.18, "triangle", 0.06, 60); },
  boss() { beep(200, 0.5, "square", 0.05, 80); },
  win() { beep(440, 0.2, "square", 0.05, 880); },
};
