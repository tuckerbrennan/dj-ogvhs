export function validatedPaymentUrl(raw, allowedHostnames) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !allowedHostnames.includes(url.hostname.toLowerCase()) || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}
export function paymentOptions(config = {}) {
  const text = value => typeof value === 'string' && value.trim().length <= 120 ? value.trim() : '';
  const email = text(config.paypalRecipient);
  const paypalRecipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  const venmo = validatedPaymentUrl(config.venmoUrl, ['venmo.com','www.venmo.com','account.venmo.com']);
  const cash = validatedPaymentUrl(config.cashAppUrl, ['cash.app','www.cash.app']);
  return [
    { label:'Venmo', url:venmo, detail:venmo ? '@'+new URL(venmo).pathname.split('/').filter(Boolean).at(-1) : '' },
    { label:'Zelle', recipient:text(config.zelleRecipient), detail:text(config.zelleRecipient) },
    { label:'PayPal', url:validatedPaymentUrl(config.paypalUrl, ['paypal.me','www.paypal.me','paypal.com','www.paypal.com']), recipient:paypalRecipient, detail:paypalRecipient },
    { label:'Cash App', url:cash, detail:cash ? new URL(cash).pathname.split('/').filter(Boolean).at(-1) : '' }
  ];
}
