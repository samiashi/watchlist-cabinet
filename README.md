<div align="center">

# Watchlist Cabinet

A private, mobile-first watch cabinet for tracking owned watches, wishlist watches, category gaps, and the AED cost of the next collection move.

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&labelColor=111317)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&labelColor=111317)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&labelColor=111317)
![Supabase](https://img.shields.io/badge/Supabase-ready-3ecf8e?style=flat-square&labelColor=111317)
![Dark Mode](https://img.shields.io/badge/Dark%20mode-only-0f1012?style=flat-square&labelColor=111317)

</div>

Built for quick use on an iPhone, with a dark-only native-feeling interface, large watch images, simple watch entry, and optional Supabase sync for persistent storage.

## Screenshots

<p>
  <img src="docs/screenshots/mobile-main.png" alt="Watchlist Cabinet mobile collection view" width="260" />
  <img src="docs/screenshots/mobile-add.png" alt="Watchlist Cabinet mobile add watch sheet" width="260" />
</p>

Mobile collection view and add-watch sheet.

<img src="docs/screenshots/desktop-main.png" alt="Watchlist Cabinet desktop collection dashboard" width="860" />

Desktop layout for wider screens.

## Highlights

- Save watches from any website with a source URL.
- Display the collection with a large featured watch and compact watch cards.
- Track owned watches and wishlist watches in one view.
- Filter by status and category: Dress, Diver, Field, Chronograph, GMT, and Daily.
- Calculate wishlist total, owned value, budget gap, and missing category coverage in AED.
- Works locally with `localStorage` when Supabase is not configured.
- Syncs across devices with Supabase magic-link auth when env vars are present.
- Deploys cleanly to Vercel and includes a PWA manifest/icons for phone install.

## Tech Stack

- React
- TypeScript
- Vite
- Supabase
- Vercel
- Lucide icons
- Custom dark design system in CSS

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173/
```

Without Supabase env vars, the app stores data in your browser with `localStorage`.

## Supabase Setup

Create a Supabase project, then run the schema:

```text
supabase/schema.sql
```

Create `.env.local` from the example file:

```bash
cp .env.example .env.local
```

Add your Supabase values:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Restart the dev server:

```bash
npm run dev
```

When Supabase is configured, the app shows an email magic-link sign-in screen and stores watches with row-level security.

## Deploy To Vercel

Import the private GitHub repo into Vercel, or deploy from the CLI:

```bash
npx vercel
```

Add the same Supabase env vars in Vercel project settings for Production, Preview, and Development:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

After that, pushes to `main` can deploy the phone-ready app.

## Scripts

```bash
npm run dev        # Start local development
npm run build      # Typecheck and build for production
npm run preview    # Preview the production build locally
npm run typecheck  # Run TypeScript checks
```

## Project Structure

```text
src/
  App.tsx              Main app shell and UI
  lib/
    cloudStorage.ts    Supabase reads/writes
    localStorage.ts    Local fallback persistence
    sampleData.ts      Starter watch data
    types.ts           App domain types
supabase/
  schema.sql           Database tables, indexes, and RLS policies
public/
  manifest.webmanifest PWA metadata
  sw.js                App shell service worker
docs/screenshots/      README screenshots
```
