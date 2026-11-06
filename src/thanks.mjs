// The message on this page is a confirmation of the *client's* last submission.
// Only the backend/database can confirm whether a live request was stored.
const CONFIRMATION_KEY = "dj-ogvhs-confirmation";
const $ = id => document.getElementById(id);

function validatedPaymentUrl(raw, allowedHostnames) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !allowedHostnames.includes(host) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function showStatus(text) {
  $("tip-feedback").textContent = text;
}

function createTipLink(label, url) {
  const a = document.createElement("a");
  a.className = "tip-button";
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  a.setAttribute("aria-label", label + " — opens in a new tab");
  return a;
}

function createDisabledTip(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tip-button";
  button.disabled = true;
  button.textContent = label;
  button.title = "The DJ hasn't connected this tip option yet.";
  return button;
}

async function loadTipOptions() {
  let config = {};
  try {
    const response = await fetch("./public/tip-config.json", { cache: "no-store" });
    if (response.ok) config = await response.json();
  } catch { /* The confirmation page still works without tipping. */ }

  const options = [
    ["Venmo", validatedPaymentUrl(config.venmoUrl, ["venmo.com", "www.venmo.com"])],
    ["PayPal", validatedPaymentUrl(config.paypalUrl, ["paypal.me", "www.paypal.me", "paypal.com", "www.paypal.com"])],
    ["Cash App", validatedPaymentUrl(config.cashAppUrl, ["cash.app", "www.cash.app"])]
  ];
  const tipOptions = $("tip-options");
  for (const [label, url] of options) tipOptions.appendChild(url ? createTipLink(label, url) : createDisabledTip(label));

  const zelleRecipient = typeof config.zelleRecipient === "string" ? config.zelleRecipient.trim() : "";
  const zelle = createDisabledTip("Zelle");
  if (zelleRecipient && zelleRecipient.length <= 120) {
    zelle.disabled = false;
    zelle.title = "Copy the DJ's Zelle recipient and open your bank app to send a tip.";
    zelle.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(zelleRecipient);
        showStatus("Zelle recipient copied. Open Zelle in your banking app, paste the recipient, and choose an amount.");
      } catch {
        showStatus("To tip through Zelle, open your banking app and send to: " + zelleRecipient);
      }
    });
  }
  // Keep Zelle second, between Venmo and PayPal.
  tipOptions.insertBefore(zelle, tipOptions.children[1]);
  if (!options.some(([,url]) => url) && !zelleRecipient) {
    showStatus("Tip links will be enabled once the DJ connects the payment accounts.");
  }
}

function show() {
  const raw = sessionStorage.getItem(CONFIRMATION_KEY);
  sessionStorage.removeItem(CONFIRMATION_KEY);
  let state = null;
  try { state = JSON.parse(raw || "null"); } catch { /* fall through */ }
  if (!state || (state.status !== "demo" && state.status !== "submitted")) {
    $("no-confirmation").hidden = false;
    return;
  }
  $("confirmation").hidden = false;
  $("demo-warning").hidden = state.status !== "demo";
  loadTipOptions();
}
show();
