# Optional tips

After a successful submission (or a clearly marked demo preview), the confirmation page offers:

- Venmo: **@TuckerBrennan732** — `https://account.venmo.com/u/TuckerBrennan732`
- Zelle: **732-245-0486** — copies the recipient for the listener's banking app.
- PayPal: **ogvhstape@gmail.com** — opens PayPal's Send screen and copies the email. The listener pastes it as the recipient and chooses an amount. No PayPal.Me username is assumed.
- Cash App: **$ogvhs** — `https://cash.app/$ogvhs`

The values in `public/tip-config.json` were supplied by the owner for public use. Never put secret credentials or bank account details there. Payment URLs must use HTTPS and an approved provider hostname; the UI renders recipient text as plain text.

The website does not initiate, process, verify, or record payments. Tips are optional and never change request priority. If copying is unavailable, the recipient remains visible for manual entry. Unconfigured methods remain disabled.
