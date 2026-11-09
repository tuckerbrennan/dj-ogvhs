// DJ OGVHS analytics: automatic basic measurement, with a permanent opt-out.
// Tag setup comes from public/analytics-config.json. Only one tag is loaded.
// Visitors who previously declined, or whose browser signals GPC, are not tracked.
const CONFIG_URL = new URL("../public/analytics-config.json", import.meta.url);
const CHOICE_KEY = "djogvhs_analytics_consent_v1";
const TAG_ID_PATTERN = /^(G-[A-Z0-9]{5,}|GTM-[A-Z0-9]{5,})$/i;

function readOptOut() {
  try { return localStorage.getItem(CHOICE_KEY) === "declined"; }
  catch { return false; }
}

function setOptOut(disabled) {
  try { localStorage.setItem(CHOICE_KEY, disabled ? "declined" : "accepted"); }
  catch { /* Private browsing may block storage. */ }
}

function removeAnalyticsCookies() {
  // Best effort for first-party Google Analytics cookies; does not erase data
  // already received by Google or third-party cookies outside this domain.
  const names = document.cookie.split(";").map(c => c.split("=")[0].trim());
  const host = location.hostname;
  const domains = ["", host, "." + host, ".ogvhs.com"];
  for (const name of names) {
    if (!/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name)) continue;
    for (const domain of domains) {
      document.cookie = name + "=; Max-Age=0; path=/; SameSite=Lax" +
        (domain ? "; domain=" + domain : "");
    }
  }
}

function loadTag(tagId) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  // This site uses analytics for audience measurement, not advertising.
  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
  window.gtag("js", new Date());

  const isContainer = tagId.startsWith("GTM-");
  if (isContainer) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  } else {
    window.gtag("config", tagId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + location.pathname
    });
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = isContainer
    ? "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(tagId)
    : "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(tagId);
  document.head.appendChild(script);
}

function addOptOutControl() {
  const footer = document.querySelector("footer");
  if (!footer || document.getElementById("djogvhs-analytics-settings")) return;
  const optedOut = readOptOut() || navigator.globalPrivacyControl === true;
  const button = document.createElement("button");
  button.type = "button";
  button.id = "djogvhs-analytics-settings";
  button.className = "analytics-preferences";
  button.textContent = optedOut ? "Enable analytics" : "Disable analytics";
  button.setAttribute("aria-label", optedOut ? "Enable optional Google Analytics" : "Disable Google Analytics");
  if (navigator.globalPrivacyControl === true) {
    button.textContent = "Analytics blocked by browser";
    button.disabled = true;
    button.title = "Your browser has sent a Global Privacy Control signal.";
  }
  button.addEventListener("click", () => {
    const willDisable = !readOptOut();
    if (willDisable) {
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      removeAnalyticsCookies();
    }
    setOptOut(willDisable);
    // Reload to fully prevent script execution after opting out.
    location.reload();
  });
  footer.appendChild(button);
}

async function init() {
  let id;
  try {
    const response = await fetch(CONFIG_URL, { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    id = String(config.tagId || config.measurementId || "").trim().toUpperCase();
  } catch { return; }
  if (!TAG_ID_PATTERN.test(id)) return;
  // Never display an initial consent banner; the footer provides an opt-out.
  addOptOutControl();
  if (navigator.globalPrivacyControl === true || readOptOut()) return;
  loadTag(id);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
