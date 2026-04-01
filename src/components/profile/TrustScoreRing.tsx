interface TrustScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getScoreColor(score: number) {
  if (score >= 80) return { stroke: "#0F6E56", text: "#0F6E56", label: "High trust" };
  if (score >= 60) return { stroke: "#BA7517", text: "#854F0B", label: "Moderate" };
  return { stroke: "#A32D2D", text: "#A32D2D", label: "Low trust" };
}

const sizes = {
  sm: { ring: 48, strokeWidth: 4, fontSize: "text-sm", labelSize: "text-[9px]" },
  md: { ring: 72, strokeWidth: 5, fontSize: "text-xl", labelSize: "text-[10px]" },
  lg: { ring: 88, strokeWidth: 6, fontSize: "text-2xl", labelSize: "text-xs" },
};

export default function TrustScoreRing({ score, size = "md" }: TrustScoreRingProps) {
  const { ring, strokeWidth, fontSize, labelSize } = sizes[size];
  const { stroke, text, label } = getScoreColor(score);
  const radius = (ring - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: ring, height: ring }}>
        <svg width={ring} height={ring} className="-rotate-90">
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-[family-name:var(--font-fraunces)] font-bold ${fontSize}`}
          style={{ color: text }}
        >
          {score}
        </span>
      </div>
      <span className={`${labelSize} font-medium`} style={{ color: text }}>
        {label}
      </span>
    </div>
  );
}
