import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Clock, AlertTriangle, ArrowRight, Phone, HelpCircle } from "lucide-react";
import PlumberCard from "@/components/PlumberCard";
import CallToAction from "@/components/CallToAction";
import type { Plumber } from "@/lib/types";

// Static city data for build-time generation (will be replaced by Firestore fetch later)
const CITY_DATA: Record<
  string,
  {
    name: string;
    state: string;
    county: string;
    heroContent: string;
    nearbyCities: { name: string; slug: string }[];
  }
> = {
  "crystal-lake-il": {
    name: "Crystal Lake",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Crystal Lake is the largest city in McHenry County, with older homes and aging plumbing infrastructure that can lead to emergencies — especially during harsh Illinois winters. Frozen pipes, water heater failures, and sewer backups are common issues for Crystal Lake homeowners. Our verified plumbers serve all Crystal Lake neighborhoods including downtown, the lake area, and surrounding subdivisions.",
    nearbyCities: [
      { name: "McHenry", slug: "mchenry-il" },
      { name: "Algonquin", slug: "algonquin-il" },
      { name: "Lake in the Hills", slug: "lake-in-the-hills-il" },
      { name: "Cary", slug: "cary-il" },
      { name: "Woodstock", slug: "woodstock-il" },
    ],
  },
  "mchenry-il": {
    name: "McHenry",
    state: "IL",
    county: "McHenry",
    heroContent:
      "McHenry residents know that plumbing emergencies don't wait for business hours. With the Fox River running through town and seasonal temperature swings, pipes can freeze, burst, or back up at any time. Our AI-verified plumbers in McHenry are confirmed to be available for emergency calls — day or night.",
    nearbyCities: [
      { name: "Crystal Lake", slug: "crystal-lake-il" },
      { name: "Woodstock", slug: "woodstock-il" },
      { name: "Huntley", slug: "huntley-il" },
      { name: "Lake in the Hills", slug: "lake-in-the-hills-il" },
    ],
  },
  "algonquin-il": {
    name: "Algonquin",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Algonquin is a rapidly growing community straddling McHenry and Kane counties. With a mix of newer construction and established neighborhoods, plumbing emergencies range from slab leaks to water heater failures. Our verified Algonquin plumbers are ready to respond to your emergency around the clock.",
    nearbyCities: [
      { name: "Crystal Lake", slug: "crystal-lake-il" },
      { name: "Lake in the Hills", slug: "lake-in-the-hills-il" },
      { name: "Carpentersville", slug: "carpentersville-il" },
      { name: "Huntley", slug: "huntley-il" },
    ],
  },
  "lake-in-the-hills-il": {
    name: "Lake in the Hills",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Lake in the Hills is a vibrant community in McHenry County with many homes built in the 1990s and 2000s. As these homes age, plumbing issues become more common — from water heater failures to drain clogs and pipe leaks. Our verified plumbers in Lake in the Hills are confirmed available for emergency calls.",
    nearbyCities: [
      { name: "Crystal Lake", slug: "crystal-lake-il" },
      { name: "Algonquin", slug: "algonquin-il" },
      { name: "Huntley", slug: "huntley-il" },
      { name: "Cary", slug: "cary-il" },
    ],
  },
  "huntley-il": {
    name: "Huntley",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Huntley has been one of the fastest-growing communities in the Chicago suburbs. With rapid development comes a need for reliable emergency plumbing services. Whether you're in the Del Webb community or the newer subdivisions off Route 47, our verified plumbers can be there when you need them.",
    nearbyCities: [
      { name: "Crystal Lake", slug: "crystal-lake-il" },
      { name: "Lake in the Hills", slug: "lake-in-the-hills-il" },
      { name: "Algonquin", slug: "algonquin-il" },
      { name: "Woodstock", slug: "woodstock-il" },
    ],
  },
  "woodstock-il": {
    name: "Woodstock",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Woodstock, the McHenry County seat and home of the famous Groundhog Day square, has many historic homes with aging plumbing systems. Frozen pipes in winter and sewer issues are common concerns. Our verified emergency plumbers serving Woodstock are available 24/7 to handle any plumbing crisis.",
    nearbyCities: [
      { name: "Crystal Lake", slug: "crystal-lake-il" },
      { name: "McHenry", slug: "mchenry-il" },
      { name: "Huntley", slug: "huntley-il" },
      { name: "Harvard", slug: "harvard-il" },
      { name: "Marengo", slug: "marengo-il" },
    ],
  },
  "cary-il": {
    name: "Cary",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Cary is a charming village nestled along the Fox River in McHenry County. With many homes dating back several decades, plumbing emergencies like burst pipes, water heater failures, and sewer line problems can strike without warning. Our verified Cary plumbers are just a call away.",
    nearbyCities: [
      { name: "Crystal Lake", slug: "crystal-lake-il" },
      { name: "Algonquin", slug: "algonquin-il" },
      { name: "Lake in the Hills", slug: "lake-in-the-hills-il" },
    ],
  },
  "elgin-il": {
    name: "Elgin",
    state: "IL",
    county: "Kane",
    heroContent:
      "Elgin is one of the largest cities in the Fox Valley, with a diverse housing stock ranging from historic Victorian homes to modern developments. Aging pipes, sewer issues, and water heater emergencies are everyday realities for Elgin homeowners. Find a verified emergency plumber in Elgin who will actually answer your call.",
    nearbyCities: [
      { name: "South Elgin", slug: "south-elgin-il" },
      { name: "Carpentersville", slug: "carpentersville-il" },
      { name: "St. Charles", slug: "st-charles-il" },
      { name: "Schaumburg", slug: "schaumburg-il" },
    ],
  },
  "naperville-il": {
    name: "Naperville",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Naperville is consistently ranked as one of the best places to live in Illinois, but even great cities have plumbing emergencies. From the historic downtown to newer communities along Route 59, water heater failures, burst pipes, and drain backups can happen anytime. Our AI-verified plumbers in Naperville are confirmed responsive.",
    nearbyCities: [
      { name: "Aurora", slug: "aurora-il" },
      { name: "Wheaton", slug: "wheaton-il" },
      { name: "Geneva", slug: "geneva-il" },
      { name: "Batavia", slug: "batavia-il" },
    ],
  },
  "schaumburg-il": {
    name: "Schaumburg",
    state: "IL",
    county: "Cook",
    heroContent:
      "Schaumburg is a major suburban hub in Cook County with thousands of homes and businesses that depend on reliable plumbing. Whether you're near Woodfield Mall or in one of the many residential neighborhoods, plumbing emergencies demand fast response. Our verified Schaumburg plumbers are tested for responsiveness.",
    nearbyCities: [
      { name: "Arlington Heights", slug: "arlington-heights-il" },
      { name: "Elgin", slug: "elgin-il" },
      { name: "Wheaton", slug: "wheaton-il" },
    ],
  },
  "aurora-il": {
    name: "Aurora",
    state: "IL",
    county: "Kane",
    heroContent:
      "Aurora is the second-largest city in Illinois, spanning four counties with a vast range of housing. From older east-side homes to new construction on the far west side, plumbing emergencies are a constant. Our AI-verified emergency plumbers serving Aurora are confirmed to answer calls and dispatch quickly.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Batavia", slug: "batavia-il" },
      { name: "Geneva", slug: "geneva-il" },
      { name: "South Elgin", slug: "south-elgin-il" },
    ],
  },
  "arlington-heights-il": {
    name: "Arlington Heights",
    state: "IL",
    county: "Cook",
    heroContent:
      "Arlington Heights is one of the largest villages in Illinois, with a mix of mid-century homes and newer developments. Aging plumbing systems in older neighborhoods mean burst pipes, water heater failures, and sewer problems are common. Our verified plumbers in Arlington Heights are ready 24/7.",
    nearbyCities: [
      { name: "Schaumburg", slug: "schaumburg-il" },
      { name: "Wheaton", slug: "wheaton-il" },
      { name: "Elgin", slug: "elgin-il" },
    ],
  },
  "south-elgin-il": {
    name: "South Elgin",
    state: "IL",
    county: "Kane",
    heroContent:
      "South Elgin is a growing community along the Fox River in Kane County. With a mix of established and newer neighborhoods, plumbing issues can range from aging pipe failures to new construction settling problems. Our verified emergency plumbers are ready to respond.",
    nearbyCities: [
      { name: "Elgin", slug: "elgin-il" },
      { name: "St. Charles", slug: "st-charles-il" },
      { name: "Geneva", slug: "geneva-il" },
      { name: "Carpentersville", slug: "carpentersville-il" },
    ],
  },
  "st-charles-il": {
    name: "St. Charles",
    state: "IL",
    county: "Kane",
    heroContent:
      "St. Charles is a picturesque Fox River community with historic homes and modern developments alike. Plumbing emergencies from frozen pipes to sewer backups don't wait for business hours. Our AI-verified St. Charles plumbers are confirmed available for emergency service.",
    nearbyCities: [
      { name: "Geneva", slug: "geneva-il" },
      { name: "South Elgin", slug: "south-elgin-il" },
      { name: "Batavia", slug: "batavia-il" },
      { name: "Elgin", slug: "elgin-il" },
    ],
  },
  "geneva-il": {
    name: "Geneva",
    state: "IL",
    county: "Kane",
    heroContent:
      "Geneva is a charming Fox River community known for its historic Third Street shopping district and beautiful homes. Many of these older homes have plumbing systems that need emergency attention. Our verified emergency plumbers serving Geneva are tested for fast response times.",
    nearbyCities: [
      { name: "St. Charles", slug: "st-charles-il" },
      { name: "Batavia", slug: "batavia-il" },
      { name: "Naperville", slug: "naperville-il" },
    ],
  },
  "batavia-il": {
    name: "Batavia",
    state: "IL",
    county: "Kane",
    heroContent:
      "Batavia, the oldest city in Kane County, features homes spanning over a century of construction. This means a wide variety of plumbing systems — and potential emergencies. Our AI-verified plumbers serving Batavia are ready to handle everything from burst pipes to complete sewer line failures.",
    nearbyCities: [
      { name: "Geneva", slug: "geneva-il" },
      { name: "Aurora", slug: "aurora-il" },
      { name: "St. Charles", slug: "st-charles-il" },
      { name: "Naperville", slug: "naperville-il" },
    ],
  },
  "wheaton-il": {
    name: "Wheaton",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Wheaton is the DuPage County seat, home to beautiful tree-lined neighborhoods and a vibrant downtown. Many homes in Wheaton have older plumbing that's prone to emergencies, especially during winter freezes. Our verified plumbers are confirmed responsive to emergency calls in Wheaton.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Schaumburg", slug: "schaumburg-il" },
      { name: "Geneva", slug: "geneva-il" },
    ],
  },
  "marengo-il": {
    name: "Marengo",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Marengo is a small but growing community in western McHenry County. With many older homes and rural properties, plumbing emergencies can be especially stressful when help seems far away. Our verified emergency plumbers serve the Marengo area and are confirmed to respond quickly.",
    nearbyCities: [
      { name: "Woodstock", slug: "woodstock-il" },
      { name: "Harvard", slug: "harvard-il" },
      { name: "Huntley", slug: "huntley-il" },
    ],
  },
  "harvard-il": {
    name: "Harvard",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Harvard sits at the northern edge of McHenry County near the Wisconsin border. Finding a reliable emergency plumber in this area can be challenging due to the rural surroundings. Our AI-verified plumbers serving Harvard are confirmed to respond to emergency calls.",
    nearbyCities: [
      { name: "Woodstock", slug: "woodstock-il" },
      { name: "Marengo", slug: "marengo-il" },
    ],
  },
  "carpentersville-il": {
    name: "Carpentersville",
    state: "IL",
    county: "Kane",
    heroContent:
      "Carpentersville is a diverse community along the Fox River with housing ranging from affordable to upscale. Plumbing emergencies don't discriminate by neighborhood — burst pipes and water heater failures can happen anywhere. Our verified plumbers serving Carpentersville are ready 24/7.",
    nearbyCities: [
      { name: "Algonquin", slug: "algonquin-il" },
      { name: "Elgin", slug: "elgin-il" },
      { name: "South Elgin", slug: "south-elgin-il" },
    ],
  },
};

// Sample plumber data for initial build (will come from Firestore)
function getSamplePlumbers(citySlug: string): Plumber[] {
  const cityName = CITY_DATA[citySlug]?.name || "Your City";
  return [
    {
      id: "sample-1",
      businessName: `${cityName} Emergency Plumbing`,
      ownerName: "John Smith",
      phone: "(815) 555-0101",
      website: "https://example.com",
      email: null,
      address: { street: "", city: cityName, state: "IL", zip: "", lat: 0, lng: 0 },
      serviceCities: [citySlug],
      services: ["emergency", "water-heater", "sewer", "drain"],
      is24Hour: true,
      licenseNumber: "055-012345",
      insured: true,
      yearsInBusiness: 15,
      verificationStatus: "verified",
      reliabilityScore: 94,
      lastVerifiedAt: null,
      totalCallAttempts: 12,
      totalCallAnswered: 11,
      answerRate: 92,
      avgResponseTime: 8,
      listingTier: "featured",
      googleRating: 4.8,
      googleReviewCount: 127,
      yelpRating: 4.5,
      isActive: true,
      createdAt: null as unknown as import("firebase/firestore").Timestamp,
      updatedAt: null as unknown as import("firebase/firestore").Timestamp,
      notes: "",
    },
    {
      id: "sample-2",
      businessName: "Fox Valley Plumbing & Drain",
      ownerName: "Mike Johnson",
      phone: "(815) 555-0102",
      website: null,
      email: null,
      address: { street: "", city: cityName, state: "IL", zip: "", lat: 0, lng: 0 },
      serviceCities: [citySlug],
      services: ["emergency", "drain", "sewer"],
      is24Hour: true,
      licenseNumber: "055-067890",
      insured: true,
      yearsInBusiness: 8,
      verificationStatus: "verified",
      reliabilityScore: 87,
      lastVerifiedAt: null,
      totalCallAttempts: 8,
      totalCallAnswered: 7,
      answerRate: 88,
      avgResponseTime: 12,
      listingTier: "premium",
      googleRating: 4.6,
      googleReviewCount: 89,
      yelpRating: 4.0,
      isActive: true,
      createdAt: null as unknown as import("firebase/firestore").Timestamp,
      updatedAt: null as unknown as import("firebase/firestore").Timestamp,
      notes: "",
    },
    {
      id: "sample-3",
      businessName: "Rapid Response Plumbing",
      ownerName: "Dave Williams",
      phone: "(847) 555-0103",
      website: null,
      email: null,
      address: { street: "", city: cityName, state: "IL", zip: "", lat: 0, lng: 0 },
      serviceCities: [citySlug],
      services: ["emergency", "water-heater", "drain"],
      is24Hour: false,
      licenseNumber: null,
      insured: true,
      yearsInBusiness: 5,
      verificationStatus: "unverified",
      reliabilityScore: 0,
      lastVerifiedAt: null,
      totalCallAttempts: 0,
      totalCallAnswered: 0,
      answerRate: 0,
      avgResponseTime: 0,
      listingTier: "free",
      googleRating: 4.2,
      googleReviewCount: 34,
      yelpRating: null,
      isActive: true,
      createdAt: null as unknown as import("firebase/firestore").Timestamp,
      updatedAt: null as unknown as import("firebase/firestore").Timestamp,
      notes: "",
    },
  ];
}

export function generateStaticParams() {
  return Object.keys(CITY_DATA).map((cityState) => ({ cityState }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cityState: string }>;
}): Promise<Metadata> {
  const { cityState } = await params;
  const city = CITY_DATA[cityState];
  if (!city) return {};

  return {
    title: `Emergency Plumbers in ${city.name}, ${city.state} — 24/7 Verified`,
    description: `Find verified 24/7 emergency plumbers in ${city.name}, ${city.state}. AI-verified for responsiveness. Burst pipes, water heaters, sewers & drains. Call now.`,
    openGraph: {
      title: `Emergency Plumbers in ${city.name}, ${city.state}`,
      description: `Verified 24/7 emergency plumbers in ${city.name}. We call them so you don't have to wonder if they'll pick up.`,
    },
  };
}

const emergencyTypes = [
  {
    title: "Burst or Frozen Pipes",
    description:
      "A burst pipe can flood your home in minutes. Shut off your main water valve and call an emergency plumber immediately.",
  },
  {
    title: "Water Heater Failure",
    description:
      "No hot water, leaking tank, or strange noises from your water heater? Emergency plumbers can diagnose and repair or replace your unit fast.",
  },
  {
    title: "Sewer Line Backup",
    description:
      "Sewage backing up into your home is a health hazard. Emergency plumbers have the equipment to clear blockages and repair damaged sewer lines.",
  },
  {
    title: "Clogged Drains",
    description:
      "When plunging doesn't work and water won't drain, professional emergency drain cleaning can resolve even the toughest blockages.",
  },
  {
    title: "Gas Line Issues",
    description:
      "If you smell gas, evacuate immediately and call 911 first. Then call a licensed plumber for gas line repair.",
  },
];

const faqs = [
  {
    question: "How much does an emergency plumber cost?",
    answer:
      "Emergency plumber rates vary but typically range from $150-$300 for the service call, plus parts and labor. After-hours and weekend calls may cost more. Always ask for an estimate before work begins.",
  },
  {
    question: "What should I do while waiting for the plumber?",
    answer:
      "Shut off the main water valve to stop water flow. If there's standing water, turn off electricity to affected areas. Move valuables away from water. Take photos for insurance purposes.",
  },
  {
    question: "How quickly can an emergency plumber arrive?",
    answer:
      "Most emergency plumbers aim to arrive within 30-60 minutes. Our verified plumbers are tested for response time and confirmed to dispatch quickly.",
  },
  {
    question: "Should I attempt DIY plumbing repairs in an emergency?",
    answer:
      "Only take immediate steps like shutting off water valves. DIY repairs on pressurized water lines or sewer systems can make the problem worse and void insurance claims.",
  },
];

export default async function CityPage({
  params,
}: {
  params: Promise<{ cityState: string }>;
}) {
  const { cityState } = await params;
  const city = CITY_DATA[cityState];
  if (!city) notFound();

  // In production, this will fetch from Firestore:
  // const plumbers = await getPlumbersByCity(cityState);
  const plumbers = getSamplePlumbers(cityState);

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Emergency Plumbers in ${city.name}, ${city.state}`,
    description: `Verified emergency plumbers serving ${city.name}, ${city.state}`,
    itemListElement: plumbers.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Plumber",
        name: p.businessName,
        telephone: p.phone,
        address: {
          "@type": "PostalAddress",
          addressLocality: city.name,
          addressRegion: city.state,
        },
        ...(p.googleRating && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.googleRating,
            reviewCount: p.googleReviewCount,
          },
        }),
      },
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="bg-primary text-white py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 text-blue-300 text-sm mb-2">
            <Link href="/emergency-plumbers" className="hover:text-white transition-colors">
              All Cities
            </Link>
            <span>/</span>
            <span>
              {city.name}, {city.state}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
            Emergency Plumbers in {city.name}, {city.state}
          </h1>
          <p className="text-lg text-blue-200">
            Verified 24/7 plumbers ready to help right now
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-blue-300">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {city.county} County
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {plumbers.length} plumber{plumbers.length !== 1 ? "s" : ""} available
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Plumber listings */}
        <div className="space-y-4 mb-12">
          {plumbers.map((plumber) => (
            <PlumberCard key={plumber.id} plumber={plumber} citySlug={cityState} />
          ))}
        </div>

        {/* City-specific content */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            About Emergency Plumbing in {city.name}
          </h2>
          <p className="text-gray-600 leading-relaxed">{city.heroContent}</p>
        </section>

        {/* Emergency types */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Common Plumbing Emergencies in {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {emergencyTypes.map((emergency) => (
              <div
                key={emergency.title}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-accent" />
                  {emergency.title}
                </h3>
                <p className="text-sm text-gray-600">{emergency.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="bg-white border border-gray-200 rounded-xl group"
              >
                <summary className="flex items-center justify-between cursor-pointer p-5 font-semibold text-gray-900">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    {faq.question}
                  </span>
                </summary>
                <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed -mt-1">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Nearby cities */}
        {city.nearbyCities.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Nearby Cities
            </h2>
            <div className="flex flex-wrap gap-2">
              {city.nearbyCities.map((nearby) => (
                <Link
                  key={nearby.slug}
                  href={`/emergency-plumbers/${nearby.slug}`}
                  className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary transition-colors"
                >
                  {nearby.name} <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Emergency CTA */}
        <div className="bg-accent/5 border-2 border-accent/20 rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Plumbing Emergency Right Now?
          </h2>
          <p className="text-gray-600 mb-4">
            Don&apos;t wait — call a verified plumber in {city.name} immediately.
          </p>
          <a
            href={`tel:${plumbers[0]?.phone || "(815) 555-0101"}`}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-4 px-8 rounded-xl text-lg transition-colors shadow-lg shadow-accent/25"
          >
            <Phone className="w-5 h-5" />
            Call Top-Rated Plumber Now
          </a>
        </div>
      </div>

      <CallToAction />
    </>
  );
}
