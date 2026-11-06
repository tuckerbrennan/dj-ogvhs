export function mixcloudKey(value) {
  if (typeof value !== 'string' || !/^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/$/.test(value)) return null;
  return value;
}
export function playerUrl(key) {
  if (!mixcloudKey(key)) throw new Error('Invalid Mixcloud show key');
  const url = new URL('https://www.mixcloud.com/widget/iframe/');
  url.search = new URLSearchParams({feed:key, hide_cover:'1', light:'0', autoplay:'0'}).toString();
  return url.href;
}
export function showsFromResponse(payload, limit) {
  if (!Array.isArray(payload?.data)) throw new Error('Invalid Mixcloud response');
  return payload.data.filter(show => mixcloudKey(show.key) && typeof show.name === 'string').slice(0,limit);
}
