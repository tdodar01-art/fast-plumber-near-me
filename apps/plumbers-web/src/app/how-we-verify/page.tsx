import type { Metadata } from "next";
import { Phone, CheckCircle, TrendingUp, Clock, BarChart3, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "How We Verify Plumbers",
  description:
    "Learn how Fast Plumber Near Me uses AI to call and verify every listed plumber for emergency availability, response time, and reliability.",
};

export default function HowWeVerifyPage() {
  return (
    <>
      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            How We Verify Plumbers
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            We don&apos;t just list plumbers — we call them. Here&apos;s how our AI verification
            system works.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        {/* The problem */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Why Verification Matters
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Most plumber directories are just lists. They tell you a business exists and has a phone
            number. But when you&apos;re standing in two inches of water at midnight, you need to know:
            <strong> Will they actually pick up? Can they actually come right now?</strong>
          </p>
          <p className="text-gray-600 leading-relaxed">
            That&apos;s what our verification system answers. We use AI to call every listed plumber at
            random times — including nights, weekends, and holidays — to confirm they&apos;re truly
            available for emergency service.
          </p>
        </div>

        {/* How it works steps */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            The Verification Process
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">1. We Call Them</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Our AI calls each plumber 2-4 times per month at random times. We mix business hours,
                  evenings, weekends, and even holidays — because that&apos;s when real emergencies happen.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">2. We Ask About Availability</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  When they answer, our AI asks a simple question: &ldquo;If a homeowner had a plumbing
                  emergency right now, could you send someone out today?&rdquo; We also ask about estimated
                  arrival time.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">3. We Score the Results</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Every call result feeds into a reliability score. Did they answer? How fast? Did they
                  confirm availability? How quickly could they arrive? All of this is tracked and weighted.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">4. Rankings Update Automatically</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Plumbers who consistently answer and confirm availability rank higher. Those who
                  don&apos;t answer or say they&apos;re unavailable drop in the rankings. It&apos;s
                  that simple.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scoring breakdown */}
        <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            How the Reliability Score Works
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Answer Rate</span>
                <span className="text-sm text-gray-500">40% weight</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-primary h-3 rounded-full" style={{ width: "40%" }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                What percentage of our verification calls do they answer?
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Availability Confirmed</span>
                <span className="text-sm text-gray-500">30% weight</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-success h-3 rounded-full" style={{ width: "30%" }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                When they answer, do they confirm they can respond to an emergency?
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Response Time</span>
                <span className="text-sm text-gray-500">20% weight</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-warning h-3 rounded-full" style={{ width: "20%" }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                How quickly do they pick up the phone?
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Estimated Arrival</span>
                <span className="text-sm text-gray-500">10% weight</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-accent h-3 rounded-full" style={{ width: "10%" }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                How fast can they get to your location? Faster arrival = better score.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            A minimum of 3 verification calls are required before a score is displayed. Scores decay
            toward neutral if a plumber hasn&apos;t been verified in 30+ days.
          </p>
        </div>

        {/* What makes us different */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            What Makes This Different
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Real-Time Data
              </h3>
              <p className="text-sm text-gray-600">
                Other directories show you who existed 6 months ago. We show you who answered their
                phone this week.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                No Pay-to-Play
              </h3>
              <p className="text-sm text-gray-600">
                Rankings are based on actual responsiveness, not advertising spend. Premium listings
                get visual prominence but can&apos;t buy a higher reliability score.
              </p>
            </div>
          </div>
        </div>

        {/* Trust box */}
        <div className="bg-primary text-white rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold mb-2">
            Transparency is Our Foundation
          </h2>
          <p className="text-blue-200 mb-4">
            We believe homeowners deserve to know which plumbers will actually show up. That&apos;s
            why we publish reliability scores publicly and explain exactly how they&apos;re calculated.
          </p>
          <p className="text-sm text-blue-300">
            Questions about our verification process? Email us at{" "}
            <a href="mailto:info@fastplumbernearme.com" className="text-white underline">
              info@fastplumbernearme.com
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
