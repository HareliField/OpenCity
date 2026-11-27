import { examples, makeDraft } from './examples.js';

const byId = id => document.getElementById(id);
const form = byId('proposal');
const idea = byId('idea');
const picker = byId('example');
const details = byId('details');
const notice = byId('notice');
const scene = document.querySelector('.scene');
const stepButtons = [...document.querySelectorAll('#steps button')];
const exampleButtons = [...document.querySelectorAll('[data-example]')];
const replay = byId('replay');

const outcomes = {
  standard: ['Approved in demo', 'The sample clears the city rules and is eligible for the next release.'],
  maintainer: ['Needs maintainer review', 'The proposal stays in review until a maintainer approves the preview.'],
  declined: ['Declined under city rules', 'Revise the idea and run it through the review again.'],
  custom: ['Ready to hand off', 'Copy the draft to your agent to generate the proposed changes and a reviewable preview.']
};

let key = 'shop';
let draft;
let step = 0;
let furthest = 0;
let loop;
let beforeLoop;
let loopPublished = false;
const released = new Map();

function node(tag, value, className) {
  const result = document.createElement(tag);
  result.textContent = value;
  if (className) result.className = className;
  return result;
}

function announce(message = '') {
  notice.hidden = !message;
  notice.textContent = message;
}

function chooseExample(nextKey) {
  key = nextKey;
  idea.value = examples[key].prompt;
  picker.value = '';
  exampleButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.example === key)));
  invalidateDraft();
  showStep(0);
}

function invalidateDraft() {
  draft = undefined;
  furthest = 0;
  idea.setCustomValidity('');
}

function action(label, run, emphasis = 'primary') {
  const button = node('button', label, 'button ' + emphasis);
  button.type = 'button';
  button.addEventListener('click', () => {
    stopLoop();
    run();
  });
  return button;
}

function showStep(index, focus = false) {
  step = index;
  furthest = Math.max(furthest, step);
  announce();
  form.hidden = step !== 0;
  details.hidden = step === 0;
  stepButtons.forEach((button, i) => {
    button.disabled = i > furthest;
    if (i === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  const selected = draft ?? examples[key];
  scene.dataset.image = selected.image;
  byId('location').textContent = selected.location;
  byId('scene-state').textContent = step === 0 ? 'Concept art' : 'Illustrative preview';
  if (step === 0) {
    if (focus) idea.focus();
    return;
  }

  details.replaceChildren();
  const heading = node('h3', selected.title, 'panel-heading');
  heading.tabIndex = -1;
  details.append(heading);
  const actions = node('div', '', 'actions');
  if (step === 1) {
    const plan = node('ul', '', 'check-list');
    for (const item of draft.plan) plan.append(node('li', item));
    details.append(node('p', draft.prompt, 'summary'), plan);
    if (draft.action) {
      const tryIt = action(draft.action, () => {
        if (tryIt.textContent === draft.action) {
          announce(draft.response);
          tryIt.textContent = 'Eat noodles';
        } else {
          announce('You ate the bowl of noodles. The shopkeeper clears the counter.');
          tryIt.textContent = draft.action;
        }
      }, 'outline');
      actions.append(tryIt);
    }
    actions.append(action('Send to demo review →', () => showStep(2, true)));
  } else if (step === 2) {
    const [result, next] = outcomes[draft.lane];
    details.append(
      node('p', result, 'result-label'),
      node('p', draft.check),
      node('p', draft.evidence, 'summary'),
      node('p', next, 'summary')
    );
    if (draft.lane === 'standard') actions.append(action('View release →', () => showStep(3, true)));
    if (draft.lane === 'maintainer') actions.append(action('See release status →', () => showStep(3, true)));
    if (draft.lane === 'custom') actions.append(action('Copy for my agent', copyDraft));
    actions.append(action('Revise proposal', () => showStep(0, true), 'quiet'));
  } else {
    const published = loop === undefined ? released.has(draft.key) : loopPublished;
    const ready = draft.lane === 'standard';
    const label = published ? 'Published in demo' : ready ? 'Queued for demo release' : 'Held for maintainer review';
    const explanation = published
      ? 'The change appears in the sample city release log.'
      : ready
        ? 'The production flow would merge the approved GitHub pull request, build the city, and run a smoke test before publishing.'
        : 'This change stays out of the release queue until a maintainer approves it.';
    details.append(node('p', label, 'result-label'), node('p', explanation, 'summary'));
    if (ready && !published) actions.append(action('Run demo release →', () => publish(true)));
    actions.append(action('Pick another example', () => showStep(0, true), 'quiet'));
  }
  details.append(actions);
  if (focus) heading.focus();
}

function publish(focus = false) {
  if (draft?.lane !== 'standard') return;
  if (loop === undefined) released.set(draft.key, draft.title);
  else loopPublished = true;
  updateReleaseLog();
  showStep(3, focus);
}

function handoffText() {
  const current = makeDraft(key, idea.value.trim());
  return [
    'Asphalt Heat city contribution draft',
    'Repository: https://github.com/HareliField/asphalt-heat',
    'Example location (confirm against the game): ' + current.location,
    'Request: ' + current.prompt,
    'Prepare a scoped patch, playable preview, test evidence and asset sources. Keep the street grid and setting intact. Route shared system and release changes to a maintainer. Leave publication to the project reviewer.'
  ].join('\n');
}

async function copyDraft() {
  if (!idea.value.trim()) {
    announce('Enter a city idea before copying a draft.');
    idea.focus();
    return;
  }
  const handoff = handoffText();
  try {
    await navigator.clipboard.writeText(handoff);
    announce('Draft copied. Paste it into your own agent.');
  } catch {
    const field = node('textarea', handoff);
    field.readOnly = true;
    field.setAttribute('aria-label', 'Draft to copy');
    field.rows = 5;
    announce('Select and copy the draft for your agent.');
    notice.append(field);
    field.focus();
    field.select();
  }
}

function updateReleaseLog() {
  const titles = new Set(released.values());
  if (loopPublished) titles.add(examples.shop.title);
  byId('release-log').textContent = titles.size
    ? 'Published in this demo · ' + [...titles].join(' · ')
    : 'Run the demo release to see the sample change log.';
}

function stopLoop(restore = false) {
  if (loop === undefined) return;
  clearInterval(loop);
  loop = undefined;
  loopPublished = false;
  updateReleaseLog();
  if (restore) {
    chooseExample(beforeLoop.key);
    idea.value = beforeLoop.prompt;
    draft = beforeLoop.draft;
    furthest = beforeLoop.furthest;
    showStep(beforeLoop.step);
  }
  beforeLoop = undefined;
  replay.setAttribute('aria-pressed', 'false');
  replay.lastChild.textContent = ' Loop demo';
}

function tickLoop() {
  if (step === 0) {
    draft = makeDraft('shop', examples.shop.prompt);
    showStep(1);
  } else if (step < 3) {
    showStep(step + 1);
  } else if (!loopPublished) {
    publish();
  } else {
    loopPublished = false;
    updateReleaseLog();
    chooseExample('shop');
  }
}

for (const [id, example] of Object.entries(examples)) {
  if (!exampleButtons.some(button => button.dataset.example === id)) picker.add(new Option(example.label, id));
}
picker.addEventListener('change', () => {
  stopLoop();
  chooseExample(picker.value);
});
for (const button of exampleButtons) button.addEventListener('click', () => {
  stopLoop();
  chooseExample(button.dataset.example);
});
for (const [index, button] of stepButtons.entries()) button.addEventListener('click', () => {
  stopLoop();
  showStep(index, true);
});
idea.addEventListener('input', () => {
  stopLoop();
  invalidateDraft();
  showStep(0);
});
form.addEventListener('submit', event => {
  event.preventDefault();
  stopLoop();
  const prompt = idea.value.trim();
  if (!prompt) {
    idea.setCustomValidity('Describe the change you want to make.');
    idea.reportValidity();
    return;
  }
  draft = makeDraft(key, prompt);
  showStep(1, true);
});
byId('copy').addEventListener('click', () => {
  stopLoop();
  copyDraft();
});
replay.addEventListener('click', () => {
  if (loop !== undefined) {
    stopLoop(true);
    return;
  }
  beforeLoop = { key, prompt: idea.value, draft, furthest, step };
  chooseExample('shop');
  document.querySelector('#steps').scrollIntoView({ block: 'nearest' });
  replay.setAttribute('aria-pressed', 'true');
  replay.lastChild.textContent = ' Stop loop';
  loop = setInterval(tickLoop, 3000);
});
chooseExample('shop');
