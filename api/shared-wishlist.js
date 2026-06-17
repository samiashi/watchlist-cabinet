import { loadSharedWishlist, sendSharedWishlistError } from "../server/sharedWishlist.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    response.status(200).json(await loadSharedWishlist(request.query?.token));
  } catch (error) {
    sendSharedWishlistError(response, error);
  }
}
