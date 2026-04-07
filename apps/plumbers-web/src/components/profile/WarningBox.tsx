import { AlertCircle } from "lucide-react";

interface WarningBoxProps {
  weaknesses: string[];
  redFlags: string[];
  priceSignal?: string;
}

export default function WarningBox({ weaknesses, redFlags, priceSignal }: WarningBoxProps) {
  const items: { label: string; text: string }[] = [];

  for (const flag of redFlags) {
    items.push({ label: "Red flag", text: flag });
  }

  if (priceSignal === "premium" && !redFlags.some((f) => f.toLowerCase().includes("pric"))) {
    items.push({
      label: "Pricing",
      text: "Reviewers indicate this is a premium-priced service. Get multiple quotes.",
    });
  }

  for (const w of weaknesses) {
    items.push({ label: "Weakness", text: w });
  }

  if (items.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "#FCEBEB",
        border: "1.5px solid #F09595",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#A32D2D" }}
        >
          <AlertCircle className="w-4 h-4 text-white" />
        </div>
        <h3
          className="font-[family-name:var(--font-dm-sans)] font-bold text-sm"
          style={{ color: "#791F1F" }}
        >
          Watch out for
        </h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm" style={{ color: "#791F1F" }}>
            <span className="shrink-0 mt-0.5">&#8226;</span>
            <span>
              <strong>{item.label}:</strong> {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
