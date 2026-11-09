// DJ OGVHS Google Analytics 4 integration.
// No Google Analytics requests are made until a visitor opts in.
// Configure the public GA4 measurement ID in /public/analytics-config.json.
const CONFIG_URL = new URL("../public/analytics-config.json", import.meta.url);
const CONSENT_KEY = "djogvhs_analytics_consent_v1";
const GA4_ID = /^G-[A-Z0-9]{5,}$/i;

function readConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}
function saveConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* private mode */ }
}
let loaded = false;
function enableAnalytics(measurementId) {
  if (loaded || navigator.globalPrivacyControl === true) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("js", new Date());
  // Privacy-conscious defaults: no Google Signals or ad personalization.
  window.gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(tag);
}
function removeBanner() {
  document.getElementById("djogvhs-analytics-consent")?.remove();
}
function showBanner(measurementId) {
  if (document.getElementById("djogvhs-analytics-consent")) return;
  const banner = document.createElement("aside");
  banner.id = "djogvhs-analytics-consent";
  banner.className = "analytics-consent";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Optional analytics privacy choices");
  banner.innerHTML = `
    <div class="analytics-consent-copy">
      <strong>Help us improve DJ OGVHS?</strong>
      <p>With your permission, we use Google Analytics to understand visits and page usage. No advertising tracking. <a href="https://ogvhs.com/privacy.html">Privacy Policy</a></p>
    </div>
    <div class="analytics-consent-actions">
      <button type="button" data-analytics-choice="declined">No thanks</button>
      <button type="button" data-analytics-choice="accepted">Allow analytics</button>
    </div>`;
  banner.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-analytics-choice]");
    if (!button) return;
    const choice = button.dataset.analyticsChoice;
    saveConsent(choice);
    removeBanner();
    if (choice === "accepted") enableAnalytics(measurementId);
    else if (loaded) {
      // Consent was withdrawn after the Google tag loaded on this page.
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      window.location.reload();
    }
  });
  document.body.appendChild(banner);
}
function addPreferences(measurementId) {
  const footer = document.querySelector("footer");
  if (!footer || document.getElementById("djogvhs-analytics-settings")) return;
  const button = document.createElement("button");
  button.id = "djogvhs-analytics-settings";
  button.type = "button";
  button.className = "analytics-preferences";
  button.textContent = "Analytics preferences";
  button.addEventListener("click", () => showBanner(measurementId));
  footer.appendChild(button);
}
async function init() {
  // Be inert until a real GA4 property is supplied. No banner or Google requests.
  let config;
  try {
    const response = await fetch(CONFIG_URL, { cache: "no-store" });
    if (!response.ok) return;
    config = await response.json();
  } catch { return; }
  const id = typeof config.measurementId === "string" ? config.measurementId.trim().toUpperCase() : "";
  if (!GA4_ID.test(id)) return;
  addPreferences(id);
  if (navigator.globalPrivacyControl === true) return;
  const consent = readConsent();
  if (consent === "accepted") enableAnalytics(id);
  else if (consent !== "declined") showBanner(id);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
