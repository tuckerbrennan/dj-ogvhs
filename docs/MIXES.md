# Mixes

The Mixes navigation opens `mixes.html`. OGVHS Faves is a handpicked selection of DJ OGVHS's own mixes, configured in `public/featured-mixes.json`. It does not use Mixcloud's favorites feed. The selection is empty until the DJ provides picks.

To add a pick, add an object to the JSON `data` array with the show's `key` (for example `/djogvhs/show-slug/`), its verified `name`, and optionally `user: {"name": "DJ OGVHS"}`. Array order controls display order, up to twelve picks. Only `/djogvhs/` shows are accepted. Use actual public show details; do not invent selections.

Latest Mixes automatically displays the six newest uploads from djogvhs through Mixcloud's public API. Each section uses official embedded players. No credentials or audio files are stored here. Mixcloud controls availability, including subscriber-only shows.

Loading, empty, and failed states are handled separately, with retry buttons and direct Mixcloud links. Players do not autoplay. The layout uses two columns on desktop and one on smaller screens.
