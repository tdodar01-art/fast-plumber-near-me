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

      {/* Rating */}
      {plumber.googleRating && plumber.googleReviewCount && (
        <StarRating rating={plumber.googleRating} count={plumber.googleReviewCount} />
      )}

      {/* Business name */}
      <h3 className="text-xl font-bold text-gray-900 mt-1">{plumber.businessName}</h3>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {plumber.verificationStatus === "verified" && <VerifiedBadge />}
        {plumber.googleVerified && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
            <BadgeCheck className="w-3 h-3" />
            Google Verified
          </span>
        )}
        {plumber.is24Hour && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full">
            <Clock className="w-3 h-3" />
            24/7
          </span>
        )}
        {plumber.insured && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-800 px-2.5 py-1 rounded-full">
            <Shield className="w-3 h-3" />
            Licensed &amp; Insured
          </span>
        )}
        {plumber.reliabilityScore > 0 && (
          <ReliabilityBadge score={plumber.reliabilityScore} />
        )}
      </div>

      {/* Location & details */}
      <p className="text-sm text-gray-600 mt-2">
        {plumber.address.city}, {plumber.address.state}
        {plumber.yearsInBusiness && ` • ${plumber.yearsInBusiness} years in business`}
      </p>

      {/* Services */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {plumber.services.map((service) => (
          <span
            key={service}
            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md capitalize"
          >
            {service.replace(/-/g, " ")}
          </span>
        ))}
      </div>

      {/* Reliability bar */}
      {plumber.reliabilityScore > 0 && plumber.totalCallAttempts >= 3 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Reliability Score</span>
            <span className="font-semibold">{plumber.reliabilityScore}/100</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
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

      {/* CTA */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <a
          href={`tel:${plumber.phone}`}
          onClick={handleCallClick}
          className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-3.5 px-6 rounded-xl text-lg transition-colors shadow-lg shadow-accent/25"
        >
          <Phone className="w-5 h-5" />
          CALL NOW {plumber.phone}
        </a>
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
            className="flex items-center justify-center gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold py-3 px-4 rounded-xl transition-colors"
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
            className="flex items-center justify-center gap-2 border-2 border-success text-success hover:bg-success hover:text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Book
          </a>
        )}
      </div>
    </div>
  );
}
