import { C } from "./constants.js";
import { hpColor } from "./ship.js";

export function bindUI() {
  const map = document.getElementById("map");
  const pause = document.getElementById("pause");
  const result = document.getElementById("result");
  const banner = document.getElementById("banner");
  const hpFill = document.getElementById("hp-fill");
  const hpTrack = document.getElementById("hp-track");
  const bombs = document.getElementById("bombs");
  const score = document.getElementById("score");
  const etime = document.getElementById("etime");
  const hud = document.getElementById("hud");
  const hint = document.getElementById("hint");
  const vignette = document.getElementById("vignette");
  const resultTitle = document.getElementById("result-title");
  const resultSub = document.getElementById("result-sub");
  const reticle = document.getElementById("reticle");

  let feedbackUntil = 0;
  function setBombs(n) {
    const icons = bombs.querySelectorAll(".bomb");
    icons.forEach((el, i) => {
      el.classList.toggle("empty", i >= n);
    });
  }

  return {
    setGuidance(direction, arena) {
      const arrow = document.getElementById("boss-direction");
      arrow.classList.toggle("hidden", !direction);
      document.getElementById("flight-help").classList.toggle("hidden", !arena);
      if (direction) {
        arrow.style.left = direction.x + "px";
        arrow.style.top = direction.y + "px";
        arrow.querySelector("span").style.transform = `rotate(${direction.angle}rad)`;
        arrow.querySelector("small").textContent = direction.behind ? "BOSS · TURN" : "BOSS";
      }
    },
    feedback(text, kill = false) {
      const el = document.getElementById("combat-feedback");
      if (!kill && performance.now() < feedbackUntil) return;
      feedbackUntil = performance.now() + (kill ? 600 : 120);
      el.textContent = text;
      el.classList.toggle("kill", kill);
      el.classList.remove("hidden");
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.add("hidden"), kill ? 700 : 200);
    },
    clearFeedback() {
      const el = document.getElementById("combat-feedback");
      clearTimeout(el._t);
      el.classList.add("hidden");
      feedbackUntil = 0;
    },
    showMap(on) {
      map.classList.toggle("hidden", !on);
    },
    showHud(on) {
      hud.classList.toggle("hidden", !on);
      hint.classList.toggle("hidden", !on);
      document.body.classList.toggle("playing", on);
      if (!on) reticle?.classList.add("hidden");
    },
    setReticle(cssX, cssY, on) {
      if (!reticle) return;
      if (!on) {
        reticle.classList.add("hidden");
        return;
      }
      reticle.classList.remove("hidden");
      reticle.style.transform = `translate(${cssX}px, ${cssY}px)`;
    },
    setHp(hp) {
      if (!hpFill || !hpTrack) return;
      const pct = Math.max(0, Math.min(100, hp));
      hpFill.style.width = pct + "%";
      hpTrack.classList.remove("ok", "mid", "low");
      hpTrack.classList.add(hpColor(hp));
      vignette?.classList.toggle("on", hp <= C.HP_MAX * 0.25 && hp > 0);
    },
    setBombs,
    setScore(n) {
      if (score) score.textContent = String(n).padStart(6, "0");
    },
    setFps(n) {
      const el = document.getElementById("fps");
      if (el) el.textContent = n + " FPS";
    },
    setBossHp(cur, max) {
      const wrap = document.getElementById("boss-hud");
      const fill = document.getElementById("boss-fill");
      if (!wrap) return;
      if (max == null || max <= 0) {
        wrap.classList.add("hidden");
        return;
      }
      wrap.classList.remove("hidden");
      if (fill) {
        const pct = Math.max(0, Math.min(100, (cur / max) * 100));
        fill.style.width = pct + "%";
      }
    },
    setRailClock(secLeft, arena) {
      if (!etime) return;
      if (arena) {
        etime.textContent = "ARENA";
        return;
      }
      const s = Math.max(0, Math.ceil(secLeft));
      const m = Math.floor(s / 60);
      const r = s % 60;
      etime.textContent = "RAIL " + m + ":" + String(r).padStart(2, "0");
    },
    banner(text, ms = 1800) {
      clearTimeout(banner._t);
      if (!text) {
        banner.classList.add("hidden");
        banner.textContent = "";
        return;
      }
      banner.textContent = text;
      banner.classList.remove("hidden");
      banner._t = setTimeout(() => banner.classList.add("hidden"), ms);
    },
    showPause(on) {
      pause.classList.toggle("hidden", !on);
      document.body.classList.toggle("paused", on);
      if (on) document.getElementById("btn-resume").focus();
    },
    showResult(kind, sc, checkpoint = false) {
      document.body.classList.remove("playing");
      document.getElementById("btn-checkpoint").classList.toggle("hidden", !checkpoint);
      result.classList.remove("hidden");
      document.getElementById(checkpoint ? "btn-checkpoint" : "btn-retry").focus();
      if (kind === "clear") {
        resultTitle.textContent = "STAGE CLEAR";
        resultSub.textContent = "Score " + sc;
      } else {
        resultTitle.textContent = "SHIP DOWN";
        resultSub.textContent = "Score " + sc;
      }
    },
    hideResult() {
      result.classList.add("hidden");
    },
    initBombs() {
      bombs.innerHTML = "";
      for (let i = 0; i < C.BOMBS_MAX; i++) {
        const d = document.createElement("div");
        d.className = "bomb";
        bombs.appendChild(d);
      }
    },
  };
}
