import { Archive, Clock, Gem, Mountain, Plane, Sun, Timer, Waves } from "lucide-react";
import type { WatchCategory } from "../lib/types";

export function CategoryGlyph({ category, size = 14 }: { category: WatchCategory; size?: number }) {
  const Icon =
    category === "Dress"
      ? Gem
      : category === "Diver"
        ? Waves
        : category === "Field"
          ? Mountain
          : category === "Chronograph"
            ? Timer
            : category === "GMT"
              ? Clock
              : category === "Pilot"
                ? Plane
                : category === "Vintage"
                  ? Archive
                : Sun;
  return <Icon size={size} aria-hidden="true" />;
}
