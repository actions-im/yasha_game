/**
 * Left-handed layout: arrows steer, click lasers, Space bombs,
 * Left Shift boost, Right Shift brake. WASD is never bound.
 * Regular arrows: left/right/up/down match the keys.
 */
export const BOUND_CODES = [
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Space", "ShiftLeft", "ShiftRight", "Escape", "Enter",
];
export const UNBOUND_WASD = ["KeyW", "KeyA", "KeyS", "KeyD"];

/** Map held key codes to steer axes. Never swap left/right. */
export function mapSteer(held) {
  return {
    left: held.has("ArrowLeft"),
    right: held.has("ArrowRight"),
    up: held.has("ArrowUp"),
    down: held.has("ArrowDown"),
  };
}

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let laserHeld = false;
  let focused = false;
  const mouse = {
    x: 0.5,
    y: 0.5,
    ndcX: 0,
    ndcY: 0,
    cssX: (typeof innerWidth === "number" ? innerWidth : 640) / 2,
    cssY: (typeof innerHeight === "number" ? innerHeight : 360) / 2,
  };

  function setMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    mouse.cssX = e.clientX - rect.left;
    mouse.cssY = e.clientY - rect.top;
    mouse.x = mouse.cssX / w;
    mouse.y = mouse.cssY / h;
    mouse.ndcX = mouse.x * 2 - 1;
    mouse.ndcY = 1 - mouse.y * 2;
  }

  function onKeyDown(e) {
    if (e.code !== "Escape" && e.target?.closest?.("button, input, select, textarea, [contenteditable]")) return;
    if (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter"].includes(e.code)) {
      e.preventDefault();
    }
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  }
  function onKeyUp(e) {
    down.delete(e.code);
  }
  function onBlur() {
    down.clear();
    pressed.clear();
    laserHeld = false;
    focused = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 0) {
      laserHeld = true;
      focused = true;
    }
    setMouse(e);
  });
  window.addEventListener("pointerup", (e) => {
    if (e.button === 0) laserHeld = false;
  });
  window.addEventListener("pointermove", setMouse);

  return {
    reset: onBlur,
    get laserHeld() {
      return laserHeld;
    },
    get focused() {
      return focused;
    },
    beginFrame() {
      const steer = mapSteer(down);
      const snap = {
        left: steer.left,
        right: steer.right,
        up: steer.up,
        down: steer.down,
        boost: down.has("ShiftLeft"),
        brake: down.has("ShiftRight"),
        reverse: down.has("Enter"),
        laserHeld,
        ndcX: mouse.ndcX,
        ndcY: mouse.ndcY,
        cssX: mouse.cssX,
        cssY: mouse.cssY,
        bomb: pressed.has("Space"),
        pause: pressed.has("Escape"),
        confirm: pressed.has("Enter"),
        wasd: down.has("KeyW") || down.has("KeyA") || down.has("KeyS") || down.has("KeyD"),
      };
      pressed.clear();
      return snap;
    },
    isCodeBound(code) {
      return BOUND_CODES.includes(code);
    },
  };
}
