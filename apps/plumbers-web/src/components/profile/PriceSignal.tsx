interface PriceSignalProps {
  signal: string;
  showLabel?: boolean;
}

function getPriceDisplay(signal: string) {
  switch (signal) {
    case "budget":
      return { dollars: "$", color: "#0F6E56", bg: "#E1F5EE", label: "Budget-friendly" };
    case "mid-range":
      return { dollars: "$$", color: "#854F0B", bg: "#FAEEDA", label: "Mid-range" };
    case "premium":
      return { dollars: "$$$$", color: "#A32D2D", bg: "#FCEBEB", label: "Expensive" };
    case "mixed":
      return { dollars: "$-$$$", color: "#854F0B", bg: "#FAEEDA", label: "Varies" };
    default:
      return { dollars: "—", color: "#6B7280", bg: "#F3F4F6", label: "Unknown" };
  }
}

export default function PriceSignal({ signal, showLabel = true }: PriceSignalProps) {
  const { dollars, color, bg, label } = getPriceDisplay(signal);

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-[family-name:var(--font-fraunces)] text-xl font-bold"
        style={{ color }}
      >
        {dollars}
      </span>
      {showLabel && (
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color, backgroundColor: bg }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
