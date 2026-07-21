import { loadSharedWishlist, renderSharedWishlistText, getRequestBaseUrl, sendSharedWishlistError } from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).send("Method not allowed.\n");
    return;
  }

  try {
    const data = await loadSharedWishlist(request.query?.token);
    const baseUrl = getRequestBaseUrl(request);
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.status(200).send(renderSharedWishlistText(data, baseUrl));
  } catch (error) {
    sendSharedWishlistError(response, error);
  }
}
