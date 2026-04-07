"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2 } from "lucide-react";

interface CityCoord {
  name: string;
  state: string;
  stateSlug: string;
  citySlug: string;
  lat: number;
  lng: number;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

export default function UseMyLocation({ cities }: { cities: CityCoord[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleClick = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // Find nearest city
        let nearest = cities[0];
        let minDist = Infinity;

        for (const city of cities) {
          const dist = haversineDistance(latitude, longitude, city.lat, city.lng);
          if (dist < minDist) {
            minDist = dist;
            nearest = city;
          }
        }

        setLoading(false);
        router.push(`/emergency-plumbers/${nearest.stateSlug}/${nearest.citySlug}`);
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access denied. Please enable location in your browser settings.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location unavailable. Please try again.");
            break;
          default:
            setError("Could not get your location. Please search by city name.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-white transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MapPin className="w-4 h-4" />
        )}
        {loading ? "Finding your location..." : "Use My Location"}
      </button>
      {error && (
        <p className="text-xs text-red-300 mt-1">{error}</p>
      )}
    </div>
  );
}
