import {
  escapeMarkdown,
  formatCurrency,
  formatWatchCount,
  getRequestBaseUrl,
  loadSharedWishlist,
  sendSharedWishlistError
} from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/markdown; charset=utf-8");
  response.setHeader("X-Robots-Tag", "noindex, follow");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).send("# Method not allowed\n");
    return;
  }

  try {
    const data = await loadSharedWishlist(request.query?.token);
    response.status(200).send(renderSharedWishlistMarkdown(data, getRequestBaseUrl(request)));
  } catch (error) {
    sendSharedWishlistError(response, error, "markdown");
  }
}

function renderSharedWishlistMarkdown(data, baseUrl) {
  const shareUrl = `${baseUrl}/share/${encodeURIComponent(data.token)}`;
  const jsonUrl = `${shareUrl}.json`;
  const lines = [
    "# Watch Wishlist",
    "",
    "Shared from Cabinet.",
    "",
    `- Wishlist total: ${escapeMarkdown(formatCurrency(data.summary.wishlist_total))}`,
    `- Saved watches: ${escapeMarkdown(formatWatchCount(data.summary.count))}`,
    `- JSON: <${jsonUrl}>`,
    ""
  ];

  if (!data.watches.length) {
    lines.push("No wishlist watches yet.", "");
    return lines.join("\n");
  }

  data.watches.forEach((watch, index) => {
    lines.push(`## ${index + 1}. ${escapeMarkdown(`${watch.brand} ${watch.model}`.trim() || "Untitled watch")}`);
    lines.push("");
    lines.push(`- Brand: ${escapeMarkdown(watch.brand || "Not listed")}`);
    lines.push(`- Model: ${escapeMarkdown(watch.model || "Not listed")}`);
    lines.push(`- Price: ${escapeMarkdown(formatCurrency(watch.price))}`);
    lines.push(`- Category: ${escapeMarkdown(watch.category || "Not listed")}`);
    lines.push(`- Movement: ${escapeMarkdown(watch.movement || "Not listed")}`);
    lines.push(`- Case size: ${watch.case_size_mm ? `${escapeMarkdown(watch.case_size_mm)} mm` : "Not listed"}`);
    if (watch.reference_number) lines.push(`- Reference: ${escapeMarkdown(watch.reference_number)}`);
    if (watch.source_url) lines.push(`- Source: <${watch.source_url}>`);
    if (watch.image_urls.length) {
      lines.push("- Images:");
      watch.image_urls.forEach((url) => lines.push(`  - <${url}>`));
    }
    lines.push("");
  });

  return lines.join("\n");
}
