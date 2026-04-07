import { Star, AlertTriangle, MessageSquareQuote } from "lucide-react";

interface QuoteCardProps {
  quote: string;
  variant: "positive" | "negative";
  label: string;
}

export function QuoteCard({ quote, variant, label }: QuoteCardProps) {
  const isNeg = variant === "negative";
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: isNeg ? "#FCEBEB" : "#F7F8FA",
        border: isNeg ? "1.5px solid #F09595" : "0.5px solid #E5E7EB",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {isNeg ? (
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#A32D2D" }} />
        ) : (
          <MessageSquareQuote className="w-3.5 h-3.5 text-gray-500" />
        )}
        <span
          className="text-xs font-semibold"
          style={{ color: isNeg ? "#791F1F" : "#6B7280" }}
        >
          {label}
        </span>
      </div>
      <p
        className="text-sm leading-relaxed italic"
        style={{ color: isNeg ? "#791F1F" : "#374151" }}
      >
        &ldquo;{quote}&rdquo;
      </p>
    </div>
  );
}

interface GoogleReviewCardProps {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
  source?: "google" | "yelp" | "angi";
}

const sourceLabels: Record<string, { label: string; color: string }> = {
  google: { label: "Google", color: "bg-blue-50 text-blue-600" },
  yelp: { label: "Yelp", color: "bg-red-50 text-red-600" },
  angi: { label: "Angi", color: "bg-green-50 text-green-600" },
};

export function GoogleReviewCard({
  author,
  rating,
  text,
  relativeTime,
  source,
}: GoogleReviewCardProps) {
  const srcInfo = source ? sourceLabels[source] : null;
  return (
    <div
      className="rounded-xl p-4"
      style={{ border: "0.5px solid #E5E7EB" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
            {author.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-800">{author}</span>
          {srcInfo && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${srcInfo.color}`}>
              {srcInfo.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{relativeTime}</span>
      </div>
      <div className="flex items-center gap-0.5 mb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="w-3.5 h-3.5"
            fill={i < rating ? "#EF9F27" : "none"}
            stroke={i < rating ? "#EF9F27" : "#D1D5DB"}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{text}</p>
    </div>
  );
}
