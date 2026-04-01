"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface DirectoryFiltersProps {
  cities: string[];
}

const trustLevels = [
  { value: "", label: "All" },
  { value: "high", label: "High trust" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low trust" },
];

const priceOptions = [
  { value: "", label: "Any price" },
  { value: "budget", label: "$" },
  { value: "mid-range", label: "$$" },
  { value: "premium", label: "$$$$" },
];

export default function DirectoryFilters({ cities }: DirectoryFiltersProps) {
  const searchParams = useSearchParams();
  const initialCity = searchParams.get("city") || "";

  const [city, setCity] = useState(initialCity);
  const [trust, setTrust] = useState("");
  const [price, setPrice] = useState("");

  const applyFilters = useCallback(
    (newCity: string, newTrust: string, newPrice: string) => {
      const cards = document.querySelectorAll<HTMLElement>("#plumber-list > div");
      cards.forEach((card) => {
        const cardCity = card.dataset.city ?? "";
        const cardTrust = card.dataset.trust ?? "";
        const cardPrice = card.dataset.price ?? "";

        const matchCity = !newCity || cardCity === newCity;
        const matchTrust = !newTrust || cardTrust === newTrust;
        const matchPrice = !newPrice || cardPrice === newPrice;

        card.style.display = matchCity && matchTrust && matchPrice ? "" : "none";
      });
    },
    []
  );

  // Apply initial city filter from URL on mount
  useEffect(() => {
    if (initialCity) {
      applyFilters(initialCity, trust, price);
    }
  }, [initialCity, applyFilters, trust, price]);

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <select
        value={city}
        onChange={(e) => {
          setCity(e.target.value);
          applyFilters(e.target.value, trust, price);
        }}
        className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 border-none appearance-none cursor-pointer"
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {trustLevels.map((tl) => (
        <button
          key={tl.value}
          onClick={() => {
            setTrust(tl.value);
            applyFilters(city, tl.value, price);
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors"
          style={{
            backgroundColor:
              trust === tl.value
                ? tl.value === "high"
                  ? "#E1F5EE"
                  : tl.value === "moderate"
                    ? "#FAEEDA"
                    : tl.value === "low"
                      ? "#FCEBEB"
                      : "#1a365d"
                : "#F3F4F6",
            color:
              trust === tl.value
                ? tl.value === "high"
                  ? "#0F6E56"
                  : tl.value === "moderate"
                    ? "#854F0B"
                    : tl.value === "low"
                      ? "#A32D2D"
                      : "#FFFFFF"
                : "#6B7280",
          }}
        >
          {tl.label}
        </button>
      ))}

      <select
        value={price}
        onChange={(e) => {
          setPrice(e.target.value);
          applyFilters(city, trust, e.target.value);
        }}
        className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 border-none appearance-none cursor-pointer"
      >
        {priceOptions.map((po) => (
          <option key={po.value} value={po.value}>
            {po.label}
          </option>
        ))}
      </select>
    </div>
  );
}
