import { paymentOptions } from "./tip-options.mjs";
// The message on this page is a confirmation of the *client's* last submission.
// Only the backend/database can confirm whether a live request was stored.
const CONFIRMATION_KEY = "dj-ogvhs-confirmation";
const $ = id => document.getElementById(id);

function showStatus(text) {
  $("tip-feedback").textContent = text;
}

function createTipControl(option) {
  const { label, url, recipient, detail } = option;
  const control = document.createElement(url ? "a" : "button");
  control.className = "tip-button";
  if (url) {
    control.href = url; control.target = "_blank"; control.rel = "noopener noreferrer";
  } else {
    control.type = "button"; control.disabled = !recipient;
  }
  const name = document.createElement("span"); name.textContent = label; control.appendChild(name);
  if (detail) { const info = document.createElement("small"); info.textContent = detail; control.appendChild(info); }
  control.setAttribute("aria-label", label + (detail ? " " + detail : "") + (url ? " — opens in a new tab" : recipient ? " — copy recipient" : " — not connected"));
  if (!url && !recipient) control.title = "The DJ hasn't connected this tip option yet.";
  if (recipient) {
    control.title = label === "Zelle" ? "Copy the number, then send through Zelle in your bank app." : "Copy the email, then paste it into PayPal's Send screen.";
    control.addEventListener("click", async () => {
      let copied = false;
      try { await navigator.clipboard.writeText(recipient); copied = true; } catch { /* Recipient stays visible for manual entry. */ }
      showStatus((copied ? label + " recipient copied. " : "") + (label === "Zelle"
        ? "Open Zelle in your banking app and send to " + recipient + "."
        : "In PayPal, paste " + recipient + " as the recipient and choose an amount."));
    });
  }
  return control;
}

async function loadTipOptions() {
  let config = {};
  try {
    const response = await fetch("./public/tip-config.json", { cache: "no-store" });
    if (response.ok) config = await response.json();
  } catch { /* The confirmation page still works without tipping. */ }
  const options = paymentOptions(config);
  $("tip-options").replaceChildren(...options.map(createTipControl));
  if (!options.some(option => option.url || option.recipient)) showStatus("Tip links will be enabled once the DJ connects the payment accounts.");
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
