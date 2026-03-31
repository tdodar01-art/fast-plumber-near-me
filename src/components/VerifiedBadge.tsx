import { CheckCircle } from "lucide-react";

export default function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-success-light text-green-800 px-2.5 py-1 rounded-full">
      <CheckCircle className="w-3.5 h-3.5" />
      Verified Responsive
    </span>
  );
}
