import Image from "next/image";
import { Star } from "lucide-react";
import type { PlumberLike } from "@/lib/plumber-signals";

/**
 * PlatformAgreementStrip — shows Google / Yelp / BBB ratings side by side,
 * with a clear "do they agree?" indicator. Appears on cards only when there
 * IS a meaningful mismatch (we don't want to clutter the happy path), and
 * always on detail pages as a reference strip.
 *
 * Shows gold, silver, or red indicator depending on agreement.
 */

const GAP_YELLOW = 0.5;
const GAP_RED = 1.0;

function ratingColor(gap: number): "green" | "amber" | "red" {
  if (gap >= GAP_RED) return "red";
  if (gap >= GAP_YELLOW) return "amber";
  return "green";
}

export default function PlatformAgreementStrip({
  plumber,
  cardMode = false,
}: {
  plumber: PlumberLike;
  /** When true, only renders if there's a meaningful discrepancy. */
  cardMode?: boolean;
}) {
  const google = typeof plumber.googleRating === "number" ? plumber.googleRating : null;
  const yelp = typeof plumber.yelpRating === "number" ? plumber.yelpRating : null;
  const bbb = (plumber as { bbb?: { rating?: string | null; accredited?: boolean } }).bbb;

  const hasGoogle = google != null;
  const hasYelp = yelp != null;
  const gap = hasGoogle && hasYelp ? Math.abs(google - yelp) : 0;
  const agreementColor = hasGoogle && hasYelp ? ratingColor(gap) : "green";

  // Card mode: only render when there's actually a meaningful gap OR BBB concerns
  if (cardMode) {
    const isNotable = hasYelp && gap >= GAP_YELLOW;
    if (!isNotable) return null;
  }

  if (!hasGoogle && !hasYelp && !bbb) return null;

  return (
    <div
      className={`flex items-center gap-2 text-xs ${
        cardMode ? "mt-1" : "flex-wrap"
      }`}
    >
      {hasGoogle && (
        <span className="inline-flex items-center gap-1 font-medium text-gray-800 whitespace-nowrap">
          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
          <span className="font-bold">{google!.toFixed(1)}</span>
          <span className="text-gray-500">Google</span>
        </span>
      )}
      {hasGoogle && hasYelp && (
        <span
          className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${
            agreementColor === "red"
              ? "text-red-700"
              : agreementColor === "amber"
              ? "text-amber-700"
              : "text-gray-500"
          }`}
          title={
            agreementColor === "red"
              ? `Large ${gap.toFixed(1)}-star gap between platforms`
              : agreementColor === "amber"
              ? `Moderate ${gap.toFixed(1)}-star gap`
              : "Ratings consistent"
          }
        >
          {agreementColor !== "green" && (
            <Image
              src="/icons/signals/platform-mismatch.png"
              alt=""
              width={14}
              height={14}
              style={{ width: 14, height: 14 }}
            />
          )}
          <span>·</span>
        </span>
      )}
      {hasYelp && (
        <span
          className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${
            agreementColor === "red"
              ? "text-red-700"
              : "text-gray-800"
          }`}
        >
          <Star
            className={`w-3.5 h-3.5 ${
              agreementColor === "red"
                ? "text-red-500 fill-red-500"
                : "text-yellow-500 fill-yellow-500"
            }`}
          />
          <span className="font-bold">{yelp!.toFixed(1)}</span>
          <span className="text-gray-500">Yelp</span>
        </span>
      )}
      {bbb?.rating && (
        <>
          <span className="text-gray-400">·</span>
          <span className="inline-flex items-center gap-1 font-medium text-gray-800 whitespace-nowrap">
            <Image
              src={
                bbb.accredited && bbb.rating === "A+"
                  ? "/icons/signals/bbb-accredited.png"
                  : "/icons/signals/bbb-concerns.png"
              }
              alt=""
              width={14}
              height={14}
              style={{ width: 14, height: 14 }}
            />
            <span>BBB {bbb.rating}</span>
          </span>
        </>
      )}
    </div>
  );
}
