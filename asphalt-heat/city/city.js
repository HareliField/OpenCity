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
