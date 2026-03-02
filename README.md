# GT Chrome Extension

Inline translator similar to Google Translate: select text on any page, click the small prompt, and see the translation in-place.

## Load the extension

1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on "Developer mode" (top right).
3. Click "Load unpacked" and select folder.
4. Ensure "GT" appears in the extensions list.

## Use it

- Select any text (preferably English). A small "Translate" bubble appears near the selection.
- Click "Translate" to fetch a translation (auto-detects source language). Default target language is Chinese if your browser locale starts with `zh`, otherwise English.
- The translation appears in a floating card under the selection.

## Notes

- Translation uses `translate.googleapis.com` with public web parameters (no API key required). Network restrictions could block it on some sites.
- If CORS blocks the request on a specific page, try reloading or using a different site; requests are made from the background service worker.
