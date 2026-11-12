// Only Google Drive audio file IDs are embedded. No arbitrary iframe URLs.
const DRIVE_ID = /^[a-zA-Z0-9_-]{10,128}$/;
export function parseDriveId(value) {
  if (typeof value !== 'string') return null;
  if (DRIVE_ID.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password) return null;
    const match = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]{10,128})(?:\/.*)?$/);
    const id = match?.[1] || (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : null);
    return DRIVE_ID.test(id || '') ? id : null;
  } catch { return null; }
}
export function drivePreviewUrl(id) {
  if (!DRIVE_ID.test(id || '')) throw new Error('Invalid Drive file ID');
  return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview';
}
export function driveOpenUrl(id) {
  if (!DRIVE_ID.test(id || '')) throw new Error('Invalid Drive file ID');
  return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view';
}
export function normalizeMix(item) {
  if (!item || typeof item !== 'object' || typeof item.title !== 'string') return null;
  const title = item.title.trim();
  const id = parseDriveId(item.drive_file_id || item.driveFileId || item.url);
  if (!title || title.length > 160 || !id) return null;
  const description = typeof item.description === 'string' ? item.description.trim().slice(0,600) : '';
  return {title,id,description};
}
