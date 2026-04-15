/**
 * Service/page registry — single source of truth for all URL slugs,
 * scoring strategies, and page content templates.
 *
 * Adding a new page = adding one entry to PAGE_CONFIGS.
 * If it shares an existing specialty key, zero pipeline changes.
 */

import type { SpecialtyKey, DimensionKey } from "./decision-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageType = "service" | "symptom" | "intent";

export type ScoringStrategy =
  | { kind: "specialty"; key: SpecialtyKey }
  | { kind: "dimension"; sortBy: DimensionKey }
  | { kind: "signal"; field: string; value: unknown }
  | { kind: "mapped"; serviceKeys: SpecialtyKey[] };

export interface PageConfig {
  /** Unique ID — matches URL slug */
  slug: string;
  type: PageType;
  /** Decision engine scoring strategy */
  scoring: ScoringStrategy;
  /** Display name for H1, titles */
  displayName: string;
  /** Short pain-point hook for hero section */
  heroHook: string;
  /** Bridge to outscraper servicesMentioned data (16 categories) */
  serviceMentionedKeys: string[];
  /** Emergency/scenario types specific to this page */
  emergencyTypes: { title: string; description: string }[];
  /** FAQ templates — {city}, {state}, {county} are replaced at render time */
  faqTemplates: { question: string; answer: string }[];
  /** Related page slugs for cross-linking */
  relatedServices: string[];
}

// ---------------------------------------------------------------------------
// Legacy compat — re-export old types so existing imports still work
// ---------------------------------------------------------------------------

export type ServiceConfig = PageConfig;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum specialty score for Tier 1 rendering */
export const MIN_SPECIALTY_SCORE = 70;

/** Minimum plumbers needed to render a full page (below this: noindex) */
export const MIN_PLUMBERS_FOR_PAGE = 3;

/** Maximum plumbers displayed on a service page (prevents spammy listings) */
export const MAX_PLUMBERS_PER_PAGE = 15;

// ---------------------------------------------------------------------------
// Registry: 27 entries (16 service + 5 intent + 6 symptom)
// ---------------------------------------------------------------------------

export const PAGE_CONFIGS: PageConfig[] = [
  // =========================================================================
  // SERVICE PAGES (16)
  // =========================================================================

  {
    slug: "drain-cleaning",
    type: "service",
    scoring: { kind: "specialty", key: "drain" },
    displayName: "Drain Cleaning",
    heroHook: "Clogged drain? Here are the top-rated drain cleaning pros near you.",
    serviceMentionedKeys: ["drain-cleaning"],
    relatedServices: ["hydro-jetting", "sewer-repair"],
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
    type: "service",
    scoring: { kind: "specialty", key: "water_heater" },
    displayName: "Water Heater Repair",
    heroHook: "No hot water? Find the best water heater repair pros in your area.",
    serviceMentionedKeys: ["water-heater"],
    relatedServices: ["gas-line-repair", "repiping"],
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
    type: "service",
    scoring: { kind: "specialty", key: "emergency" },
    displayName: "Burst Pipe Repair",
    heroHook: "Burst pipe? Shut off your water and call one of these emergency pros.",
    serviceMentionedKeys: ["burst-pipe", "flooding"],
    relatedServices: ["water-line-repair", "repiping"],
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
    type: "service",
    scoring: { kind: "specialty", key: "repipe" },
    displayName: "Repiping",
    heroHook: "Aging pipes? Find the best repiping specialists in your area.",
    serviceMentionedKeys: ["repiping"],
    relatedServices: ["water-line-repair", "slab-leak-repair"],
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
    type: "service",
    scoring: { kind: "specialty", key: "remodel" },
    displayName: "Bathroom Remodel Plumbing",
    heroHook: "Planning a bathroom remodel? Start with the right plumber.",
    serviceMentionedKeys: ["bathroom-remodel"],
    relatedServices: ["toilet-repair", "faucet-repair"],
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

  {
    slug: "sewer-repair",
    type: "service",
    scoring: { kind: "specialty", key: "sewer" },
    displayName: "Sewer Repair",
    heroHook: "Sewer problems? Find trusted sewer repair pros near you.",
    serviceMentionedKeys: ["sewer"],
    relatedServices: ["drain-cleaning", "sewer-line-replacement"],
    emergencyTypes: [
      { title: "Sewer Line Clog", description: "Tree roots, grease buildup, or collapsed sections can block your main sewer line. Multiple drains backing up at once is the telltale sign." },
      { title: "Sewer Line Break", description: "A broken sewer line causes sewage to leak into your yard or foundation. Foul odors, soggy patches, or unusually green grass over the line are warnings." },
      { title: "Bellied Sewer Pipe", description: "A section of pipe that has sunk creates a low spot where waste collects. Camera inspection identifies the location and severity." },
      { title: "Root Intrusion", description: "Tree roots seek out sewer line moisture and can crack or infiltrate pipes. Regular root cutting or pipe lining prevents full blockages." },
    ],
    faqTemplates: [
      { question: "How much does sewer repair cost in {city}, {state}?", answer: "Sewer repair in {city} ranges from $1,000-$4,000 for spot repairs to $3,000-$25,000 for full sewer line replacement. Trenchless methods (pipe lining, pipe bursting) often cost $4,000-$10,000 and avoid digging up your yard. Get a camera inspection quote first." },
      { question: "How do I know if my sewer line needs repair?", answer: "Warning signs include: multiple drains backing up simultaneously, gurgling sounds from toilets, sewage odors in your yard, soggy patches or sinkholes near the sewer line, and unexplained increases in your water bill." },
      { question: "What is trenchless sewer repair?", answer: "Trenchless methods repair or replace your sewer line without digging a trench through your yard. Pipe lining inserts a resin-coated liner inside the existing pipe; pipe bursting pulls a new pipe through while breaking the old one apart. Both minimize landscaping damage." },
      { question: "Does homeowners insurance cover sewer repair in {state}?", answer: "Standard homeowners insurance in {state} typically does NOT cover sewer line repair or replacement. Some insurers offer separate sewer line coverage as a rider for $5-15/month. Check with your agent — it's worth adding if your home has older sewer lines." },
    ],
  },

  {
    slug: "sewer-line-replacement",
    type: "service",
    scoring: { kind: "specialty", key: "sewer" },
    displayName: "Sewer Line Replacement",
    heroHook: "Need a full sewer line replacement? Compare top-rated pros.",
    serviceMentionedKeys: ["sewer"],
    relatedServices: ["sewer-repair", "repiping"],
    emergencyTypes: [
      { title: "Full Sewer Line Replacement", description: "When the entire sewer line from your home to the street needs replacing due to age, material failure, or extensive damage." },
      { title: "Trenchless Pipe Bursting", description: "A new pipe is pulled through the old one, breaking it apart. Minimal yard disruption compared to traditional excavation." },
      { title: "Cured-in-Place Pipe Lining", description: "An epoxy-coated liner is inserted and cured inside the existing pipe, creating a new pipe within the old one." },
      { title: "Conventional Excavation", description: "The traditional method: dig a trench, remove the old pipe, lay a new one. Sometimes the only option for severely collapsed lines." },
    ],
    faqTemplates: [
      { question: "How much does sewer line replacement cost in {city}, {state}?", answer: "Full sewer line replacement in {city} typically costs $3,000-$25,000. Trenchless methods run $4,000-$10,000 on average. Traditional excavation with yard restoration can exceed $15,000. Length of the line, depth, and access all affect pricing." },
      { question: "How long does sewer line replacement take?", answer: "Trenchless sewer replacement typically takes 1-2 days. Traditional excavation takes 3-5 days plus yard restoration time. Most plumbers in {county} County can start within a week of the initial inspection." },
      { question: "Is trenchless sewer replacement worth it in {city}?", answer: "Trenchless is usually worth it if your yard has landscaping, driveways, or structures over the sewer line. It costs more than basic excavation but saves thousands in restoration. Ask the pros below for a comparison quote." },
      { question: "Do I need a permit for sewer line replacement in {county} County?", answer: "Yes — sewer line replacement in {county} County requires a plumbing permit and inspection. Your plumber should handle the permit. Unpermitted work can cause problems when selling and may void insurance claims." },
    ],
  },

  {
    slug: "toilet-repair",
    type: "service",
    scoring: { kind: "specialty", key: "toilet" },
    displayName: "Toilet Repair",
    heroHook: "Toilet running or leaking? Find reliable toilet repair pros.",
    serviceMentionedKeys: ["toilet"],
    relatedServices: ["drain-cleaning", "bathroom-remodel-plumbing"],
    emergencyTypes: [
      { title: "Running Toilet", description: "A toilet that won't stop running wastes 200+ gallons per day. Usually caused by a worn flapper, faulty fill valve, or float adjustment issue." },
      { title: "Toilet Leak at Base", description: "Water pooling around the base of your toilet usually means a failed wax ring seal. Left unfixed, it damages subfloor and can cause mold." },
      { title: "Clogged Toilet", description: "When a plunger can't clear the blockage, there may be an obstruction deep in the trap or drain line that needs professional snaking." },
      { title: "Toilet Replacement", description: "Old toilets using 3.5-7 gallons per flush should be replaced with modern 1.28 GPF models. Some municipalities offer rebates for water-efficient upgrades." },
    ],
    faqTemplates: [
      { question: "How much does toilet repair cost in {city}, {state}?", answer: "Toilet repair in {city} typically costs $100-$350. Running toilet fixes (flapper, fill valve) run $100-$200. Wax ring replacement costs $150-$300. Full toilet replacement with installation runs $300-$800 including the fixture. Labor is the main cost — the parts are inexpensive." },
      { question: "Should I repair or replace my toilet?", answer: "Repair if: it's a single issue like a running toilet or loose connection. Replace if: it's cracked, requires frequent repairs, uses more than 1.6 gallons per flush, or wobbles despite tightening. Modern toilets save 13,000+ gallons per year per household." },
      { question: "Can a running toilet increase my water bill?", answer: "Yes — a running toilet in your {city} home can waste 200+ gallons per day, adding $100+ per month to your water bill. A $150 repair pays for itself within weeks. Don't ignore it." },
      { question: "How long does toilet installation take?", answer: "A standard toilet replacement takes 1-2 hours. If the flange needs repair or the floor has water damage, add 1-3 hours. Most plumbers in {county} County can do same-day toilet installation." },
    ],
  },

  {
    slug: "faucet-repair",
    type: "service",
    scoring: { kind: "specialty", key: "fixture" },
    displayName: "Faucet Repair",
    heroHook: "Dripping faucet? Find top-rated faucet and fixture pros near you.",
    serviceMentionedKeys: ["faucet-fixture"],
    relatedServices: ["bathroom-remodel-plumbing", "kitchen-remodel-plumbing"],
    emergencyTypes: [
      { title: "Dripping Faucet", description: "A faucet dripping once per second wastes 3,000+ gallons per year. Usually caused by worn cartridges, O-rings, or valve seats." },
      { title: "Low Faucet Pressure", description: "Mineral buildup in the aerator, a partially closed valve, or corroded supply lines can all reduce faucet pressure." },
      { title: "Faucet Replacement", description: "Upgrading kitchen or bathroom faucets. Modern fixtures offer better flow control, filtration, and touchless operation." },
      { title: "Sprayer or Handle Issues", description: "Broken pull-out sprayers, stiff handles, or leaking connections at the base all need professional attention for a lasting fix." },
    ],
    faqTemplates: [
      { question: "How much does faucet repair cost in {city}, {state}?", answer: "Faucet repair in {city} typically costs $100-$250. Simple fixes like cartridge or O-ring replacement run $100-$175. Full faucet replacement with installation costs $200-$500 depending on the fixture and plumbing complexity." },
      { question: "Is it worth repairing an old faucet?", answer: "If your faucet is less than 10 years old and the issue is a worn cartridge or seal, repair is cost-effective. If it's older, requires hard-to-find parts, or has multiple issues, replacement is usually the better investment." },
      { question: "Can I replace a faucet myself or do I need a plumber?", answer: "Simple faucet swaps on standard connections are DIY-friendly. Call a plumber if: supply lines need modification, shutoff valves are corroded, the deck has non-standard hole patterns, or you're adding a feature like a pot-filler." },
      { question: "How long does faucet installation take?", answer: "A straightforward faucet replacement takes 30-60 minutes for most plumbers in {county} County. If supply lines or shutoff valves need replacing, add 30-60 minutes." },
    ],
  },

  {
    slug: "garbage-disposal-repair",
    type: "service",
    scoring: { kind: "specialty", key: "fixture" },
    displayName: "Garbage Disposal Repair",
    heroHook: "Disposal jammed or leaking? Get it fixed by a rated pro.",
    serviceMentionedKeys: ["garbage-disposal"],
    relatedServices: ["drain-cleaning", "kitchen-remodel-plumbing"],
    emergencyTypes: [
      { title: "Jammed Disposal", description: "Foreign objects, fibrous foods, or grease can jam the grinding mechanism. Never put your hand in — use the hex wrench port on the bottom." },
      { title: "Leaking Disposal", description: "Leaks from the top (sink flange), side (dishwasher connection), or bottom (internal seal failure). Bottom leaks usually mean replacement." },
      { title: "Disposal Won't Turn On", description: "Check the reset button and circuit breaker first. If those work, the motor or internal switch may have failed." },
      { title: "Disposal Replacement", description: "Disposals last 8-15 years. When repair costs approach replacement cost ($150-$400 installed), replace for better performance and warranty." },
    ],
    faqTemplates: [
      { question: "How much does garbage disposal repair cost in {city}, {state}?", answer: "Garbage disposal repair in {city} costs $100-$250 for unjamming or fixing connections. Full disposal replacement with installation runs $250-$500. High-end disposals (3/4 HP+) with installation can cost $400-$700." },
      { question: "How long does a garbage disposal last?", answer: "Most garbage disposals last 8-15 years depending on usage and maintenance. If yours is over 10 years old and needs frequent resets or jams, replacement is more cost-effective than repeated repairs." },
      { question: "Can a plumber install a garbage disposal?", answer: "Yes — plumbers handle both the plumbing connections and the electrical wiring for disposals. In {county} County, disposal installation may require a permit if you're adding a new unit where none existed." },
      { question: "Should I repair or replace a garbage disposal?", answer: "Repair if: it's a simple jam, loose connection, or bad reset switch. Replace if: the unit leaks from the bottom, makes grinding metal sounds, or is over 10 years old. Replacement usually takes under 2 hours." },
    ],
  },

  {
    slug: "sump-pump-repair",
    type: "service",
    scoring: { kind: "specialty", key: "sump_pump" },
    displayName: "Sump Pump Repair",
    heroHook: "Sump pump failing? Don't wait for the next storm — find a pro now.",
    serviceMentionedKeys: ["sump-pump"],
    relatedServices: ["burst-pipe-repair", "water-line-repair"],
    emergencyTypes: [
      { title: "Sump Pump Not Running", description: "When rain is coming and your sump pump won't activate, your basement is at risk. Check the float switch and power supply first." },
      { title: "Sump Pump Running Constantly", description: "A pump that runs non-stop may have a stuck float switch, undersized pump, or high water table issue that needs professional diagnosis." },
      { title: "Sump Pump Replacement", description: "Sump pumps last 7-10 years. Replace proactively before failure to avoid flood damage during the next heavy rain." },
      { title: "Battery Backup Installation", description: "A battery backup sump pump activates during power outages — the exact time you're most likely to need it." },
    ],
    faqTemplates: [
      { question: "How much does sump pump repair cost in {city}, {state}?", answer: "Sump pump repair in {city} costs $150-$400 for common fixes like float switch replacement or check valve issues. Full sump pump replacement with installation runs $500-$1,200. Battery backup systems add $300-$800." },
      { question: "How often should I replace my sump pump?", answer: "Replace your sump pump every 7-10 years, or sooner if it runs frequently during storms. In {city} and {county} County, homes with high water tables or frequent basement moisture should test their sump pump at least quarterly." },
      { question: "Do I need a battery backup sump pump?", answer: "If your {city} home has a finished basement, stores valuables in the basement, or loses power during storms, a battery backup is essential. Power outages during heavy rain are when sump pumps are needed most." },
      { question: "Can a plumber install a sump pump?", answer: "Yes — plumbers handle sump pump installation including the pit, discharge line, check valve, and connections. In {county} County, new sump pump installations may require a permit." },
    ],
  },

  {
    slug: "gas-line-repair",
    type: "service",
    scoring: { kind: "specialty", key: "gas_line" },
    displayName: "Gas Line Repair",
    heroHook: "Smell gas? Leave immediately. Then call one of these gas line pros.",
    serviceMentionedKeys: ["gas-leak"],
    relatedServices: ["water-heater-repair", "repiping"],
    emergencyTypes: [
      { title: "Gas Leak", description: "If you smell rotten eggs or hear hissing near a gas appliance, evacuate immediately and call 911, then a licensed plumber. Do NOT operate light switches or electronics." },
      { title: "Gas Line Installation", description: "Running a new gas line to a stove, dryer, fireplace, or outdoor grill. Requires pressure testing and inspection." },
      { title: "Gas Line Relocation", description: "Moving gas lines during renovation or appliance relocation. Must be done by a licensed professional with proper permits." },
      { title: "Gas Appliance Connection", description: "Connecting gas stoves, water heaters, fireplaces, or generators. Improper connections are a leading cause of gas leaks." },
    ],
    faqTemplates: [
      { question: "How much does gas line repair cost in {city}, {state}?", answer: "Gas line repair in {city} typically costs $200-$800 for a simple fix. New gas line installation runs $500-$2,000 depending on length and complexity. Gas leak detection and repair costs $150-$500. Always hire a licensed plumber for gas work — the safety stakes are too high for shortcuts." },
      { question: "How do I know if I have a gas leak?", answer: "Signs of a gas leak: rotten egg or sulfur smell, hissing near gas lines or appliances, dead vegetation over a buried gas line, higher-than-expected gas bills. If you suspect a leak in your {city} home, evacuate first and call from outside." },
      { question: "Do I need a permit for gas line work in {county} County?", answer: "Yes — all gas line work in {county} County requires a permit and pressure test inspection. Your plumber should handle the permit. Never hire someone willing to skip permits for gas work." },
      { question: "Can a plumber work on gas lines?", answer: "In most states including {state}, licensed plumbers are qualified to install, repair, and maintain gas piping. Some areas require additional gas-specific certification. All plumbers listed below are licensed in {state}." },
    ],
  },

  {
    slug: "slab-leak-repair",
    type: "service",
    scoring: { kind: "specialty", key: "slab_leak" },
    displayName: "Slab Leak Repair",
    heroHook: "Suspect a slab leak? Find leak detection and repair specialists.",
    serviceMentionedKeys: ["slab-leak"],
    relatedServices: ["repiping", "water-line-repair"],
    emergencyTypes: [
      { title: "Under-Slab Water Leak", description: "Water lines running beneath your concrete slab can corrode and leak. Warm spots on floors, rising water bills, or the sound of running water when everything is off are telltale signs." },
      { title: "Slab Leak Detection", description: "Electronic leak detection equipment pinpoints the exact location without breaking concrete. Essential before any repair to minimize demolition." },
      { title: "Spot Repair (Jackhammer)", description: "Breaking through the slab at the leak location, repairing the pipe, and patching the concrete. Best for single, accessible leaks." },
      { title: "Reroute (Overhead Repipe)", description: "Abandoning the leaking under-slab pipe and running a new line through the walls or attic. Best when multiple slab leaks indicate systemic pipe failure." },
    ],
    faqTemplates: [
      { question: "How much does slab leak repair cost in {city}, {state}?", answer: "Slab leak repair in {city} typically costs $2,000-$6,000. Leak detection alone runs $200-$500. Spot repair through the slab costs $1,500-$3,500. Overhead reroute (abandoning the under-slab pipe) costs $3,000-$6,000+ but prevents future slab leaks." },
      { question: "How do I know if I have a slab leak?", answer: "Watch for: unexplained increases in your water bill, warm spots on your floor, the sound of running water when everything is off, cracks in your foundation, mold or mildew near the floor, and low water pressure. Slab leaks in {city} homes are often caused by shifting soil or pipe corrosion." },
      { question: "Should I repair a slab leak or reroute?", answer: "A single isolated leak in a newer pipe is a good candidate for spot repair. If your {city} home has older pipes (galvanized, copper with a history of pinhole leaks), a reroute prevents future slab breaks and avoids repeated concrete demolition." },
      { question: "Does insurance cover slab leak repair in {state}?", answer: "Most homeowners insurance in {state} covers water damage from a slab leak but NOT the cost of accessing and repairing the pipe itself. Some policies cover both — check your endorsements. Document all damage with photos before repair begins." },
    ],
  },

  {
    slug: "water-line-repair",
    type: "service",
    scoring: { kind: "specialty", key: "water_line" },
    displayName: "Water Line Repair",
    heroHook: "Water line issue? Find the best water line repair pros near you.",
    serviceMentionedKeys: ["water-line"],
    relatedServices: ["repiping", "burst-pipe-repair"],
    emergencyTypes: [
      { title: "Main Water Line Leak", description: "A leaking main water line between the meter and your home can flood your yard and foundation. Soggy areas, low pressure, or a spinning meter with everything off are warning signs." },
      { title: "Water Line Replacement", description: "Old galvanized or lead water lines should be replaced with copper or PEX. Essential for homes built before 1960 that still have original supply lines." },
      { title: "Low Water Pressure", description: "Consistently low pressure throughout your home often points to a corroded, partially blocked, or undersized main water supply line." },
      { title: "Water Line Freeze Protection", description: "Insulating and protecting water lines from freezing — critical in colder regions to prevent burst pipes and service interruption." },
    ],
    faqTemplates: [
      { question: "How much does water line repair cost in {city}, {state}?", answer: "Water line repair in {city} costs $500-$3,000 for spot repairs. Full main water line replacement runs $1,500-$5,000+ depending on length, depth, and landscaping impact. Trenchless methods can reduce yard damage at a modest premium." },
      { question: "Who is responsible for the water line in {city}?", answer: "In {city} and {county} County, homeowners typically own and are responsible for the water line from the meter to the house. The municipality maintains the line from the street main to the meter. Check with your local water utility for exact boundaries." },
      { question: "How long does a water line last?", answer: "Copper water lines last 50-70 years. Galvanized steel lasts 20-50 years (and can leach rust). PEX lasts 40-50+ years. Lead pipes (pre-1950s homes) should be replaced regardless of condition. If your {city} home has the original water line and it's over 50 years old, schedule an inspection." },
      { question: "Can a water line be replaced without digging up my yard?", answer: "Yes — trenchless methods like pipe bursting or directional boring can replace water lines with minimal excavation. Not all situations qualify (sharp bends, very shallow lines, or rocky soil may require traditional excavation). Ask the pros below for a trenchless assessment." },
    ],
  },

  {
    slug: "kitchen-remodel-plumbing",
    type: "service",
    scoring: { kind: "specialty", key: "remodel" },
    displayName: "Kitchen Remodel Plumbing",
    heroHook: "Remodeling your kitchen? Get the plumbing right from the start.",
    serviceMentionedKeys: ["bathroom-remodel"],
    relatedServices: ["faucet-repair", "garbage-disposal-repair"],
    emergencyTypes: [
      { title: "Sink Relocation", description: "Moving the kitchen sink to an island or new wall requires rerouting supply lines and drain/vent piping through the floor or walls." },
      { title: "Dishwasher Installation", description: "Connecting water supply, drain, and air gap for a new or relocated dishwasher. Proper drain connections prevent backflow into the sink." },
      { title: "Gas Line for Range", description: "Installing or relocating a gas line for a range or cooktop. Requires pressure testing and code compliance inspection." },
      { title: "Pot Filler Installation", description: "Running a cold water line to a wall-mounted pot filler above the stove. Requires in-wall plumbing and a dedicated shutoff valve." },
    ],
    faqTemplates: [
      { question: "How much does kitchen remodel plumbing cost in {city}, {state}?", answer: "Kitchen plumbing for a remodel in {city} typically costs $1,000-$4,000 for fixture replacement in existing locations. Moving the sink, adding a dishwasher line, or running gas for a range can push costs to $3,000-$8,000. Get plumbing quotes before finalizing your kitchen layout." },
      { question: "When should the plumber be involved in a kitchen remodel?", answer: "Involve your plumber during the design phase — before demolition starts. Plumbing constraints (drain locations, vent stack positions, gas line routing) heavily influence what's feasible and affordable in your kitchen layout." },
      { question: "Can I move my kitchen sink to an island?", answer: "Yes, but it requires running drain and vent lines through the floor — more complex and expensive than a wall-adjacent sink. An island sink in your {city} home may also need an air admittance valve. Discuss with a plumber before committing to the layout." },
      { question: "Do I need a permit for kitchen plumbing in {county} County?", answer: "Yes — any plumbing modifications beyond simple fixture swaps require a permit in {county} County. Moving supply lines, drains, or gas lines all require permit and inspection. Your plumber should handle this." },
    ],
  },

  {
    slug: "hydro-jetting",
    type: "service",
    scoring: { kind: "specialty", key: "drain" },
    displayName: "Hydro-Jetting",
    heroHook: "Stubborn clog? Hydro-jetting blasts through what snaking can't.",
    serviceMentionedKeys: ["drain-cleaning"],
    relatedServices: ["drain-cleaning", "sewer-repair"],
    emergencyTypes: [
      { title: "Commercial Drain Cleaning", description: "Restaurants, salons, and other commercial properties with heavy drain use benefit from periodic hydro-jetting to prevent blockages." },
      { title: "Recurring Sewer Clogs", description: "If your sewer line clogs every few months, hydro-jetting removes the buildup that snaking leaves behind — tree roots, grease, and scale." },
      { title: "Pre-Purchase Sewer Clean", description: "Hydro-jetting before buying a home with older sewer lines gives you a clean slate and lets a camera inspection see the true pipe condition." },
      { title: "Grease Trap Maintenance", description: "Commercial kitchens need periodic hydro-jetting of grease traps and drain lines to maintain flow and meet health code requirements." },
    ],
    faqTemplates: [
      { question: "How much does hydro-jetting cost in {city}, {state}?", answer: "Hydro-jetting in {city} typically costs $350-$900 for residential lines and $500-$1,500+ for commercial lines. It costs more than standard drain snaking but clears the pipe completely — including grease, roots, and scale that snaking leaves behind." },
      { question: "Is hydro-jetting safe for old pipes?", answer: "Hydro-jetting is generally safe for pipes in good condition. However, if your {city} home has old clay, orangeburg, or severely corroded pipes, the high pressure could cause damage. A camera inspection before jetting identifies pipe condition and any sections that need care." },
      { question: "How often should I hydro-jet my sewer line?", answer: "For most {county} County homes, every 2-4 years is sufficient. Homes with large trees near the sewer line, older pipes, or a history of clogs benefit from annual jetting. Commercial properties with heavy kitchen use may need quarterly service." },
      { question: "What's the difference between hydro-jetting and drain snaking?", answer: "Snaking breaks through the clog to restore flow but leaves residue on pipe walls. Hydro-jetting (3,000-4,000 PSI water) scours the entire pipe interior clean — removing grease, roots, scale, and debris. It's more thorough but costs more." },
    ],
  },

  // =========================================================================
  // INTENT PAGES (5)
  // =========================================================================

  {
    slug: "24-hour-plumber",
    type: "intent",
    scoring: { kind: "signal", field: "is24Hour", value: true },
    displayName: "24-Hour Plumber",
    heroHook: "Need a plumber right now? These pros answer calls 24/7.",
    serviceMentionedKeys: [],
    relatedServices: ["burst-pipe-repair", "drain-cleaning"],
    emergencyTypes: [
      { title: "After-Hours Emergency", description: "Burst pipe at 2am? A 24-hour plumber dispatches immediately, no waiting until business hours." },
      { title: "Weekend and Holiday Service", description: "Plumbing emergencies don't respect holidays. 24-hour pros are on call even on Thanksgiving and Christmas." },
      { title: "Same-Day Urgent Repair", description: "Not a true emergency but can't wait days? After-hours plumbers can often fit urgent jobs the same evening." },
      { title: "Commercial After-Hours", description: "Restaurants and businesses that can't shut down during the day need plumbers who work nights and weekends." },
    ],
    faqTemplates: [
      { question: "Are there really 24-hour plumbers in {city}?", answer: "Yes — several plumbers serving {city} and {county} County offer true 24/7 emergency service. Look for plumbers below marked '24/7 Verified' — this means their after-hours availability is confirmed through reviews and business data." },
      { question: "How much more do 24-hour plumbers charge?", answer: "After-hours plumbing in {city} typically costs 1.5-2x standard rates. A $200 daytime repair might be $300-400 after hours. For true emergencies like burst pipes, the cost of waiting (water damage, mold) far exceeds the after-hours premium." },
      { question: "How fast can a 24-hour plumber get to my {city} home?", answer: "Most 24-hour plumbers in {city} aim for 30-60 minute response times for true emergencies. Response times for urgent but non-emergency calls may be 1-2 hours after hours. Check responsiveness ratings below." },
      { question: "What qualifies as an after-hours plumbing emergency?", answer: "True emergencies: burst pipes, gas leaks, sewage backing into your home, or no water to the whole house. Non-emergencies that can wait: slow drains, dripping faucets, running toilets. When in doubt, call — most 24-hour plumbers will help you triage over the phone." },
    ],
  },

  {
    slug: "same-day-plumber",
    type: "intent",
    scoring: { kind: "dimension", sortBy: "responsiveness" },
    displayName: "Same-Day Plumber",
    heroHook: "Need a plumber today? These pros are rated highest for fast response.",
    serviceMentionedKeys: [],
    relatedServices: ["24-hour-plumber", "burst-pipe-repair"],
    emergencyTypes: [
      { title: "Urgent But Not Emergency", description: "Your toilet is the only one and it's clogged. Not a crisis, but you need someone today — not next Tuesday." },
      { title: "Pre-Event Repair", description: "Hosting tomorrow and the kitchen drain is slow? Same-day plumbers get it fixed before your guests arrive." },
      { title: "Business Continuity", description: "A restaurant or office with a plumbing issue can't wait days for a repair without losing revenue." },
      { title: "Preventing Escalation", description: "A slow leak today becomes water damage tomorrow. Same-day service prevents small problems from becoming expensive ones." },
    ],
    faqTemplates: [
      { question: "Can I really get a plumber same-day in {city}?", answer: "Yes — many plumbers in {city} and {county} County offer same-day service for routine repairs. Plumbers below are sorted by responsiveness rating, which factors in how quickly they respond to calls and schedule appointments." },
      { question: "Is same-day plumbing more expensive?", answer: "Same-day service in {city} usually costs the same as scheduled appointments during business hours. You may pay a premium for true emergency or after-hours service, but a same-day appointment during normal hours is standard pricing." },
      { question: "What's the fastest way to get a plumber in {city}?", answer: "Call directly — don't rely on online booking forms for urgent needs. Plumbers rated highest for responsiveness below typically answer calls within minutes and can often dispatch same-day." },
      { question: "What if no plumber is available same-day?", answer: "If your top choice is booked, work down the list below — we rank by responsiveness so the fastest responders appear first. For true emergencies (flooding, gas leaks), call 911 first." },
    ],
  },

  {
    slug: "cheap-plumber",
    type: "intent",
    scoring: { kind: "dimension", sortBy: "pricing_fairness" },
    displayName: "Affordable Plumber",
    heroHook: "On a budget? These plumbers are rated highest for fair, transparent pricing.",
    serviceMentionedKeys: [],
    relatedServices: ["plumber-cost", "same-day-plumber"],
    emergencyTypes: [
      { title: "Transparent Pricing", description: "Plumbers rated for pricing fairness give clear estimates upfront and don't surprise you with hidden fees after the work is done." },
      { title: "Budget-Friendly Options", description: "Some plumbers offer payment plans, senior discounts, or will recommend the most cost-effective repair over unnecessary replacement." },
      { title: "Get Multiple Quotes", description: "For non-emergency work, getting 2-3 quotes helps you understand fair market pricing in your area." },
      { title: "Watch for Red Flags", description: "Extremely low quotes may indicate corner-cutting. Look for fair pricing combined with good workmanship ratings." },
    ],
    faqTemplates: [
      { question: "How do I find an affordable plumber in {city}?", answer: "Plumbers below are sorted by pricing fairness — a score based on real customer reviews mentioning fair quotes, no surprise fees, and transparent billing. A high pricing score means customers consistently felt the price was reasonable for the work done." },
      { question: "How much should a plumber charge per hour in {city}?", answer: "Plumber hourly rates in {city} and {county} County typically range from $75-$150/hour. Some plumbers charge flat rates per job instead. Rates vary by experience, license type, and whether it's emergency/after-hours work." },
      { question: "Should I always pick the cheapest plumber?", answer: "No — the cheapest quote isn't always the best value. Look at pricing fairness COMBINED with workmanship ratings below. A plumber who charges $50 more but does the job right the first time saves money long-term." },
      { question: "Do plumbers in {city} offer free estimates?", answer: "Many plumbers in {county} County offer free estimates for standard jobs. Some charge a diagnostic fee ($50-$100) for complex issues, which they apply toward the repair if you hire them. Ask about estimate fees before scheduling." },
    ],
  },

  {
    slug: "licensed-plumber",
    type: "intent",
    scoring: { kind: "signal", field: "bbbAccredited", value: true },
    displayName: "Licensed Plumber",
    heroHook: "Want credentials you can verify? These plumbers are BBB accredited.",
    serviceMentionedKeys: [],
    relatedServices: ["same-day-plumber", "cheap-plumber"],
    emergencyTypes: [
      { title: "BBB Accredited", description: "BBB accreditation means the business has met standards for trust, advertising, and complaint resolution. It's a verified third-party credential." },
      { title: "Licensed and Insured", description: "All plumbers on our site are licensed in their state. BBB accreditation adds an additional layer of accountability and complaint resolution." },
      { title: "Verified Track Record", description: "BBB-accredited plumbers have a public complaint history and resolution record you can review before hiring." },
      { title: "Warranty Compliance", description: "For warranty-sensitive work (repiping, water heater installation), a licensed and accredited plumber provides documentation that satisfies manufacturers and insurers." },
    ],
    faqTemplates: [
      { question: "How do I verify a plumber's license in {state}?", answer: "In {state}, you can verify plumber licenses through the state licensing board website. All plumbers listed on our site are licensed. Plumbers below with the BBB badge have additional third-party accreditation and a public complaint record." },
      { question: "Why does BBB accreditation matter?", answer: "BBB accreditation means the plumber has agreed to resolve complaints, maintain honest advertising, and meet trust standards. It's not a guarantee of quality, but it adds accountability — the BBB tracks complaints and resolution rates publicly." },
      { question: "Are all plumbers in {city} licensed?", answer: "By law, plumbers performing work in {county} County must be licensed. However, some unlicensed handymen advertise plumbing services illegally. Hiring an unlicensed plumber voids insurance claims and can create permit issues when selling your home." },
      { question: "What's the difference between a journeyman and master plumber?", answer: "A journeyman plumber has completed an apprenticeship and passed the licensing exam. A master plumber has additional years of experience and can pull permits, supervise journeymen, and run a plumbing business. Both are qualified for residential work." },
    ],
  },

  {
    slug: "plumber-cost",
    type: "intent",
    scoring: { kind: "dimension", sortBy: "pricing_fairness" },
    displayName: "Plumber Cost",
    heroHook: "Wondering what a plumber costs? Compare pricing fairness ratings.",
    serviceMentionedKeys: [],
    relatedServices: ["cheap-plumber", "same-day-plumber"],
    emergencyTypes: [
      { title: "Service Call Fee", description: "Most plumbers charge $50-$150 just to show up and diagnose the issue. Some waive this fee if you hire them for the repair." },
      { title: "Hourly vs Flat Rate", description: "Some plumbers charge hourly ($75-$150/hr), others quote flat rates per job. Flat rates give price certainty; hourly is better for quick fixes." },
      { title: "Emergency Surcharges", description: "After-hours, weekend, and holiday calls typically cost 1.5-2x standard rates. Budget for this if your issue is time-sensitive." },
      { title: "Parts and Materials", description: "Parts are usually marked up 15-50% over retail. For major jobs (water heaters, repiping), ask for an itemized quote separating labor from materials." },
    ],
    faqTemplates: [
      { question: "How much does a plumber cost in {city}, {state}?", answer: "Plumber costs in {city} range from $75-$150/hour for standard work. Common jobs: drain cleaning $150-$450, toilet repair $100-$350, water heater replacement $1,200-$3,500, faucet replacement $200-$500. Emergency and after-hours rates are 1.5-2x standard." },
      { question: "Why do plumber prices vary so much in {city}?", answer: "Price differences in {city} come from: experience level, overhead (insurance, licensing, vehicles), demand, and business model (solo plumber vs franchise). A plumber charging $125/hr with 5-star workmanship is often better value than $75/hr with callbacks." },
      { question: "How do I avoid surprise plumbing charges?", answer: "Get a written estimate before work begins. Ask about diagnostic fees, hourly vs flat rates, and whether parts are included. Plumbers rated highest for pricing fairness below consistently give accurate upfront estimates." },
      { question: "Should I get multiple plumbing quotes in {city}?", answer: "For non-emergency work over $500 in {city}, getting 2-3 quotes is smart. Compare not just price but included warranty, timeline, and the plumber's pricing fairness score below. The cheapest quote isn't always the best value." },
    ],
  },

  // =========================================================================
  // SYMPTOM PAGES (6)
  // =========================================================================

  {
    slug: "clogged-drain",
    type: "symptom",
    scoring: { kind: "mapped", serviceKeys: ["drain"] },
    displayName: "Clogged Drain",
    heroHook: "Clogged drain? Here's what to do and who to call.",
    serviceMentionedKeys: ["drain-cleaning"],
    relatedServices: ["drain-cleaning", "hydro-jetting"],
    emergencyTypes: [
      { title: "Stop Using the Drain", description: "Running more water into a clogged drain can cause overflow. Stop all water use in the affected area until the clog is cleared." },
      { title: "Try a Plunger First", description: "A cup plunger (not a flange plunger) works for sinks. Create a seal and plunge firmly 10-15 times. If it doesn't clear in 3 attempts, call a pro." },
      { title: "Skip the Chemical Drain Cleaners", description: "Chemical drain cleaners (Drano, Liquid-Plumr) can corrode pipes and are hazardous. A plumber's snake or hydro-jet is safer and more effective." },
      { title: "Check Other Drains", description: "If multiple drains are slow or backing up, the clog is in the main sewer line — not a single fixture. This is more urgent and needs professional attention." },
    ],
    faqTemplates: [
      { question: "When should I call a plumber for a clogged drain?", answer: "Call a plumber if: the plunger doesn't work after 3 attempts, multiple drains are slow at once, water is backing up (not just slow), or you've had recurring clogs in the same drain. Most drain cleaning pros in {city} can come same-day." },
      { question: "What causes clogged drains?", answer: "Common causes: hair and soap in bathroom drains, grease and food in kitchen drains, tree roots in main sewer lines, and mineral buildup in older pipes. In {city} homes with mature trees, root intrusion is a frequent cause of main line clogs." },
      { question: "How much does it cost to fix a clogged drain in {city}?", answer: "Drain unclogging in {city} costs $150-$450 depending on location and severity. Kitchen and bathroom drain clogs are on the lower end. Main sewer line clogs requiring camera inspection and hydro-jetting cost $350-$900." },
      { question: "Can a clogged drain damage my home?", answer: "Yes — a clogged drain that causes backup can lead to water damage, mold growth, and sewage contamination. A main sewer line backup in your {city} home is a health hazard. Don't delay getting it cleared." },
    ],
  },

  {
    slug: "no-hot-water",
    type: "symptom",
    scoring: { kind: "mapped", serviceKeys: ["water_heater"] },
    displayName: "No Hot Water",
    heroHook: "No hot water? Here's how to diagnose the problem and who to call.",
    serviceMentionedKeys: ["water-heater"],
    relatedServices: ["water-heater-repair", "gas-line-repair"],
    emergencyTypes: [
      { title: "Check the Pilot Light", description: "For gas water heaters: look through the viewing window. If the pilot is out, follow the relighting instructions on the unit. If it won't stay lit, the thermocouple may need replacing." },
      { title: "Check the Breaker", description: "For electric water heaters: check if the breaker tripped. Reset it once. If it trips again, there's an electrical issue — call a plumber." },
      { title: "Check for Leaks", description: "Look around the base of the water heater for pooling water. A leaking tank is urgent and may need replacement." },
      { title: "Wait 30 Minutes", description: "If the water heater was recently turned off or the pilot went out, it takes 30-60 minutes to reheat. If hot water doesn't return, call a pro." },
    ],
    faqTemplates: [
      { question: "Why do I have no hot water?", answer: "Common causes: tripped breaker or blown fuse (electric), pilot light out (gas), failed thermostat, broken heating element, sediment buildup, or a leaking tank. Age is also a factor — water heaters last 8-12 years." },
      { question: "Is no hot water an emergency?", answer: "It's urgent but not dangerous (unlike a gas leak). In {city} during cold months, no hot water is more urgent — frozen pipe risk increases. Most water heater pros in {county} County offer same-day repair." },
      { question: "How much does it cost to fix no hot water in {city}?", answer: "Common fixes: thermostat replacement $100-$200, heating element $150-$300, thermocouple $100-$200. If the tank itself is leaking, replacement runs $1,200-$3,500 depending on type and size." },
      { question: "How long does water heater repair take?", answer: "Most water heater repairs in {city} take 1-2 hours. Element or thermostat replacement is quick. Full water heater replacement takes 2-4 hours for a tank unit, 4-8 hours for tankless conversion." },
    ],
  },

  {
    slug: "water-leak",
    type: "symptom",
    scoring: { kind: "mapped", serviceKeys: ["emergency", "slab_leak", "water_line"] },
    displayName: "Water Leak",
    heroHook: "Found a water leak? Here's what to do right now.",
    serviceMentionedKeys: ["burst-pipe", "slab-leak", "water-line"],
    relatedServices: ["burst-pipe-repair", "slab-leak-repair", "water-line-repair"],
    emergencyTypes: [
      { title: "Shut Off the Water", description: "Find your main water shutoff valve and turn it off immediately. This stops the leak from causing more damage while you arrange repair." },
      { title: "Identify the Source", description: "Is the leak at a fixture (faucet, toilet), behind a wall (wet drywall, bubbling paint), or under the slab (warm floor spots)? The source determines who to call." },
      { title: "Document for Insurance", description: "Take photos and video of all water damage BEFORE cleanup. Your insurance adjuster needs before-and-after documentation to process a claim." },
      { title: "Start Drying", description: "Use towels, fans, and a dehumidifier to start drying affected areas. Mold can start growing within 24-48 hours in wet conditions." },
    ],
    faqTemplates: [
      { question: "Where is my main water shutoff valve?", answer: "In most {city} homes, the main shutoff is inside the house near where the water line enters (often basement, crawl space, or utility closet). Some homes have a secondary shutoff at the street (meter box). Know where yours is BEFORE an emergency." },
      { question: "How much does water leak repair cost in {city}?", answer: "Simple fixture leaks: $100-$300. Pipe repair behind walls: $500-$1,500 (includes drywall access and patching). Slab leaks: $2,000-$6,000. Water line replacement: $1,500-$5,000. Costs increase significantly if water damage restoration is needed." },
      { question: "Does insurance cover water leak damage in {state}?", answer: "Most policies in {state} cover sudden water damage (burst pipe, appliance failure). Gradual leaks (slow pipe corrosion, long-term seepage) are typically excluded. The repair itself (fixing the pipe) is often not covered — just the resulting damage." },
      { question: "How do I find a hidden water leak?", answer: "Signs of a hidden leak: rising water bill, water meter spinning with all fixtures off, musty smell, mold or mildew, warm spots on floors (slab leak), or stains on walls/ceilings. Plumbers in {city} use electronic leak detection to pinpoint hidden leaks without demolition." },
    ],
  },

  {
    slug: "low-water-pressure",
    type: "symptom",
    scoring: { kind: "mapped", serviceKeys: ["water_line", "repipe"] },
    displayName: "Low Water Pressure",
    heroHook: "Low water pressure? Diagnose the cause and find the right fix.",
    serviceMentionedKeys: ["water-line", "repiping"],
    relatedServices: ["water-line-repair", "repiping"],
    emergencyTypes: [
      { title: "Check if It's One Fixture or Whole House", description: "Low pressure at one faucet is usually a clogged aerator or shut valve. Whole-house low pressure points to the main supply line, pressure regulator, or municipal issue." },
      { title: "Check the Pressure Regulator", description: "Homes with a pressure regulator (bell-shaped valve near the main shutoff) can lose pressure when the regulator fails. Replacement costs $200-$400." },
      { title: "Look for Leaks", description: "A significant leak in your supply line drops pressure throughout the house. Check your water meter with all fixtures off — if it's spinning, you have a leak." },
      { title: "Check Municipal Notices", description: "Your water utility may be doing maintenance. Check their website or call before hiring a plumber for a temporary municipal issue." },
    ],
    faqTemplates: [
      { question: "What causes low water pressure?", answer: "Common causes: clogged aerators, partially closed shutoff valves, a failing pressure regulator, corroded galvanized pipes restricting flow, leaks in the supply line, or municipal water main issues. In {city} homes with galvanized pipes, internal corrosion is a frequent culprit." },
      { question: "How do I fix low water pressure in my {city} home?", answer: "Start simple: clean faucet aerators, check shutoff valves are fully open. If the problem is house-wide, test your water pressure with a gauge (should be 40-60 PSI). Below 40 PSI, call a plumber to check the pressure regulator and main supply line." },
      { question: "How much does it cost to fix low water pressure?", answer: "Causes and costs: aerator cleaning (free DIY), pressure regulator replacement $200-$400, main water line repair $1,500-$5,000, whole-house repipe $4,000-$15,000. A plumber's diagnostic visit ($100-$200) identifies the cause before you commit to expensive repairs." },
      { question: "Can old pipes cause low water pressure?", answer: "Yes — galvanized steel pipes (common in homes built before 1960) corrode internally, narrowing the pipe and restricting water flow. If your {city} home has original galvanized pipes and low pressure throughout, repiping to PEX or copper is the permanent fix." },
    ],
  },

  {
    slug: "frozen-pipes",
    type: "symptom",
    scoring: { kind: "mapped", serviceKeys: ["emergency"] },
    displayName: "Frozen Pipes",
    heroHook: "Frozen pipes? Act fast to prevent a burst — here's what to do.",
    serviceMentionedKeys: ["burst-pipe"],
    relatedServices: ["burst-pipe-repair", "repiping"],
    emergencyTypes: [
      { title: "DON'T Use Open Flames", description: "Never use a torch, candle, or space heater directly on pipes. Use a hair dryer, heat lamp, or wrap pipes in hot towels. Open flame near pipes risks fire and can cause them to burst." },
      { title: "Open the Faucet", description: "Open the faucet connected to the frozen pipe. Running water (even a trickle) helps melt ice from the inside and relieves pressure that causes bursts." },
      { title: "Apply Heat Slowly", description: "Start heating from the faucet end and work toward the frozen section. This allows water to flow out as ice melts, reducing pressure." },
      { title: "Know When to Call a Pro", description: "If you can't locate the frozen section, the pipe is inside a wall, or you suspect it has already burst, call a plumber immediately." },
    ],
    faqTemplates: [
      { question: "How do I know if my pipes are frozen?", answer: "Signs of frozen pipes: no water comes out when you turn on a faucet, only a trickle, frost visible on exposed pipes, or unusual odors from drains (a frozen line can cause waste backup). In {city}, pipes in exterior walls, unheated basements, and crawl spaces freeze first." },
      { question: "Will frozen pipes always burst?", answer: "No — but the risk is high. When water freezes, it expands and creates pressure between the ice blockage and the faucet. If that pressure has nowhere to go, the pipe bursts. Quick thawing reduces the risk. Copper and galvanized pipes are more vulnerable than PEX." },
      { question: "How much does frozen pipe repair cost in {city}?", answer: "Thawing a frozen pipe without damage: $100-$300. If the pipe has burst: $200-$1,000 for the pipe repair plus water damage costs. Prevention (insulation, heat tape) costs $50-$200 per pipe run — much cheaper than repair." },
      { question: "How do I prevent frozen pipes in {city}?", answer: "In {city} winters: insulate pipes in unheated areas, leave faucets dripping during extreme cold, keep cabinet doors open under sinks on exterior walls, maintain heat at 55°F+ even when away, and disconnect garden hoses before the first freeze." },
    ],
  },

  {
    slug: "sewage-backup",
    type: "symptom",
    scoring: { kind: "mapped", serviceKeys: ["sewer", "drain"] },
    displayName: "Sewage Backup",
    heroHook: "Sewage backing up? This is a health hazard — act now.",
    serviceMentionedKeys: ["sewer", "drain-cleaning"],
    relatedServices: ["sewer-repair", "drain-cleaning"],
    emergencyTypes: [
      { title: "Stop Using All Water", description: "Every flush and drain use adds to the backup. Stop all water usage in the house immediately until the blockage is cleared." },
      { title: "Avoid Contact", description: "Raw sewage contains bacteria, viruses, and parasites. Don't wade through it or touch it without protective gear. Keep children and pets away." },
      { title: "Ventilate the Area", description: "Open windows and doors near the affected area. Sewage gases (methane, hydrogen sulfide) are hazardous in enclosed spaces." },
      { title: "Call a Plumber Immediately", description: "Sewage backup is a true emergency. Most emergency plumbers can respond within 30-60 minutes. Do NOT attempt to clear a main sewer line yourself." },
    ],
    faqTemplates: [
      { question: "What causes sewage to back up?", answer: "Common causes: main sewer line clog (tree roots, grease, debris), collapsed or bellied sewer pipe, city sewer main backup, or heavy rainfall overwhelming combined sewer systems. In {city}, tree root intrusion is one of the most common causes." },
      { question: "Is sewage backup dangerous?", answer: "Yes — raw sewage is a serious health hazard containing bacteria (E. coli, salmonella), viruses, and parasites. Do not touch sewage without protective gear. After cleanup, the area needs professional sanitization to prevent illness and mold." },
      { question: "How much does sewage backup repair cost in {city}?", answer: "Emergency sewer line clearing: $200-$800. If the backup revealed a broken or collapsed sewer line, repair costs $1,500-$10,000+ depending on the method and extent. Professional cleanup and sanitization adds $1,000-$5,000 for significant backups." },
      { question: "Does insurance cover sewage backup in {state}?", answer: "Standard homeowners insurance in {state} typically does NOT cover sewer backup damage. You need a separate sewer backup endorsement ($40-$100/year). If you don't have it, you'll pay for cleanup and repair out of pocket. Check your policy now — before the next incident." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Legacy compat: keep SERVICE_CONFIGS pointing to the same data
// ---------------------------------------------------------------------------

export const SERVICE_CONFIGS = PAGE_CONFIGS;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Get a page config by slug */
export function getServiceConfig(slug: string): PageConfig | undefined {
  return PAGE_CONFIGS.find((p) => p.slug === slug);
}

/** Alias for getServiceConfig — new code should use this */
export const getPageConfig = getServiceConfig;

/** Get all slugs (used by generateStaticParams) */
export function getAllServiceSlugs(): string[] {
  return PAGE_CONFIGS.map((p) => p.slug);
}

/** Get slugs by page type */
export function getSlugsByType(type: PageType): string[] {
  return PAGE_CONFIGS.filter((p) => p.type === type).map((p) => p.slug);
}

/**
 * Extract the primary specialty key from a PageConfig's scoring strategy.
 * For "specialty" → the key directly.
 * For "mapped" → the first mapped service key.
 * For "dimension" / "signal" → undefined (these don't filter by specialty).
 *
 * Used by the page component for backward compat until Phase 3 rewrites
 * getQualifiedPlumbers() to handle all scoring strategy types.
 */
export function getSpecialtyKeyFromConfig(config: PageConfig): string | undefined {
  switch (config.scoring.kind) {
    case "specialty":
      return config.scoring.key;
    case "mapped":
      return config.scoring.serviceKeys[0];
    case "dimension":
    case "signal":
      return undefined;
  }
}
