/**
 * Service configuration mapping URL slugs to decision engine specialty keys,
 * display names, and page content templates.
 */

import type { SpecialtyKey } from "./decision-engine";

export interface ServiceConfig {
  /** URL slug: /[serviceSlug]/[state]/[city] */
  slug: string;
  /** Decision engine specialty_strength key */
  specialtyKey: SpecialtyKey;
  /** Display name for H1, titles */
  displayName: string;
  /** Short pain-point hook for hero section */
  heroHook: string;
  /** Emergency types specific to this service */
  emergencyTypes: { title: string; description: string }[];
  /** FAQ templates — {city}, {state}, {county} are replaced at render time */
  faqTemplates: { question: string; answer: string }[];
}

export const SERVICE_CONFIGS: ServiceConfig[] = [
  {
    slug: "drain-cleaning",
    specialtyKey: "drain",
    displayName: "Drain Cleaning",
    heroHook: "Clogged drain? Here are the top-rated drain cleaning pros near you.",
    emergencyTypes: [
      { title: "Kitchen Drain Clog", description: "Grease buildup, food debris, and soap scum can completely block kitchen drains. A professional snake or hydro-jet clears the line fast." },
      { title: "Main Sewer Line Backup", description: "Multiple drains backing up at once signals a main line problem. This is urgent — sewage can flood your home if not addressed quickly." },
      { title: "Bathroom Drain Blockage", description: "Hair, soap, and mineral buildup in shower and tub drains. Slow drains that don't respond to plunging need professional clearing." },
      { title: "Floor Drain Backup", description: "Basement or laundry room floor drains backing up often indicate a deeper sewer issue that needs camera inspection." },
    ],
    faqTemplates: [
      { question: "How much does drain cleaning cost in {city}, {state}?", answer: "Drain cleaning in {city} typically costs $150-$450 depending on the severity and location of the clog. Main sewer line cleaning runs $200-$600. Hydro-jetting for stubborn blockages can cost $350-$900. Always get a written estimate before work begins." },
      { question: "How long does professional drain cleaning take?", answer: "Most drain cleaning jobs in {county} County take 30 minutes to 2 hours. A simple kitchen or bathroom drain clog can be cleared in under an hour. Main sewer line work or hydro-jetting may take longer, especially if camera inspection is needed first." },
      { question: "When is a clogged drain an emergency?", answer: "A clogged drain is an emergency when sewage is backing up into your home, multiple drains are affected simultaneously, or water is rising and could cause flooding. Single slow drains can usually wait for a same-day appointment." },
      { question: "Can I get same-day drain cleaning in {city}?", answer: "Yes — most drain cleaning pros serving {city} and {county} County offer same-day service. For true emergencies like sewer backups, many can dispatch within 30-60 minutes. Check which plumbers below are rated highest for responsiveness." },
    ],
  },
  {
    slug: "water-heater-repair",
    specialtyKey: "water_heater",
    displayName: "Water Heater Repair",
    heroHook: "No hot water? Find the best water heater repair pros in your area.",
    emergencyTypes: [
      { title: "No Hot Water", description: "Complete loss of hot water from a tank or tankless unit. Could be a failed heating element, thermostat, or gas valve issue." },
      { title: "Leaking Water Heater", description: "Water pooling around the base of your tank is urgent — it can mean a failing tank that could rupture and flood your home." },
      { title: "Strange Noises or Smells", description: "Popping, banging, or rumbling from your water heater signals sediment buildup. A sulfur smell may indicate a failing anode rod or gas leak." },
      { title: "Water Heater Replacement", description: "Units over 10-12 years old that need frequent repairs are usually better replaced. Modern units are more efficient and reliable." },
    ],
    faqTemplates: [
      { question: "How much does water heater repair cost in {city}, {state}?", answer: "Water heater repair in {city} typically costs $150-$500 for common fixes like thermostat or element replacement. Full water heater replacement runs $1,200-$3,500 installed, depending on tank vs tankless and fuel type. Get multiple quotes from plumbers listed below." },
      { question: "Should I repair or replace my water heater?", answer: "If your water heater is over 10 years old and needs a repair costing more than $500, replacement is usually the better investment. Newer models are more energy-efficient and come with warranties. Plumbers in {city} can help you evaluate the best option." },
      { question: "How long does water heater installation take?", answer: "A standard tank water heater replacement takes 2-4 hours. Tankless installations can take 4-8 hours due to additional venting and gas line work. Most plumbers in {county} County can complete same-day installation if the unit is in stock." },
      { question: "Can I get emergency water heater service in {city}?", answer: "Yes — several plumbers serving {city} offer same-day and emergency water heater repair. A leaking tank is urgent and should be addressed immediately to prevent water damage. Check the plumber ratings below for responsiveness scores." },
    ],
  },
  {
    slug: "burst-pipe-repair",
    specialtyKey: "emergency",
    displayName: "Burst Pipe Repair",
    heroHook: "Burst pipe? Shut off your water and call one of these emergency pros.",
    emergencyTypes: [
      { title: "Frozen Pipe Burst", description: "Pipes that freeze and burst can flood your home in minutes. Shut off the main water valve immediately and call an emergency plumber." },
      { title: "Water Line Break", description: "A broken supply line causes flooding fast. Look for water spraying, wet walls, or sudden pressure loss as warning signs." },
      { title: "Slab Leak", description: "Pipes under your foundation can crack and leak silently for weeks. Warm spots on floors, unexplained water bills, or foundation cracks are warning signs." },
      { title: "Pipe Corrosion Failure", description: "Older galvanized or polybutylene pipes can corrode and fail without warning. Discolored water or pinhole leaks signal pipe deterioration." },
    ],
    faqTemplates: [
      { question: "What should I do if a pipe bursts in my {city} home?", answer: "Immediately shut off your main water valve to stop the flow. Turn off electricity to affected areas if water is near outlets or the electrical panel. Move valuables away from water and take photos for insurance. Then call an emergency plumber — most in {city} can arrive within 30-60 minutes." },
      { question: "How much does burst pipe repair cost in {city}, {state}?", answer: "Burst pipe repair in {city} typically costs $200-$1,000 depending on pipe location and accessibility. Pipes behind walls or under slabs cost more to access. Emergency after-hours rates may be 1.5-2x standard pricing. Get a written estimate before authorizing work." },
      { question: "How fast can a plumber get to my {city} home for a burst pipe?", answer: "Most emergency plumbers serving {city} and {county} County aim to arrive within 30-60 minutes for burst pipe calls. This is a true emergency — prioritize plumbers rated highest for responsiveness below." },
      { question: "Does homeowners insurance cover burst pipe repair in {state}?", answer: "Most homeowners insurance policies in {state} cover sudden pipe bursts and resulting water damage. However, damage from gradual leaks or lack of maintenance is typically excluded. Document everything with photos before cleanup begins and contact your insurer promptly." },
    ],
  },
  {
    slug: "repiping",
    specialtyKey: "repipe",
    displayName: "Repiping",
    heroHook: "Aging pipes? Find the best repiping specialists in your area.",
    emergencyTypes: [
      { title: "Whole-House Repipe", description: "Replacing all supply lines in your home with modern copper or PEX. Recommended when you have galvanized pipes with frequent leaks." },
      { title: "Partial Repipe", description: "Replacing specific sections of deteriorated pipe rather than the entire system. A cost-effective option when damage is localized." },
      { title: "Polybutylene Pipe Replacement", description: "Homes built between 1978-1995 may have polybutylene (poly-B) pipes that are prone to sudden failure. Insurance companies may require replacement." },
      { title: "Water Line Replacement", description: "Replacing the main water supply line from the street to your home. Necessary when the line is corroded, leaking, or made of lead." },
    ],
    faqTemplates: [
      { question: "How much does repiping cost in {city}, {state}?", answer: "Whole-house repiping in {city} typically costs $4,000-$15,000 depending on home size, number of fixtures, and pipe material (PEX vs copper). A 1,500 sq ft home averages $5,000-$8,000. Get multiple quotes from the repiping specialists listed below." },
      { question: "How long does a whole-house repipe take?", answer: "A typical whole-house repipe takes 2-5 days depending on home size and accessibility. Most plumbers in {county} County can complete a single-story home in 2-3 days. Two-story homes or those with slab foundations may take longer." },
      { question: "Do I need a permit for repiping in {county} County?", answer: "Yes — repiping work in {county} County requires a plumbing permit and inspection. Your plumber should pull the permit before starting work. Unpermitted plumbing work can create problems when selling your home and may void insurance coverage." },
      { question: "How do I know if my {city} home needs repiping?", answer: "Signs you need repiping include: discolored or rusty water, frequent leaks in different locations, low water pressure throughout the house, and visible pipe corrosion. Homes in {city} built before 1990 with original plumbing are prime candidates for evaluation." },
    ],
  },
  {
    slug: "bathroom-remodel-plumbing",
    specialtyKey: "remodel",
    displayName: "Bathroom Remodel Plumbing",
    heroHook: "Planning a bathroom remodel? Start with the right plumber.",
    emergencyTypes: [
      { title: "Fixture Relocation", description: "Moving sinks, toilets, or tubs requires rerouting supply and drain lines. Proper rough-in work prevents leaks behind finished walls." },
      { title: "Shower/Tub Installation", description: "Installing walk-in showers, freestanding tubs, or converting tub-to-shower requires precise drain placement and waterproofing." },
      { title: "New Bathroom Addition", description: "Adding a bathroom to your home means running new supply and drain lines, often requiring a permit and inspection." },
      { title: "Drain Reconfiguration", description: "Moving drain locations for a new layout requires careful planning to maintain proper slope and venting." },
    ],
    faqTemplates: [
      { question: "How much does bathroom remodel plumbing cost in {city}, {state}?", answer: "Plumbing for a bathroom remodel in {city} typically costs $1,500-$5,000 for fixture replacement in the same location. Moving fixtures or adding new ones can run $3,000-$10,000+. The plumber should be involved early in the design process to avoid costly changes later." },
      { question: "Do I need a separate plumber for a bathroom remodel?", answer: "Yes — your general contractor handles demolition and finishing, but licensed plumbers should handle all pipe work, fixture installation, and drain connections. In {county} County, plumbing work requires a licensed plumber and permit for modifications beyond simple fixture swaps." },
      { question: "How long does remodel plumbing take?", answer: "The plumbing rough-in for a bathroom remodel typically takes 1-3 days. Fixture installation and finish work adds another 1-2 days. Total plumbing involvement is usually 2-5 days spread across the project timeline." },
      { question: "Should I upgrade my pipes during a bathroom remodel in {city}?", answer: "If your {city} home has galvanized or polybutylene pipes, a remodel is the ideal time to upgrade — walls are already open, which significantly reduces labor costs. Ask the remodel plumbers listed below about combining a partial repipe with your renovation." },
    ],
  },
];

/** Map URL slug to config */
export function getServiceConfig(slug: string): ServiceConfig | undefined {
  return SERVICE_CONFIGS.find((s) => s.slug === slug);
}

/** Get all service slugs for generateStaticParams */
export function getAllServiceSlugs(): string[] {
  return SERVICE_CONFIGS.map((s) => s.slug);
}

/** Minimum plumbers with specialty_strength >= this threshold to generate a page */
export const MIN_SPECIALTY_SCORE = 70;
export const MIN_PLUMBERS_FOR_PAGE = 3;
