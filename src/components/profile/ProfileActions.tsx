"use client";

import { useState } from "react";
import { Phone, ExternalLink, Flag, ChevronDown } from "lucide-react";

export function CallButton({ phone, plumberId, city }: { phone: string; plumberId: string; city: string }) {
  function handleClick() {
    fetch("/api/track-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plumberId, city, clickType: "call", source: `/plumber/${plumberId}` }),
    }).catch(() => {});
  }

  return (
    <a
      href={`tel:${phone.replace(/\D/g, "")}`}
      onClick={handleClick}
      className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white"
      style={{ backgroundColor: "#0F6E56" }}
    >
      <Phone className="w-4 h-4" />
      Call now
    </a>
  );
}

export function WebsiteButton({ url, plumberId, city }: { url: string; plumberId: string; city: string }) {
  function handleClick() {
    fetch("/api/track-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plumberId, city, clickType: "website", source: `/plumber/${plumberId}` }),
    }).catch(() => {});
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-gray-700 bg-white"
      style={{ border: "1.5px solid #D1D5DB" }}
    >
      <ExternalLink className="w-4 h-4" />
      Website
    </a>
  );
}

export function ProfileReportButton({ plumberId, city }: { plumberId: string; city: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const options = [
    { type: "answered-fast", label: "They answered right away!", positive: true },
    { type: "no-answer", label: "They didn't answer my call", positive: false },
    { type: "bad-number", label: "This number doesn't work", positive: false },
    { type: "seems-closed", label: "This business seems closed", positive: false },
  ] as const;

  function report(type: string) {
    fetch("/api/report-plumber", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plumberId, reportType: type, city }),
    }).catch(() => {});
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); }, 2000);
  }

  return (
    <div className="relative mt-4 text-center">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 transition-colors"
      >
        <Flag className="w-3 h-3" />
        Report an issue
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-10 min-w-[220px]">
          {sent ? (
            <p className="text-xs text-green-600 p-2">Thanks for the feedback!</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.type}
                onClick={() => report(opt.type)}
                className={`block w-full text-left text-xs px-3 py-1.5 rounded hover:bg-gray-50 ${opt.positive ? "text-green-700" : "text-gray-700"}`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
