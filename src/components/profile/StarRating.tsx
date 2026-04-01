import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}

export default function StarRating({ rating, count, size = "md" }: StarRatingProps) {
  const starSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const numSize = size === "sm" ? "text-sm" : "text-xl";
  const countSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`font-[family-name:var(--font-fraunces)] font-bold ${numSize}`}
        style={{ color: "#1a202c" }}
      >
        {rating?.toFixed(1) ?? "—"}
      </span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < Math.round(rating || 0);
          return (
            <Star
              key={i}
              className={starSize}
              fill={filled ? "#EF9F27" : "none"}
              stroke={filled ? "#EF9F27" : "#D1D5DB"}
              strokeWidth={1.5}
            />
          );
        })}
      </div>
      {count != null && (
        <span className={`${countSize} text-gray-500`}>
          {count.toLocaleString()} reviews
        </span>
      )}
    </div>
  );
}
