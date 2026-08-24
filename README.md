# Meal Index

A personal meal-prep selector: file meal ideas as cards, plan your week and
get an auto-generated grocery list, pull a random meal when you need a
second idea, or find matches based on what's already in your kitchen.

## Run it locally

```
npm install
npm run dev
```

Then open the local URL shown in your terminal (usually http://localhost:5173).

## Deploy it

Push this folder to a GitHub repo, then connect it to Vercel or Netlify
(both have a free tier) for a real, shareable URL. No config needed beyond
the defaults — it's a standard Vite + React app.

## Notes

- Data is saved in your browser's local storage, so it's tied to that
  browser/device. Clearing browser data will clear your saved meals.
- Built with React, Vite, Tailwind CSS, and lucide-react icons.

## Deploy for free (share with friends)

**Fastest — Netlify Drop (no account needed for a quick test):**
1. Run `npm run build` — creates a `dist` folder.
2. Go to https://app.netlify.com/drop in your browser.
3. Drag the `dist` folder onto the page. You'll get a live URL in seconds.

**Better for a stable, updatable link — Netlify with an account (still free):**
1. Sign up at netlify.com (free tier).
2. `npm install -g netlify-cli` then `netlify deploy` from this folder, following the prompts.
3. Run `netlify deploy --prod` when you're ready to make it live. Re-run this
   any time you want to push updates.

## Installing it like an app

Once it's live, open the URL on a phone:
- **iPhone (Safari):** tap the Share icon → "Add to Home Screen"
- **Android (Chrome):** tap the ⋮ menu → "Add to Home screen" / "Install app"

It'll get its own icon and open full-screen, no browser bar — that's the
"installable" part working without needing an App Store at all.
