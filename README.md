# Watchlist Cabinet

A small local web app for watch collecting.

Use it to:

- Track owned watches and wishlist watches.
- Save watches found on random websites with source URLs.
- Organize watches by category.
- Calculate wishlist total cost and category gaps.
- Export the cabinet to CSV.

## Run Locally

This is a dependency-free static app.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

Data is stored in the browser with `localStorage`.
