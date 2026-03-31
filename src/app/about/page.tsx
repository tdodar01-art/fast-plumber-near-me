import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Phone, Target, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Fast Plumber Near Me is an AI-verified emergency plumber directory. We call every listed plumber to verify they actually pick up and show up.",
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-primary text-white py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">About Fast Plumber Near Me</h1>
          <p className="text-lg text-blue-200">
            We&apos;re building the most trustworthy emergency plumber directory in the country.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <div className="prose prose-lg max-w-none">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Problem</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            When you have a plumbing emergency — a burst pipe at 2 AM, a flooded basement, a failed
            water heater in January — you need a plumber who will actually answer the phone and show
            up. But most plumber directories just list every business with a license. They don&apos;t
            tell you who&apos;s actually available, who actually answers emergency calls, or who will
            actually come to your house at midnight.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            We&apos;ve all been there: calling three, four, five plumbers from Google or Yelp, getting
            voicemails, leaving messages that never get returned. Meanwhile, your basement is flooding.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Solution</h2>
          <p className="text-gray-600 leading-relaxed mb-8">
            Fast Plumber Near Me is different. We use AI to periodically call every plumber in our
            directory at random times — including nights, weekends, and holidays. If they answer and
            confirm they&apos;re available for emergencies, their reliability score goes up. If they
            don&apos;t answer, it goes down. Only plumbers who consistently respond to emergency calls
            stay highly ranked in our directory.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            <div className="bg-gray-50 rounded-xl p-6">
              <ShieldCheck className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">AI-Verified</h3>
              <p className="text-sm text-gray-600">
                Every plumber is called by our AI verification system to confirm real emergency
                availability. No pay-to-play, no fake reviews.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <Phone className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Emergency-Focused</h3>
              <p className="text-sm text-gray-600">
                We focus exclusively on emergency plumbing. Not remodeling, not general contracting.
                Just getting you help when you need it most.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <Target className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Local First</h3>
              <p className="text-sm text-gray-600">
                We started in Northern Illinois — McHenry County, Kane County, DuPage County — and
                we&apos;re growing city by city to ensure quality coverage.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <Users className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">People Over Profits</h3>
              <p className="text-sm text-gray-600">
                Our rankings are based on real responsiveness data, not who pays us the most. Free
                listings are available for every qualified plumber.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Who We Are</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Fast Plumber Near Me is operated by Tim Dodaro out of Crystal Lake, Illinois. As a
            local business owner, Tim saw firsthand how difficult it was for homeowners to find
            reliable emergency plumbers — and how frustrating it was for good plumbers to stand out
            from the crowd.
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            This directory was built to solve both problems: help homeowners find plumbers who actually
            show up, and help great plumbers get the calls they deserve.
          </p>

          <div className="bg-primary/5 rounded-xl p-6 sm:p-8">
            <p className="text-gray-700 font-medium mb-4">
              Have questions? Want to get listed? We&apos;d love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Contact Us
              </Link>
              <Link
                href="/add-your-business"
                className="inline-flex items-center justify-center border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                List Your Business
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
