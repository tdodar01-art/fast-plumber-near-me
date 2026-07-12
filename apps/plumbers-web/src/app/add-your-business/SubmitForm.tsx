"use client";

import { useState } from "react";

const serviceOptions = [
  "emergency",
  "water-heater",
  "sewer",
  "drain",
  "gas-line",
  "leak-detection",
  "pipe-repair",
  "toilet-repair",
  "faucet-repair",
  "garbage-disposal",
];

/**
 * Business-submission form (client) — the same /api/submit-business wire as
 * before, restyled onto the rebuild tokens. The surrounding pitch copy lives
 * in the server page.
 */
export default function SubmitForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      businessName: formData.get("businessName") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      website: formData.get("website") as string,
      address: {
        street: formData.get("street") as string,
        city: formData.get("city") as string,
        state: (formData.get("state") as string).toUpperCase(),
        zip: formData.get("zip") as string,
      },
      services: formData.getAll("services") as string[],
      is24Hour: formData.get("is24Hour") === "yes",
      licenseNumber: formData.get("licenseNumber") as string,
    };

    try {
      const res = await fetch("/api/submit-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      alert("Something went wrong. Please try again or reach us through the contact page.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rulebox" role="status">
        <p style={{ marginTop: 0 }}>
          <b>Submission received.</b> Our editors will review your listing and reach out if we
          need anything else. Most listings are reviewed within 1&ndash;2 business days — and the
          assessment you get is the same honest treatment everyone gets.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    fontSize: 15,
    color: "var(--ink)",
    background: "var(--paper)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ink-2)",
    marginBottom: 4,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18, marginTop: 18 }}>
      <div>
        <label htmlFor="businessName" style={labelStyle}>
          Business name *
        </label>
        <input type="text" id="businessName" name="businessName" required style={inputStyle} placeholder="ABC Plumbing" />
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div>
          <label htmlFor="phone" style={labelStyle}>
            Phone number *
          </label>
          <input type="tel" id="phone" name="phone" required style={inputStyle} placeholder="(815) 555-1234" />
        </div>
        <div>
          <label htmlFor="email" style={labelStyle}>
            Email *
          </label>
          <input type="email" id="email" name="email" required style={inputStyle} placeholder="you@yourbusiness.com" />
        </div>
      </div>

      <div>
        <label htmlFor="website" style={labelStyle}>
          Website (optional)
        </label>
        <input type="url" id="website" name="website" style={inputStyle} placeholder="https://yourbusiness.com" />
      </div>

      <div>
        <label htmlFor="licenseNumber" style={labelStyle}>
          License number (optional)
        </label>
        <input type="text" id="licenseNumber" name="licenseNumber" style={inputStyle} placeholder="055-012345" />
      </div>

      <div>
        <p style={labelStyle}>Business address *</p>
        <p className="qualifier" style={{ marginBottom: 8 }}>
          Your listing appears on city guides within 20 miles of your business address.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <input type="text" id="street" name="street" required aria-label="Street address" style={inputStyle} placeholder="123 Main St" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
            <input type="text" id="city" name="city" required aria-label="City" style={inputStyle} placeholder="Crystal Lake" />
            <input
              type="text"
              id="state"
              name="state"
              required
              maxLength={2}
              pattern="[A-Za-z]{2}"
              title="Two-letter state abbreviation"
              aria-label="State"
              style={{ ...inputStyle, textTransform: "uppercase" }}
              placeholder="IL"
            />
            <input
              type="text"
              id="zip"
              name="zip"
              required
              pattern="\d{5}(-\d{4})?"
              title="5-digit ZIP code"
              aria-label="ZIP code"
              style={inputStyle}
              placeholder="60014"
            />
          </div>
        </div>
      </div>

      <div>
        <p style={labelStyle}>Services offered *</p>
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {serviceOptions.map((service) => (
            <label key={service} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink-2)" }}>
              <input type="checkbox" name="services" value={service} />
              {service
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p style={labelStyle}>Do you offer 24/7 emergency service? *</p>
        <div style={{ display: "flex", gap: 18 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink-2)" }}>
            <input type="radio" name="is24Hour" value="yes" required />
            Yes
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink-2)" }}>
            <input type="radio" name="is24Hour" value="no" />
            No
          </label>
        </div>
      </div>

      <button type="submit" disabled={loading} className="call-btn" style={{ border: "none", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
        {loading ? "Submitting…" : "Submit your business — free"}
      </button>

      <p className="qualifier">
        Submissions are reviewed by our editors within 1&ndash;2 business days. By submitting,
        you agree to our <a href="/terms">Terms of Service</a> and{" "}
        <a href="/privacy-policy">Privacy Policy</a>.
      </p>
    </form>
  );
}
