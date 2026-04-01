"use client";

import { Phone, Globe, Clock, Shield, Star, Award, BadgeCheck, Calendar } from "lucide-react";
import type { Plumber } from "@/lib/types";
import ReliabilityBadge from "./ReliabilityBadge";
import VerifiedBadge from "./VerifiedBadge";

function StarRating({ rating, count }: { rating: number; count: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-1 text-sm">
      <div className="flex items-center text-yellow-500">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < fullStars
                ? "fill-current"
                : i === fullStars && hasHalf
                ? "fill-current opacity-50"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
      <span className="font-semibold text-gray-900">{rating}</span>
      <span className="text-gray-500">({count} reviews)</span>
    </div>
  );
}

export default function PlumberCard({
  plumber,
  citySlug,
}: {
  plumber: Plumber;
  citySlug: string;
}) {
  const handleCallClick = () => {
    // Track the lead
    fetch("/api/track-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plumberId: plumber.id,
        city: citySlug,
        clickType: "call",
        source: `/emergency-plumbers/${citySlug}`,
      }),
    }).catch(() => {});
  };

  const tierStyles = {
    featured: "border-accent bg-red-50 ring-2 ring-accent/20",
    premium: "border-primary bg-blue-50 ring-1 ring-primary/10",
    free: "border-gray-200 bg-white",
  };

  return (
    <div
      className={`rounded-xl border-2 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow ${
        tierStyles[plumber.listingTier]
      }`}
    >
      {/* Tier badge */}
      {plumber.listingTier === "featured" && (
        <div className="flex items-center gap-1 text-accent font-semibold text-sm mb-2">
          <Award className="w-4 h-4" />
          Featured Plumber
        </div>
      )}
      {plumber.listingTier === "premium" && (
        <div className="flex items-center gap-1 text-primary font-semibold text-sm mb-2">
          <Award className="w-4 h-4" />
          Premium Listing
        </div>
      )}

      {/* Top row: rating + business name */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">{plumber.businessName}</h3>
          {plumber.googleRating && plumber.googleReviewCount && (
            <StarRating rating={plumber.googleRating} count={plumber.googleReviewCount} />
          )}
        </div>
        <p className="text-sm text-gray-600">
          {plumber.address.city}, {plumber.address.state}
          {plumber.yearsInBusiness && ` · ${plumber.yearsInBusiness} yrs`}
        </p>
      </div>

      {/* Badges — horizontal scroll on mobile */}
      <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {plumber.verificationStatus === "verified" && <VerifiedBadge />}
        {plumber.googleVerified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full whitespace-nowrap">
            <BadgeCheck className="w-3 h-3" />
            Google Verified
          </span>
        )}
        {plumber.is24Hour && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full whitespace-nowrap">
            <Clock className="w-3 h-3" />
            24/7
          </span>
        )}
        {plumber.insured && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full whitespace-nowrap">
            <Shield className="w-3 h-3" />
            Insured
          </span>
        )}
        {plumber.reliabilityScore > 0 && (
          <ReliabilityBadge score={plumber.reliabilityScore} />
        )}
      </div>

      {/* Services — show max 4 on mobile, all on desktop */}
      <div className="flex flex-wrap gap-1 mt-2">
        {plumber.services.slice(0, 4).map((service) => (
          <span
            key={service}
            className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md capitalize"
          >
            {service.replace(/-/g, " ")}
          </span>
        ))}
        {plumber.services.length > 4 && (
          <span className="text-xs text-gray-500 px-1 py-0.5 sm:hidden">
            +{plumber.services.length - 4} more
          </span>
        )}
        {plumber.services.slice(4).map((service) => (
          <span
            key={service}
            className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md capitalize hidden sm:inline"
          >
            {service.replace(/-/g, " ")}
          </span>
        ))}
      </div>

      {/* Reliability bar */}
      {plumber.reliabilityScore > 0 && plumber.totalCallAttempts >= 3 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Reliability Score</span>
            <span className="font-semibold">{plumber.reliabilityScore}/100</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                plumber.reliabilityScore >= 80
                  ? "bg-green-500"
                  : plumber.reliabilityScore >= 50
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${plumber.reliabilityScore}%` }}
            />
          </div>
        </div>
      )}

      {/* CTA — stacked on mobile, inline on desktop */}
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <a
          href={`tel:${plumber.phone}`}
          onClick={handleCallClick}
          className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-accent/25 cta-pulse"
        >
          <Phone className="w-5 h-5 flex-shrink-0" />
          <span className="sm:hidden">CALL {plumber.phone}</span>
          <span className="hidden sm:inline">CALL NOW {plumber.phone}</span>
        </a>
        {(plumber.website || plumber.bookingLink) && (
          <div className="flex gap-2">
            {plumber.website && (
              <a
                href={plumber.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  fetch("/api/track-lead", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      plumberId: plumber.id,
                      city: citySlug,
                      clickType: "website",
                      source: `/emergency-plumbers/${citySlug}`,
                    }),
                  }).catch(() => {});
                }}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold py-2.5 px-3 rounded-xl transition-colors text-sm"
              >
                <Globe className="w-4 h-4" />
                Website
              </a>
            )}
            {plumber.bookingLink && (
              <a
                href={plumber.bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 border-2 border-success text-success hover:bg-success hover:text-white font-semibold py-2.5 px-3 rounded-xl transition-colors text-sm"
              >
                <Calendar className="w-4 h-4" />
                Book
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
