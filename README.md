# Watchlist Cabinet

A private mobile-first web app for watch collecting.

Use it to:

- Track owned watches and wishlist watches.
- Save watches found on random websites with source URLs.
- Organize watches by category.
- Calculate wishlist total cost and category gaps.
- Sync to Supabase when configured, with local browser storage as a fallback.

## Run Locally

Install dependencies:

```bash
npm install
```

Run the Vite dev server:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4173/
```

Without Supabase env vars, data is stored in the browser with `localStorage`.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` from the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

5. Restart `npm run dev`.

When Supabase is configured, the app uses email magic-link sign-in and stores watches in the `watches` table with row-level security.

## Deploy To Vercel

Import the private GitHub repo in Vercel or run:

```bash
npx vercel
```

Add the same Supabase env vars in Vercel project settings for Production, Preview, and Development. After that, each push to `main` can deploy the phone-ready app.

## Build

```bash
npm run build
```
