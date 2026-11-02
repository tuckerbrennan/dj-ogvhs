# DJ OGVHS

A mobile-friendly song and mashup request web app for DJ OGVHS.

**Project status:** Requirements and backlog in progress. The app has not been implemented.

## Core listener experience
- Two primary actions: **Request Song** and **Request Mashup** (two songs).
- Search the DJ's existing catalog first.
- For songs not found, use external song-search autocomplete (provider TBD) or manual entry.
- Submit requests without an account or payment; optionally leave a name.
- See an optional Venmo / PayPal tip invitation after submitting.

## DJ dashboard
- Private request queue with song and mashup requests of equal priority.
- Track requested selections, source/availability, submission time and status.
- Set requests to Pending, Later, Played or Skipped.

## Project planning
- [Product requirements and MVP acceptance criteria](docs/PRODUCT_REQUIREMENTS.md)
- [GitHub issues](https://github.com/tuckerbrennan/dj-ogvhs/issues) — implementation backlog

## Next steps
1. Confirm catalog export format and representative data.
2. Select a frontend/backend stack and secure deployment setup.
3. Evaluate the external track-autocomplete provider.
4. Build listener pages, persistence and admin queue.
5. Configure actual tipping destinations and test before launching.

This repo initially contains planning documents; no listener-facing website is live yet.
