"use client";

import { useEffect } from "react";

export default function BounceTracker({ plumberId, city }: { plumberId: string; city: string }) {
  useEffect(() => {
    const arrivalTime = Date.now();

    function handleBeforeUnload() {
      const timeOnPage = Date.now() - arrivalTime;
      if (timeOnPage < 10000) {
        // Quick bounce — user left within 10 seconds
        navigator.sendBeacon(
          "/api/track-engagement",
          JSON.stringify({ plumberId, engagementType: "quick-bounce", city })
        );
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [plumberId, city]);

  return null;
}
