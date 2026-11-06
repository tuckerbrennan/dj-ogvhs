const status = document.getElementById('hot-status');
const grid = document.getElementById('hot-mixes');
async function load() {
  try {
    const response = await fetch(new URL('../public/drive-mixes.json', import.meta.url), {cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Unavailable');
    const {mixes} = await response.json();
    if (!Array.isArray(mixes)) throw new Error('Invalid list');
    const cards = mixes.map(mix => {
      const url = new URL(mix.url);
      if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password || typeof mix.title !== 'string') throw new Error('Invalid Drive mix');
      const card = document.createElement('article'); card.className = 'mix-card';
      const heading = document.createElement('h3'); heading.textContent = mix.title;
      const link = document.createElement('a'); link.className = 'mixcloud-link';
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = '▶ Play on Google Drive';
      card.append(heading,link); return card;
    });
    grid.replaceChildren(...cards);
    status.textContent = cards.length ? '' : 'Mixes coming soon.';
  } catch {
    status.textContent = 'These mixes could not load right now.';
    const retry = document.createElement('button'); retry.className = 'mix-retry'; retry.type = 'button'; retry.textContent = 'Try again';
    retry.addEventListener('click', () => {retry.remove(); load();});
    grid.after(retry);
  }
}
load();
