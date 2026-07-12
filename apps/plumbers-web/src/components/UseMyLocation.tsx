"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CrosshairIcon } from "./rebuild/icons";

/** Slim market shape passed from the server (derived from markets.json). */
interface MarketCoord {
  name: string;
  /** Two-letter lowercase state code. */
  st: string;
  /** Market city slug. */
  slug: string;
  lat: number;
  lng: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * "Use my location" (02 §2.1) — geolocates and routes to the nearest covered
 * market page. Graceful fallback messaging; never blocks the text search.
 */
export default function UseMyLocation({ markets }: { markets: MarketCoord[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleClick = () => {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser — search by city or ZIP instead.");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        let nearest = markets[0];
        let minDist = Infinity;
        for (const market of markets) {
          const dist = haversineDistance(latitude, longitude, market.lat, market.lng);
          if (dist < minDist) {
            minDist = dist;
            nearest = market;
          }
        }

        setLoading(false);
        if (nearest) router.push(`/plumbers/${nearest.st}/${nearest.slug}`);
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access is off — search by city or ZIP instead.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Couldn't pin down your location — try the city search.");
            break;
          default:
            setError("Couldn't get your location — try the city search.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <div style={{ textAlign: "center" }}>
      <button type="button" className="geo" onClick={handleClick} disabled={loading}>
        <CrosshairIcon size={16} />
        {loading ? "Finding your location…" : "Use my location"}
      </button>
      {error && <p className="search-err">{error}</p>}
    </div>
  );
}
