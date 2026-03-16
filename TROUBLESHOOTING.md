# Troubleshooting: CSS / JS 404s (assets not loading)

If you see errors like **404 for layout.css, main-app.js, page.js** and the UI is broken:

## 1. Use the correct URL

- **Development:** run `npm run dev` and open **http://localhost:4000** (not 3000).
- **Production:** run `npm run build` then `npm run start`, and open **http://localhost:4000**.

Do not open the app from `file://` or from a different host/port than the one Next is serving.

## 2. Clear caches and rebuild

```bash
# Stop the dev/server (Ctrl+C), then:
rm -rf .next
npm run build
npm run dev
```

Then in the browser: **hard refresh** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) or open the app in a **private/incognito** window.

## 3. If you use a reverse proxy (Nginx, Apache, etc.)

Ensure requests to `/_next/*` and `/static/*` are proxied to the Next.js server (e.g. `http://localhost:4000`). Do not serve the app by pointing the proxy at the `out/` or `.next/` folder as static files unless you have used `output: 'export'` and set up correct base paths.

## 4. If you deployed (Vercel, Netlify, etc.)

Redeploy after a clean build. Do not set `basePath` or `assetPrefix` in `next.config.mjs` unless the app is served from a subpath (e.g. `example.com/app/`).
