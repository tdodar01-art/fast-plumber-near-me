"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

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

const cityOptions = [
  "crystal-lake-il",
  "mchenry-il",
  "algonquin-il",
  "lake-in-the-hills-il",
  "huntley-il",
  "woodstock-il",
  "cary-il",
  "elgin-il",
  "south-elgin-il",
  "st-charles-il",
  "geneva-il",
  "batavia-il",
  "aurora-il",
  "naperville-il",
  "wheaton-il",
  "schaumburg-il",
  "arlington-heights-il",
  "carpentersville-il",
  "marengo-il",
  "harvard-il",
];

function formatSlug(slug: string) {
  return slug
    .replace(/-il$/, ", IL")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function AddYourBusinessPage() {
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
      serviceCities: formData.getAll("serviceCities") as string[],
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
      alert("Something went wrong. Please try again or email us directly.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Submission Received!</h1>
        <p className="text-gray-600">
          Thank you for submitting your business. Our team will review your listing and reach out
          if we need any additional information. Most listings are reviewed within 1-2 business days.
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">List Your Plumbing Business</h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Get found by homeowners with plumbing emergencies in your service area. Free basic
            listings available.
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business info */}
          <div>
            <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
              Business Name *
            </label>
            <input
              type="text"
              id="businessName"
              name="businessName"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:outline-none text-gray-900"
              placeholder="ABC Emergency Plumbing"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:outline-none text-gray-900"
                placeholder="(815) 555-1234"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:outline-none text-gray-900"
                placeholder="you@yourbusiness.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
              Website (optional)
            </label>
            <input
              type="url"
              id="website"
              name="website"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:outline-none text-gray-900"
              placeholder="https://yourbusiness.com"
            />
          </div>

          <div>
            <label htmlFor="licenseNumber" className="block text-sm font-medium text-gray-700 mb-1">
              License Number (optional)
            </label>
            <input
              type="text"
              id="licenseNumber"
              name="licenseNumber"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:outline-none text-gray-900"
              placeholder="055-012345"
            />
          </div>

          {/* Service areas */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Service Areas *</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cityOptions.map((city) => (
                <label key={city} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="serviceCities"
                    value={city}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  {formatSlug(city)}
                </label>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Services Offered *</p>
            <div className="grid grid-cols-2 gap-2">
              {serviceOptions.map((service) => (
                <label key={service} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="services"
                    value={service}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  {service
                    .split("-")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </label>
              ))}
            </div>
          </div>

          {/* 24/7 */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              Do you offer 24/7 emergency service? *
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="is24Hour"
                  value="yes"
                  required
                  className="text-primary focus:ring-primary"
                />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="is24Hour"
                  value="no"
                  className="text-primary focus:ring-primary"
                />
                No
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dark text-white font-bold py-3.5 px-6 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Your Business"
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Submissions are reviewed by our team within 1-2 business days. By submitting, you agree
            to our{" "}
            <a href="/terms" className="text-primary underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy-policy" className="text-primary underline">
              Privacy Policy
            </a>
            .
          </p>
        </form>
      </div>
    </>
  );
}
