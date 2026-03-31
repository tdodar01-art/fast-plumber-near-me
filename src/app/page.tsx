import Link from "next/link";
import { Phone, ShieldCheck, Clock, Search, ArrowRight, CheckCircle, MapPin, Building } from "lucide-react";
import CitySearch from "@/components/CitySearch";
import CallToAction from "@/components/CallToAction";
import { FEATURED_CITIES, CITY_LIST } from "@/lib/city-list";
import { getStatesWithCities, getTotalCityCount } from "@/lib/cities-data";

const featuredCities = FEATURED_CITIES;
const totalCities = getTotalCityCount();
const totalStates = getStatesWithCities().length;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-dark to-primary text-white py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4">
            Find a Reliable Emergency Plumber
            <span className="text-accent-light"> — Right Now</span>
          </h1>
          <p className="text-lg sm:text-xl text-blue-200 max-w-2xl mx-auto mb-8">
            We don&apos;t just list plumbers — we call them to verify they actually pick up
            the phone and show up. Find 24/7 emergency plumbers you can trust.
          </p>
          <CitySearch />
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-blue-300">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {totalCities} cities
            </span>
            <span className="flex items-center gap-1.5">
              <Building className="w-4 h-4" />
              {totalStates} states
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">1. Search Your City</h3>
              <p className="text-gray-600">
                Enter your city or zip code to find emergency plumbers in your area.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">2. See Verified Plumbers</h3>
              <p className="text-gray-600">
                Every plumber is AI-verified. We call them to confirm they&apos;re actually available
                for emergency service.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">3. Call Now</h3>
              <p className="text-gray-600">
                Tap to call a verified plumber who will actually pick up and come help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
              <span className="font-semibold text-gray-900">AI-Verified Plumbers</span>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <Clock className="w-6 h-6 text-primary flex-shrink-0" />
              <span className="font-semibold text-gray-900">24/7 Emergency Service</span>
            </div>
            <div className="flex items-center gap-3 justify-center sm:justify-end">
              <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0" />
              <span className="font-semibold text-gray-900">Licensed &amp; Insured</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Cities */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-4">
            Emergency Plumbers by City
          </h2>
          <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
            Select your city to see verified emergency plumbers ready to help right now.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {featuredCities.map((city) => (
              <Link
                key={`${city.stateSlug}-${city.citySlug}`}
                href={`/emergency-plumbers/${city.stateSlug}/${city.citySlug}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-primary hover:bg-blue-50 transition-colors group"
              >
                <span className="font-medium text-gray-900 text-sm">
                  {city.name}, {city.state}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/emergency-plumbers"
              className="text-primary hover:text-primary-dark font-semibold inline-flex items-center gap-1 transition-colors"
            >
              View All Cities <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            Why Fast Plumber Near Me?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">We Actually Call Them</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Unlike other directories, we use AI to periodically call every listed plumber at random
                times — including nights and weekends. If they don&apos;t answer, their score drops. Only
                responsive plumbers stay listed.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">Real Reliability Scores</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Every plumber gets a reliability score based on how often they answer, how fast they
                respond, and whether they confirm they can come help. No pay-to-play rankings.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">Emergency-Focused</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                We&apos;re not a general contractor directory. We focus exclusively on emergency
                plumbing — burst pipes, water heater failures, sewer backups, and drain emergencies.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">Click and Call</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                No accounts, no forms, no waiting for quotes. Find a plumber, tap the call button,
                and get help. That&apos;s it. When your basement is flooding, every second counts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CallToAction />
    </>
  );
}
