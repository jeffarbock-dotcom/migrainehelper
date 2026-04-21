# Migraine Helper

Migraine Helper is a gentle offline-first Progressive Web App for migraine tracking, attack support, and daily routine check-ins.

## Files

- `index.html` - app layout and view structure
- `style.css` - soft iPhone-inspired styling and animations
- `app.js` - localStorage logic, insights, exports/imports, and timer behavior
- `manifest.webmanifest` - install metadata for PWA support
- `service-worker.js` - offline caching for core assets
- `icons/` - app icons for install and home screen use

## Local run

Serve the folder with any static web server, then open it in a browser. Example:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000/`.

## iPhone install

1. Open the deployed site in Safari.
2. Tap `Share`.
3. Tap `Add to Home Screen`.

## Notes

- All data stays in `localStorage` on the device.
- No external APIs or paid services are used.
- Logs can be exported as JSON or CSV and restored from JSON.
