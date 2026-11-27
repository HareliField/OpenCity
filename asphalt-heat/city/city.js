const promptLink = document.getElementById('prompt-link');
const status = document.getElementById('prompt-status');
let prompt;

fetch(promptLink.href)
  .then(async response => {
    if (response.ok) prompt = await response.text();
  })
  .catch(() => {});

promptLink.addEventListener('click', async event => {
  if (!prompt || !navigator.clipboard || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();

  try {
    await navigator.clipboard.writeText(prompt);
    status.textContent = 'Copied. Paste it into your agent.';
  } catch {
    const link = document.createElement('a');
    link.href = promptLink.href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open the prompt to copy it.';
    status.replaceChildren(link);
  }
});
