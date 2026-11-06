# Mixes

The Mixes navigation opens `mixes.html`. OGVHS Faves displays the four most recent public favorites from the djogvhs Mixcloud account; Latest Mixes displays its six newest uploads. Both feeds refresh on page load through Mixcloud's public API and use the official embedded player. No credentials or audio files are stored in this repository.

Favorite or unfavorite mixes on Mixcloud to change OGVHS Faves. Upload shows to update Latest Mixes. The favorites collection can include other creators; each card credits its uploader. Mixcloud controls playback availability, including subscriber-only shows.

Loading, empty, and failed-feed states are handled separately. Failed requests show a retry button and direct Mixcloud links remain available. Players do not autoplay. The layout uses two columns on desktop and one on smaller screens.

Sources: [Mixcloud API](https://www.mixcloud.com/developers/) and [embedding guide](https://help.mixcloud.com/hc/en-us/articles/360004031440-Embedding-content-using-the-Mixcloud-widget).
