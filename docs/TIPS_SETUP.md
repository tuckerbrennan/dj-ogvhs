# Optional tipping links (DJ OGVHS)

The thank-you page offers **Venmo, Zelle, PayPal, and Cash App**, only *after* a submission/preview. Tipping is completely optional and never changes how requests are handled.

## Enable a payment method

Edit `public/tip-config.json` in the GitHub repository:

```json
{
  "venmoUrl": "",
  "paypalUrl": "",
  "cashAppUrl": "",
  "zelleRecipient": ""
}
```

- **Venmo**: paste the exact link to the DJ's own Venmo account/profile. You can share it from the Venmo app.
- **PayPal**: paste your PayPal.Me link, e.g. your own `https://paypal.me/...` URL.
- **Cash App**: paste your Cash App profile link or your own reusable payment request link from Cash App.
- **Zelle**: set a *publicly shareable* enrolled recipient address (email or US phone number), not a bank account or routing number. The Zelle button **copies the recipient** and explains that the listener can send through their banking app. An external website **cannot generate a Zelle payment request automatically**. Zelle requests must be initiated from a bank's Zelle interface and can be sent only to enrolled users.

Until values are configured, the four methods appear disabled and tell visitors that tipping links are not yet connected. Do not guess any payment handles or paste private account details into the repository; these values are publicly visible and are not encrypted.

The app does **not** accept, process, verify, or record payments. Listeners leave to the chosen payment provider (or their own bank) and complete payments there. The server-side song request must be stored successfully before showing a real success confirmation. In `?demo=1` the success page is only a preview and prominently states that no request was submitted.
