# DJ OGVHS — Product Requirements (Working Draft)

**Status:** Planning / MVP scope agreed in conversation. No application functionality is implemented yet.

## Product goal
A mobile-friendly website for DJ OGVHS listeners to browse the DJ's available tracks, request a song, or request a two-song mashup. The DJ manages incoming requests in a private dashboard. Listeners can optionally tip via external Venmo or PayPal links.

## Listener experience

### Landing / request actions
- Two prominent, equally accessible primary actions at the top of the page:
  1. **Request Song**
  2. **Request Mashup**
- An optional, visually secondary **Support the DJ** action.
- No listener account required for MVP (proposed; confirm before launch).

### Song discovery (used in both request flows)
- Search **DJ OGVHS's actual catalog first**; show clearly which results are available in the DJ's library.
- If a desired song is not there, allow listeners to progressively type the title and/or artist and choose a result from an **external public music search/autocomplete service**.
- Let listeners manually enter a song and artist even when an external lookup does not return an appropriate match or the service is unavailable.
- An external result must **not** imply the DJ possesses the recording.
- Initial API candidate: Apple's iTunes Search API. **Not selected or integrated yet**; confirm coverage, permitted use, response shape, reliability, and terms before implementation.
- Catalog and external search do not need to share a canonical ID for MVP.

### Request a song
- Select one track from the DJ catalog, an external search result, or manual entry.
- Optional listener name.
- Submit, then show a clear success / confirmation view.

### Request a mashup
- Select **exactly two songs**, independently, using the same catalog-first search and fallback behavior for both.
- Optional listener name.
- Submit one mashup request containing both selections (not two separate song requests).
- Mashup requests have **equal priority** to ordinary song requests.

### After submission / tips
- Show a confirmation message with **Venmo** and **PayPal** links as optional tipping choices.
- Keep a nonintrusive **Support the DJ** link accessible elsewhere, such as the header.
- Tipping is never required to submit a request; do not suggest it affects priority.
- Actual account links / handles must be supplied before publishing (never invent them).

## DJ-only admin experience
- Authenticated dashboard (implementation/auth design TBD; do not publish request data openly).
- Show incoming requests and their submission timestamps.
- Clearly distinguish song requests from mashup requests; optionally filter into separate sections while maintaining equal request priority.
- Each entry contains one or two song selections, optional name, availability source and status.
- Status controls: **Pending**, **Later**, **Played**, **Skipped**.
- Default queue ordered by submission time; don't automatically elevate paid requests.

## Proposed minimal data model

**TrackSelection**:
- `title` (required)
- `artist` (optional for manual entry if unknown)
- `source`: `catalog` | `external` | `manual`
- `catalogId` (only when source is catalog)
- `externalId` / `externalProvider` (only when external lookup provides them)

**Request**:
- `id`
- `type`: `song` | `mashup`
- `songs`: array of exactly 1 or 2 TrackSelection objects depending on type
- `listenerName` (optional)
- `createdAt` (server-generated timestamp)
- `status`: `pending` | `later` | `played` | `skipped`

**CatalogTrack**:
- `id`, `title`, `artist`
- Optional fields to preserve existing export metadata (album, file/path reference, source, etc.), subject to review of the user's actual exported data.

## Data and implementation decisions still open
- Catalog source of truth / refresh strategy: import the existing exported inventory via CSV or JSON (actual format to be reviewed).
- Stack, deployment hosting, persistence/database, admin sign-in method.
- External public music API selection and permissible use.
- Whether listener names should default to anonymous; whether notes/messages are desired later.
- Venmo and PayPal links / handles, branding, event-specific configuration.
- Anti-spam: basic validation, per-client rate limits, and secure storage before public launch.

## Explicitly out of scope for MVP
- Music playback or streaming.
- Automatic mashup generation.
- Guaranteed fulfillment of requested songs.
- Payments within the app, priority tipping, or payment verification.
- Listener accounts and social features.

## MVP success criteria
1. On a phone, a listener can choose **Request Song** or **Request Mashup**.
2. They can find catalog tracks quickly, with a clear way to request a missing song using autocomplete or manual entry.
3. A request can be submitted without donating; a confirmation offers optional Venmo or PayPal tipping.
4. The DJ can view and update song and mashup requests, including whether a selection is in the catalog.
5. Unauthenticated visitors cannot access the DJ admin queue.
6. Missing external search service or missing catalog data fails gracefully, without losing the manual request pathway.

_This is a living document. Proposed implementation details are marked as proposed or TBD rather than treated as settled product decisions._
