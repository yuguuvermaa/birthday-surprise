/**
 * BIRTHDAY SURPRISE — script.js
 * Cinematic scroll experience controller
 *
 * Responsibilities:
 *  1. Gate canvas particle animation (idle screen)
 *  2. "Start the Experience" button — unlock scroll + start music
 *  3. Section IntersectionObserver — reveal animations + music crossfade
 *  4. Nav dots + progress bar sync
 *  5. Section 1 floating particle canvas
 *  6. Section 5 confetti burst
 */

'use strict';

/* ═══════════════════════════════════════════════════
   CONSTANTS & STATE
═══════════════════════════════════════════════════ */
const FADE_DURATION = 1500; // ms for audio crossfade
const MUSIC_VOLUME  = 0.55; // master volume (0–1)

const state = {
  started:        false,
  currentAudioId: null,  // id string of the currently playing <audio>
  confettiFired:  false,
};

/* ═══════════════════════════════════════════════════
   DOM REFERENCES
═══════════════════════════════════════════════════ */
const gate            = document.getElementById('gate');
const startBtn        = document.getElementById('startBtn');
const scrollContainer = document.getElementById('scrollContainer');
const progressBar     = document.getElementById('progressBar');
const dots            = document.querySelectorAll('.dot');
const scenes          = document.querySelectorAll('.scene');

/* ═══════════════════════════════════════════════════
   1. GATE CANVAS — star / particle field
═══════════════════════════════════════════════════ */
(function initGateCanvas() {
  const canvas = document.getElementById('gateCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId;
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildParticles();
  }

  function buildParticles() {
    const count = Math.floor((W * H) / 7000);
    particles = Array.from({ length: count }, () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    Math.random() * 1.2 + 0.2,
      a:    Math.random(),         // current alpha
      da:   (Math.random() * 0.004 + 0.001) * (Math.random() < 0.5 ? 1 : -1),
      vx:   (Math.random() - 0.5) * 0.15,
      vy:   (Math.random() - 0.5) * 0.15,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      // Drift
      p.x += p.vx;
      p.y += p.vy;
      // Wrap
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      // Breathe
      p.a += p.da;
      if (p.a > 1 || p.a < 0) p.da *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 169, 110, ${p.a * 0.7})`;
      ctx.fill();
    }
    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();

  // Expose cleanup
  window._stopGateCanvas = () => {
    cancelAnimationFrame(animId);
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 1.4s';
  };
})();

/* ═══════════════════════════════════════════════════
   2. START BUTTON — unlock experience
═══════════════════════════════════════════════════ */
startBtn.addEventListener('click', () => {
  if (state.started) return;
  state.started = true;

  // Dismiss gate
  gate.classList.add('hidden');
  if (window._stopGateCanvas) window._stopGateCanvas();

  // Unlock scroll
  scrollContainer.classList.remove('locked');

  // Start section 1 music
  const firstScene = scenes[0];
  if (firstScene) {
    playSceneAudio(firstScene.dataset.song);
  }

  // Init particle canvas for scene 1
  initParticleCanvas();

  // Init confetti for scene 5
  initConfetti();
});

/* ═══════════════════════════════════════════════════
   3. AUDIO — smooth crossfade between sections
═══════════════════════════════════════════════════ */

/**
 * Fade an audio element in or out.
 * @param {HTMLAudioElement} el
 * @param {number}           targetVol  0 or MUSIC_VOLUME
 * @param {number}           duration   ms
 * @param {Function}         [onDone]
 */
function fadeAudio(el, targetVol, duration, onDone) {
  if (!el) { onDone && onDone(); return; }

  const steps     = 30;
  const interval  = duration / steps;
  const startVol  = el.volume;
  const delta     = (targetVol - startVol) / steps;
  let   step      = 0;

  const timer = setInterval(() => {
    step++;
    el.volume = Math.min(1, Math.max(0, startVol + delta * step));
    if (step >= steps) {
      clearInterval(timer);
      el.volume = targetVol;
      if (targetVol === 0) { el.pause(); el.currentTime = 0; }
      onDone && onDone();
    }
  }, interval);
}

/**
 * Crossfade to a new audio element.
 * @param {string} newAudioId   e.g. "audio2"
 */
function playSceneAudio(newAudioId) {
  if (!newAudioId || newAudioId === state.currentAudioId) return;

  const outEl = state.currentAudioId
    ? document.getElementById(state.currentAudioId)
    : null;

  const inEl = document.getElementById(newAudioId);
  if (!inEl) return;

  // Fade out previous
  if (outEl) {
    fadeAudio(outEl, 0, FADE_DURATION);
  }

  // Fade in new
  inEl.volume = 0;
  inEl.play().catch(() => {
    // Browser may block autoplay — user has already interacted so this should work
    console.warn('Audio play blocked:', newAudioId);
  });
  fadeAudio(inEl, MUSIC_VOLUME, FADE_DURATION);

  state.currentAudioId = newAudioId;
}

/* ═══════════════════════════════════════════════════
   4. INTERSECTION OBSERVER — section visibility
═══════════════════════════════════════════════════ */
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const scene = entry.target;

        // ── Reveal animation
        scene.classList.add('in-view');

        // ── Update nav dots
        const idx = parseInt(scene.dataset.index, 10);
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));

        // ── Update progress bar
        progressBar.style.width = `${((idx + 1) / scenes.length) * 100}%`;

        // ── Music crossfade (only after experience started)
        if (state.started && scene.dataset.song) {
          playSceneAudio(scene.dataset.song);
        }

        // ── Confetti trigger on section 5
        if (idx === 4 && state.started && !state.confettiFired) {
          state.confettiFired = true;
          burstConfetti();
        }
      }
    });
  },
  {
    root:      scrollContainer,
    threshold: 0.6,  // 60% visible = "in view"
  }
);

scenes.forEach((scene) => sectionObserver.observe(scene));

/* ═══════════════════════════════════════════════════
   5. NAV DOTS — click to scroll
═══════════════════════════════════════════════════ */
dots.forEach((dot) => {
  dot.addEventListener('click', () => {
    if (!state.started) return;
    const targetIdx = parseInt(dot.dataset.target, 10);
    const targetScene = scenes[targetIdx];
    if (targetScene) {
      targetScene.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* ═══════════════════════════════════════════════════
   6. SECTION 1 — FLOATING PARTICLE CANVAS
═══════════════════════════════════════════════════ */
function initParticleCanvas() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const scene = document.getElementById('scene1');
  let W, H, particles = [], animId;

  function resize() {
    W = canvas.width  = scene.offsetWidth;
    H = canvas.height = scene.offsetHeight;
  }

  const PARTICLE_COUNT = 60;

  function createParticle() {
    return {
      x:     Math.random() * W,
      y:     H + Math.random() * 20,
      r:     Math.random() * 2 + 0.5,
      speed: Math.random() * 0.5 + 0.15,
      drift: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      hue:   Math.random() < 0.5 ? '201, 169, 110' : '200, 150, 160',
    };
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);

    // Spawn new
    while (particles.length < PARTICLE_COUNT) {
      particles.push(createParticle());
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.y    -= p.speed;
      p.x    += p.drift;
      p.alpha -= 0.0008;

      if (p.y < -10 || p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue}, ${p.alpha})`;
      ctx.fill();
    }

    animId = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();
}

/* ═══════════════════════════════════════════════════
   7. SECTION 5 — CONFETTI BURST
═══════════════════════════════════════════════════ */
let confettiParticles = [];
let confettiAnimId;

function initConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas._ctx = canvas.getContext('2d');

  window.addEventListener('resize', () => {
    canvas.width  = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  });

  canvas.width  = canvas.parentElement.offsetWidth;
  canvas.height = canvas.parentElement.offsetHeight;
}

function burstConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas || !canvas._ctx) return;

  const ctx = canvas._ctx;
  const W   = canvas.width;
  const H   = canvas.height;

  const COLORS = [
    '#c9a96e', '#e8d5b0', '#c97d87', '#e8b4b8',
    '#b5a4d4', '#f5ede0', '#ffcba4', '#fffacd',
  ];

  const SHAPES = ['circle', 'rect', 'line'];

  confettiParticles = Array.from({ length: 120 }, () => ({
    x:     W / 2 + (Math.random() - 0.5) * 100,
    y:     H / 2 + (Math.random() - 0.5) * 60,
    vx:    (Math.random() - 0.5) * 8,
    vy:    Math.random() * -10 - 3,
    r:     Math.random() * 5 + 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    rot:   Math.random() * Math.PI * 2,
    rotV:  (Math.random() - 0.5) * 0.15,
    alpha: 1,
    decay: Math.random() * 0.006 + 0.003,
    gravity: 0.18,
  }));

  cancelAnimationFrame(confettiAnimId);
  drawConfetti(ctx, W, H);
}

function drawConfetti(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);

  let alive = false;
  for (const p of confettiParticles) {
    if (p.alpha <= 0) continue;
    alive = true;

    p.vy    += p.gravity;
    p.x     += p.vx;
    p.y     += p.vy;
    p.rot   += p.rotV;
    p.alpha -= p.decay;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;

    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'rect') {
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    } else {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-p.r * 1.5, 0);
      ctx.lineTo(p.r * 1.5, 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  if (alive) {
    confettiAnimId = requestAnimationFrame(() => drawConfetti(ctx, W, H));
  } else {
    ctx.clearRect(0, 0, W, H);
  }
}

/* ═══════════════════════════════════════════════════
   8. SCROLL PROGRESS SYNC (fallback for scrollbar)
═══════════════════════════════════════════════════ */
scrollContainer.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
  const pct = scrollTop / (scrollHeight - clientHeight);
  progressBar.style.width = `${pct * 100}%`;
}, { passive: true });

/* ═══════════════════════════════════════════════════
   9. KEYBOARD NAVIGATION
═══════════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
  if (!state.started) return;

  const activeDot  = document.querySelector('.dot.active');
  const activeIdx  = activeDot ? parseInt(activeDot.dataset.target, 10) : 0;

  if (e.key === 'ArrowDown' || e.key === 'PageDown') {
    e.preventDefault();
    const next = Math.min(activeIdx + 1, scenes.length - 1);
    scenes[next].scrollIntoView({ behavior: 'smooth' });
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault();
    const prev = Math.max(activeIdx - 1, 0);
    scenes[prev].scrollIntoView({ behavior: 'smooth' });
  }
});

/* ═══════════════════════════════════════════════════
   INIT — mark first section visible on load
═══════════════════════════════════════════════════ */
// Gate stays visible; we manually add in-view to scene 1 so its
// animations are pre-armed and ready when gate dismisses.
if (scenes[0]) {
  scenes[0].classList.add('in-view');
}
