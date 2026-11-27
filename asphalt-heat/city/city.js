const promptLink = document.getElementById('prompt-link');
const status = document.getElementById('prompt-status');
let template;
const promptReady = fetch(promptLink.href)
  .then(async response => {
    if (response.ok) template = await response.text();
  })
  .catch(() => {});

function showStatus(message) {
  status.hidden = false;
  status.textContent = message;
}

document.getElementById('copy-starter').addEventListener('click', async () => {
  const readyToCopy = Boolean(template);
  if (!readyToCopy) await promptReady;
  if (!template) {
    showStatus('Open View prompt to copy it.');
    return;
  }

  if (readyToCopy && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(template);
      showStatus('Prompt copied. Paste it into your coding agent.');
      return;
    } catch {
      // The text remains available for manual copy.
    }
  }

  const field = document.createElement('textarea');
  field.value = template;
  field.readOnly = true;
  field.rows = 5;
  field.setAttribute('aria-label', 'Agent prompt to copy');
  showStatus('Select and copy the prompt for your coding agent.');
  status.append(field);
  field.focus();
  field.select();
});

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!motion.matches && 'IntersectionObserver' in window) {
  const previews = new Map();
  const startPreview = (video, restart = false) => {
    if (motion.matches || document.hidden || previews.get(video).pausedByUser) return;
    if (restart) video.load();
    video.play().catch(() => {});
  };

  const observer = new IntersectionObserver(entries => {
    for (const { target: video, intersectionRatio } of entries) {
      const state = previews.get(video);
      state.inView = intersectionRatio >= 0.4;
      if (state.inView && video.paused) startPreview(video);
    }
  }, { threshold: 0.4 });

  for (const video of document.querySelectorAll('.contribution-player video')) {
    const state = { inView: false, pausedByUser: false, lastInput: -Infinity };
    previews.set(video, state);
    const recordInput = () => { state.lastInput = performance.now(); };
    video.addEventListener('pointerdown', recordInput);
    video.addEventListener('keydown', recordInput);
    video.addEventListener('pause', () => {
      if (!document.hidden && performance.now() - state.lastInput < 500) state.pausedByUser = true;
    });
    video.addEventListener('play', () => { state.pausedByUser = false; });
    observer.observe(video);
  }

  const restoreVisiblePreviews = (restartAll = true) => {
    for (const [video, { inView }] of previews) {
      const needsRestart = restartAll || video.paused || video.currentTime >= video.duration;
      if (inView && needsRestart) startPreview(video, true);
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) restoreVisiblePreviews();
  });
  window.addEventListener('focus', () => restoreVisiblePreviews(false));
  window.addEventListener('pageshow', event => {
    if (event.persisted) restoreVisiblePreviews();
  });
}
