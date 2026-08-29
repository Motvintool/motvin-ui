# Progressive Web App

This folder contains a standalone PWA shell for the root project.

## Files

- `manifest.json`: PWA metadata, colors, and icons.
- `sw.js`: bootstrap service worker file.
- `sw-core.js`: caching strategy and runtime fetch handling.
- `files.html`: installable entry page.
- `branding/`: icon and logo assets.

## Notes

- `start_url` and `scope` currently target `/Progressive%20Web%20App/`.
- If your deployment path changes, update `manifest.json` accordingly.
- Keep `SW_VERSION` in `sw-core.js` in sync with each release.
