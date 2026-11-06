import { playerUrl, showsFromResponse } from './mixes-model.mjs';
const feeds = [
  {id:'faves', url:new URL('../public/featured-mixes.json', import.meta.url), limit:12, empty:'Handpicked mixes are coming soon.'},
  {id:'latest', url:'https://api.mixcloud.com/djogvhs/cloudcasts/?limit=20', limit:6, empty:'No mixes published yet. Check back soon.'}
];
function card(show) {
  const article = document.createElement('article'); article.className = 'mix-card';
  const title = document.createElement('h3'); title.textContent = show.name;
  const byline = document.createElement('p'); byline.className = 'mix-byline';
  byline.textContent = show.user?.name || 'Mixcloud';
  const frame = document.createElement('iframe'); frame.src = playerUrl(show.key);
  frame.title = 'Play ' + show.name + ' on Mixcloud'; frame.loading = 'lazy';
  frame.allow = 'autoplay; encrypted-media'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
  const link = document.createElement('a'); link.className = 'mixcloud-link';
  link.href = 'https://www.mixcloud.com' + show.key; link.target = '_blank';
  link.rel = 'noopener noreferrer'; link.textContent = 'Listen on Mixcloud ↗';
  article.append(title,byline,frame,link); return article;
}
async function loadFeed(feed) {
  const status = document.getElementById(feed.id + '-status');
  const grid = document.getElementById(feed.id + '-mixes');
  grid.replaceChildren(); status.textContent = 'Loading mixes…';
  document.getElementById(feed.id + '-retry')?.remove();
  try {
    const response = await fetch(feed.url, {signal:AbortSignal.timeout(15000), cache:'no-store'});
    if (!response.ok) throw new Error('Mixcloud unavailable');
    const available = showsFromResponse(await response.json(), feed.id === 'latest' ? 20 : feed.limit);
    const shows = available.filter(show => feed.id !== 'latest' || show.key !== '/djogvhs/ghost-guts-ep/').slice(0, feed.limit);
    if (feed.id === 'faves' && shows.some(show => !show.key.startsWith('/djogvhs/'))) throw new Error('Featured mixes must belong to DJ OGVHS');
    grid.replaceChildren(...shows.map(card));
    status.textContent = shows.length ? '' : feed.empty;
  } catch {
    status.textContent = 'Mixcloud could not load right now. Try again or use the Mixcloud link below.';
    const retry = document.createElement('button'); retry.type = 'button';
    retry.id = feed.id + '-retry'; retry.className = 'mix-retry'; retry.textContent = 'Try again';
    retry.addEventListener('click',() => loadFeed(feed)); grid.after(retry);
  }
}
feeds.forEach(loadFeed);
