import { getRequestBaseUrl, loadSharedWishlist, renderSharedWishlistMarkdown, sendSharedWishlistError } from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/markdown; charset=utf-8");

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
