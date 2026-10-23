"use client";
import { useState } from "react";
import MarketSearch, { type SearchMarket } from "../rebuild/MarketSearch";
import { JOBS } from "@/lib/shortlist";
export default function JobFinder({ markets }: { markets: SearchMarket[] }) {
  const [job, setJob] = useState("any");
  const [urgency, setUrgency] = useState("planned");
  return (
    <div className="job-finder" id="find">
      <div className="finder-top">
        <span className="eyebrow">YOUR NEXT CALL STARTS HERE</span>
        <span className="finder-free">Free. No account needed.</span>
      </div>
      <div className="finder-fields">
        <label>
          01 · What do you need?
          <select value={job} onChange={(e) => setJob(e.target.value)}>
            {JOBS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          02 · When do you need help?
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="planned">I can schedule a visit</option>
            <option value="after-hours">I need an after-hours option</option>
          </select>
        </label>
      </div>
      <label className="finder-location">03 · Where is the job?</label>
      <MarketSearch
        markets={markets}
        routeFragment={`#job=${job}&urgency=${urgency}`}
      />
      <p className="finder-note">
        Your shortlist comes with reasons, reservations, and questions to ask.
      </p>
    </div>
  );
}
