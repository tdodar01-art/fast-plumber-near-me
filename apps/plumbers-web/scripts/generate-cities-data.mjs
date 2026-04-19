#!/usr/bin/env node
/**
 * Generates src/lib/cities-generated.ts AND src/lib/city-coords.ts from a
 * single seed (RAW_CITIES below). One script, two outputs — always in sync.
 *
 * - cities-generated.ts: 2,000+ city pages with hero content + nearby refs.
 * - city-coords.ts:      lat/lng lookup table used for the 20-mile radius
 *                        fallback when a plumber's serviceCities doesn't
 *                        directly match a page's city slug.
 *
 * Coord backfill: any city in RAW_CITIES missing a coord is geocoded via the
 * Google Geocoding API (GOOGLE_PLACES_API_KEY from .env.local). Results are
 * cached in scripts/city-coords-cache.json so subsequent runs are zero-cost.
 *
 * Fails the build (exit 1) and logs to the control-center error log if any
 * city ends up without coords — city pages without coords can't use the
 * radius fallback and will render 0 plumbers. This is the contract.
 *
 * Run: node scripts/generate-cities-data.mjs
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Env + error-logging plumbing (shared across the pipeline)
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// control-center log-error.mjs — append-only JSONL at logs/errors.jsonl,
// surfaced via the /admin error-log UI on port 4330.
const LOG_ERROR_CLI =
  process.env.CONTROL_CENTER_LOG_ERROR_CLI ||
  resolve(__dirname, "../../../../../control-center/scripts/log-error.mjs");

function logErrorCLI({ entity, severity = "error", message, context }) {
  if (!existsSync(LOG_ERROR_CLI)) {
    console.error(`  [log-error] CLI not found at ${LOG_ERROR_CLI}`);
    return;
  }
  const args = [
    LOG_ERROR_CLI,
    "--project", "plumber",
    "--entity", entity,
    "--severity", severity,
    "--source", "generate-cities-data",
    "--message", message,
  ];
  if (context) {
    args.push("--context", JSON.stringify(context));
  }
  const res = spawnSync("node", args, { encoding: "utf-8" });
  if (res.status !== 0) {
    console.error(`  [log-error] CLI exited ${res.status}: ${res.stderr || res.stdout}`);
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Climate regions for hero content variation
const REGION_MAP = {
  frost_heavy: ["AK","ME","VT","NH","MN","WI","MI","ND","SD","MT","WY","ID"],
  frost_moderate: ["NY","MA","CT","RI","PA","OH","IN","IL","IA","NE","CO","NJ","WV"],
  temperate: ["VA","NC","TN","KY","MO","KS","OR","WA","MD","DE","DC"],
  subtropical: ["SC","GA","AL","MS","LA","AR","OK","TX"],
  tropical: ["FL","HI"],
  arid: ["AZ","NV","NM","UT"],
  california: ["CA"],
};

function getRegion(state) {
  for (const [region, states] of Object.entries(REGION_MAP)) {
    if (states.includes(state)) return region;
  }
  return "temperate";
}

// Hero content templates — 8 per region for variety
const HERO_TEMPLATES = {
  frost_heavy: [
    (c,co) => `${c} in ${co} County faces some of the harshest winters in the country. Frozen pipes, burst water lines, and water heater failures are common plumbing emergencies that require immediate professional attention from verified plumbers.`,
    (c,co) => `Homeowners in ${c} know that extreme cold is the biggest enemy of residential plumbing. ${co} County's frigid temperatures make burst pipes, frozen water heaters, and ice-dammed drains an annual concern requiring fast emergency service.`,
    (c,co) => `${c} sits in ${co} County where winter temperatures can drop well below zero. Emergency plumbers here handle everything from frozen supply lines to failed water heaters, providing critical service during the coldest months.`,
    (c,co) => `With long, severe winters in ${co} County, ${c} homeowners face frequent plumbing emergencies. Frozen and burst pipes top the list, followed by water heater failures and sewer line backups caused by deep ground frost.`,
    (c,co) => `${c}'s location in ${co} County means dealing with extreme weather that takes a serious toll on plumbing systems. From frozen pipes in January to spring thaw flooding, emergency plumbers stay busy year-round.`,
    (c,co) => `The harsh climate around ${c} in ${co} County creates relentless plumbing challenges. Older homes with exposed pipes are especially vulnerable to freeze damage, making reliable emergency plumbing service essential.`,
    (c,co) => `${c} residents in ${co} County understand that plumbing emergencies wait for no one — especially during brutal winter months. Burst pipes from deep freezes and water heater failures during cold snaps demand immediate expert response.`,
    (c,co) => `Living in ${c}, ${co} County means being prepared for winter plumbing disasters. Sub-zero temperatures can freeze pipes overnight, and when they burst, fast emergency plumbing service is the difference between minor damage and a flooded home.`,
  ],
  frost_moderate: [
    (c,co) => `${c} in ${co} County experiences all four seasons, and each brings its own plumbing challenges. Winter pipe freezes, spring flooding, and aging infrastructure keep emergency plumbers busy year-round.`,
    (c,co) => `Residents of ${c} rely on fast emergency plumbing service when cold snaps freeze pipes or aging sewer lines back up. ${co} County's older housing stock makes responsive service essential for homeowners.`,
    (c,co) => `${c} homeowners in ${co} County face plumbing emergencies from frozen pipes in winter to overtaxed drains during spring storms. Verified emergency plumbers can help at any hour of the day.`,
    (c,co) => `From historic neighborhoods to newer subdivisions, ${c} in ${co} County has a diverse housing stock where plumbing emergencies don't wait for business hours. Quick, reliable service is essential.`,
    (c,co) => `${c}'s ${co} County location means cold winters that stress plumbing systems and hot summers that strain water heaters. Burst pipes, sewer backups, and emergency drain issues require fast professional response.`,
    (c,co) => `The mix of older and newer homes in ${c}, ${co} County creates varied plumbing challenges. From century-old cast iron pipes to modern PEX systems, emergency plumbing issues require experienced professionals.`,
    (c,co) => `${c} in ${co} County sees its share of plumbing emergencies across every season. Winter brings frozen pipes, spring brings flooding, and aging infrastructure means sewer backups can happen any time.`,
    (c,co) => `Whether dealing with a burst pipe at 2 AM or a backed-up sewer on a holiday weekend, ${c} homeowners in ${co} County need emergency plumbers who actually answer the phone and respond fast.`,
  ],
  temperate: [
    (c,co) => `${c} in ${co} County enjoys a moderate climate, but plumbing emergencies still strike without warning. Water heater failures, sewer backups, and burst pipes demand immediate professional service.`,
    (c,co) => `Homeowners in ${c} count on responsive emergency plumbers when unexpected plumbing failures occur. ${co} County's mix of older and newer homes creates a range of urgent repair needs throughout the year.`,
    (c,co) => `${c} sits in ${co} County where seasonal storms and aging infrastructure can trigger plumbing emergencies from backed-up sewers to burst supply lines at any time of day or night.`,
    (c,co) => `${c}'s temperate climate in ${co} County doesn't prevent plumbing disasters. From water heater breakdowns to emergency pipe repairs, verified plumbers are ready to respond quickly when you need them.`,
    (c,co) => `Whether it's a burst pipe, clogged sewer, or water heater emergency, ${c} homeowners in ${co} County need plumbers who actually answer the phone and show up fast to minimize damage.`,
    (c,co) => `${c} in ${co} County has a growing residential base that depends on reliable emergency plumbing. From older homes with aging pipes to new construction, emergencies can strike anywhere.`,
    (c,co) => `${co} County's ${c} residents know that plumbing problems don't follow a schedule. Emergency plumbers serving the area handle burst pipes, drain blockages, and water heater failures around the clock.`,
    (c,co) => `${c}'s diverse neighborhoods in ${co} County range from established communities to new developments, all needing fast emergency plumbing service when pipes burst or drains back up unexpectedly.`,
  ],
  subtropical: [
    (c,co) => `${c} in ${co} County deals with intense heat and humidity that accelerate plumbing wear. Water heater failures, corroded pipes, and storm-related sewer backups are common emergencies year-round.`,
    (c,co) => `${c}'s hot, humid climate in ${co} County puts extra stress on residential plumbing systems. Emergency calls for burst pipes, water heater failures, and flood-related backups keep plumbers busy.`,
    (c,co) => `Homeowners in ${c} face unique plumbing challenges from ${co} County's subtropical climate. Heavy rains overwhelm drains while intense heat accelerates pipe corrosion and water heater wear.`,
    (c,co) => `${c} in ${co} County sees its share of plumbing emergencies — from storm-driven sewer backups to water heater failures in scorching summer heat. Fast, reliable emergency service matters most when it counts.`,
    (c,co) => `The hot climate in ${c}, ${co} County means water heaters work overtime and aging pipes endure thermal stress. When emergencies hit, verified plumbers provide the fast response homeowners need.`,
    (c,co) => `${c} residents in ${co} County face plumbing emergencies amplified by heat and storms. From burst supply lines to clogged storm drains, fast emergency plumbing response prevents costly water damage.`,
    (c,co) => `${co} County's warm climate means ${c} homeowners deal with plumbing issues year-round. Corroded pipes, overtaxed water heaters, and storm-season backups all require fast professional response.`,
    (c,co) => `Living in ${c}'s ${co} County means plumbing systems face constant heat stress. When a pipe bursts or a water heater fails, having a verified emergency plumber on call is essential for protecting your home.`,
  ],
  tropical: [
    (c,co) => `${c} in ${co} County's tropical climate creates unique plumbing challenges. Hurricane season flooding, pipe corrosion from humidity, and overtaxed water heaters are common emergency calls for local plumbers.`,
    (c,co) => `${c}'s warm, humid environment in ${co} County accelerates pipe corrosion and creates persistent moisture issues. Emergency plumbing calls for backed-up drains and failed water heaters are a daily reality.`,
    (c,co) => `Homeowners in ${c} face year-round plumbing concerns from ${co} County's tropical conditions. Coastal humidity, heavy rains, and intense storms create urgent repair needs that can't wait.`,
    (c,co) => `${c} in ${co} County deals with tropical weather that takes a constant toll on plumbing systems. From hurricane-season floods to humidity-driven corrosion, emergency plumbers stay busy throughout the year.`,
    (c,co) => `Living in ${c}'s tropical climate in ${co} County means plumbing systems face constant humidity and storm stress. When pipes burst or drains back up, fast emergency service is critical to prevent damage.`,
    (c,co) => `${c} residents in ${co} County know that tropical weather and plumbing don't always mix well. Corroded pipes, overwhelmed drains during storms, and water heater failures need fast professional attention.`,
    (c,co) => `The tropical conditions in ${c}, ${co} County put unique strain on residential plumbing. From storm-related sewer backups to salt air corrosion, emergency plumbers provide essential year-round service.`,
    (c,co) => `${co} County's ${c} faces plumbing emergencies driven by tropical heat, humidity, and storm season flooding. Verified emergency plumbers who respond quickly are essential for protecting homes from water damage.`,
  ],
  arid: [
    (c,co) => `${c} in ${co} County faces extreme desert heat that strains water systems and accelerates plumbing wear. Water heater failures and pipe issues from hard water are among the most common emergencies.`,
    (c,co) => `${c}'s arid climate in ${co} County brings unique plumbing challenges — hard water deposits clog pipes, extreme heat stresses water heaters, and desert soil shifts can crack underground sewer lines.`,
    (c,co) => `Homeowners in ${c} deal with ${co} County's harsh desert conditions that take a toll on plumbing. Hard water buildup, extreme temperatures, and expansive soil create constant emergency repair needs.`,
    (c,co) => `${c} in ${co} County's desert environment means plumbing systems face extreme heat, hard water buildup, and soil movement. Emergency plumbers handle everything from burst lines to failed water heaters.`,
    (c,co) => `The extreme conditions in ${c}, ${co} County — from scorching summers to mineral-heavy water — put extraordinary strain on residential plumbing. Verified emergency plumbers provide essential fast response.`,
    (c,co) => `${c} residents in ${co} County face plumbing emergencies unique to the arid Southwest. Hard water destroys fixtures, extreme heat kills water heaters early, and shifting desert soil cracks sewer pipes.`,
    (c,co) => `${co} County's desert climate makes ${c} a challenging environment for plumbing systems. Water heater failures, pipe scale buildup, and foundation shifts affecting sewer lines keep emergency plumbers busy.`,
    (c,co) => `Living in ${c}'s ${co} County means plumbing systems battle extreme heat and hard water daily. When emergencies strike — burst pipes, failed water heaters, backed-up sewers — fast professional response is essential.`,
  ],
  california: [
    (c,co) => `${c} in ${co} County reflects California's diverse housing landscape — from mid-century ranches to new construction — all requiring reliable emergency plumbing service when pipes burst or drains back up.`,
    (c,co) => `Homeowners in ${c} rely on responsive emergency plumbers for ${co} County's mix of aging pipes, earthquake-shifted sewer lines, and water heater failures that can strike at any hour.`,
    (c,co) => `${c} in ${co} County faces California plumbing challenges: aging infrastructure, drought-stressed systems, and seismic activity that can damage pipes and sewer lines without warning.`,
    (c,co) => `${c}'s ${co} County location means dealing with California's unique plumbing demands — from water conservation mandates affecting older systems to earthquake-related pipe damage requiring emergency repair.`,
    (c,co) => `Whether it's an older bungalow or a new development, ${c} homes in ${co} County need plumbers who respond fast to burst pipes, sewer backups, and water heater emergencies around the clock.`,
    (c,co) => `${c} residents in ${co} County face plumbing emergencies that range from corroded galvanized pipes in older homes to slab leaks in newer construction. Fast, verified emergency service is essential.`,
    (c,co) => `${co} County's ${c} has housing spanning decades, each era with its own plumbing vulnerabilities. Emergency plumbers here handle everything from repiping old galvanized systems to fixing modern tankless water heaters.`,
    (c,co) => `${c}'s diverse ${co} County neighborhoods create varied plumbing emergency needs. From slab leaks to sewer line failures, homeowners depend on verified plumbers who actually show up and get the job done.`,
  ],
};

// Raw city data: "CityName:CountyName" per state
const RAW_CITIES = {
  AL: [
    "Birmingham:Jefferson","Huntsville:Madison","Montgomery:Montgomery","Mobile:Mobile",
    "Tuscaloosa:Tuscaloosa","Hoover:Jefferson","Dothan:Houston","Auburn:Lee",
    "Decatur:Morgan","Madison:Madison","Florence:Lauderdale","Gadsden:Etowah",
    "Vestavia Hills:Jefferson","Prattville:Autauga","Phenix City:Russell",
    "Alabaster:Shelby","Opelika:Lee","Northport:Tuscaloosa","Enterprise:Coffee",
    "Homewood:Jefferson","Prichard:Mobile","Anniston:Calhoun","Athens:Limestone",
    "Pelham:Shelby","Trussville:Jefferson","Oxford:Calhoun","Albertville:Marshall",
    "Selma:Dallas","Daphne:Baldwin","Fairhope:Baldwin","Troy:Pike",
    "Helena:Shelby","Tillmans Corner:Mobile","Center Point:Jefferson","Bessemer:Jefferson",
    "Mountain Brook:Jefferson","Gardendale:Jefferson","Saraland:Mobile","Hueytown:Jefferson",
    "Cullman:Cullman","Jasper:Walker","Ozark:Dale","Alexander City:Tallapoosa",
    "Millbrook:Elmore","Clanton:Chilton","Scottsboro:Jackson","Fort Payne:DeKalb",
    "Talladega:Talladega","Hartselle:Morgan","Gulf Shores:Baldwin",
  ],
  AK: [
    "Anchorage:Anchorage","Fairbanks:Fairbanks North Star","Juneau:Juneau",
    "Sitka:Sitka","Ketchikan:Ketchikan Gateway","Wasilla:Matanuska-Susitna",
    "Kenai:Kenai Peninsula","Kodiak:Kodiak Island","Palmer:Matanuska-Susitna",
    "Bethel:Bethel","Homer:Kenai Peninsula",
  ],
  AZ: [
    "Phoenix:Maricopa","Tucson:Pima","Mesa:Maricopa","Chandler:Maricopa",
    "Gilbert:Maricopa","Glendale:Maricopa","Scottsdale:Maricopa","Peoria:Maricopa",
    "Tempe:Maricopa","Surprise:Maricopa","Yuma:Yuma","Avondale:Maricopa",
    "Goodyear:Maricopa","Flagstaff:Coconino","Buckeye:Maricopa","Lake Havasu City:Mohave",
    "Casa Grande:Pinal","Maricopa:Pinal","Sierra Vista:Cochise","Prescott:Yavapai",
    "Bullhead City:Mohave","Prescott Valley:Yavapai","Apache Junction:Pinal",
    "Marana:Pima","El Mirage:Maricopa","Kingman:Mohave","Queen Creek:Maricopa",
    "San Luis:Yuma","Florence:Pinal","Fountain Hills:Maricopa","Oro Valley:Pima",
    "Catalina Foothills:Pima","Sun City West:Maricopa","Nogales:Santa Cruz",
    "Eloy:Pinal","Douglas:Cochise","Winslow:Navajo","Payson:Gila",
    "Sedona:Yavapai","Cottonwood:Yavapai","Coolidge:Pinal","Globe:Gila",
    "Sahuarita:Pima","San Tan Valley:Pinal","Anthem:Maricopa",
  ],
  AR: [
    "Little Rock:Pulaski","Fort Smith:Sebastian","Fayetteville:Washington",
    "Springdale:Washington","Jonesboro:Craighead","North Little Rock:Pulaski",
    "Conway:Faulkner","Rogers:Benton","Pine Bluff:Jefferson","Bentonville:Benton",
    "Hot Springs:Garland","Benton:Saline","Sherwood:Pulaski","Texarkana:Miller",
    "Jacksonville:Pulaski","Russellville:Pope","Cabot:Lonoke","Paragould:Greene",
    "Bella Vista:Benton","Van Buren:Crawford","Searcy:White","West Memphis:Crittenden",
    "Maumelle:Pulaski","Bryant:Saline","Siloam Springs:Benton","Marion:Crittenden",
    "Mountain Home:Baxter","Harrison:Boone",
  ],
  CA: [
    "Los Angeles:Los Angeles","San Diego:San Diego","San Jose:Santa Clara",
    "San Francisco:San Francisco","Fresno:Fresno","Sacramento:Sacramento",
    "Long Beach:Los Angeles","Oakland:Alameda","Bakersfield:Kern",
    "Anaheim:Orange","Santa Ana:Orange","Riverside:Riverside",
    "Stockton:San Joaquin","Irvine:Orange","Chula Vista:San Diego",
    "Fremont:Alameda","San Bernardino:San Bernardino","Modesto:Stanislaus",
    "Moreno Valley:Riverside","Fontana:San Bernardino","Glendale:Los Angeles",
    "Huntington Beach:Orange","Santa Clarita:Los Angeles","Garden Grove:Orange",
    "Oceanside:San Diego","Rancho Cucamonga:San Bernardino","Ontario:San Bernardino",
    "Santa Rosa:Sonoma","Elk Grove:Sacramento","Corona:Riverside",
    "Lancaster:Los Angeles","Palmdale:Los Angeles","Salinas:Monterey",
    "Pomona:Los Angeles","Hayward:Alameda","Escondido:San Diego",
    "Sunnyvale:Santa Clara","Torrance:Los Angeles","Pasadena:Los Angeles",
    "Orange:Orange","Fullerton:Orange","Thousand Oaks:Ventura",
    "Roseville:Placer","Concord:Contra Costa","Simi Valley:Ventura",
    "Santa Clara:Santa Clara","Victorville:San Bernardino","Vallejo:Solano",
    "Berkeley:Alameda","El Monte:Los Angeles","Downey:Los Angeles",
    "Costa Mesa:Orange","Inglewood:Los Angeles","Carlsbad:San Diego",
    "San Buenaventura:Ventura","Fairfield:Solano","West Covina:Los Angeles",
    "Murrieta:Riverside","Richmond:Contra Costa","Norwalk:Los Angeles",
    "Antioch:Contra Costa","Temecula:Riverside","Burbank:Los Angeles",
    "Daly City:San Mateo","Rialto:San Bernardino","El Cajon:San Diego",
    "San Mateo:San Mateo","Clovis:Fresno","Compton:Los Angeles",
    "Jurupa Valley:Riverside","Vista:San Diego","South Gate:Los Angeles",
    "Mission Viejo:Orange","Vacaville:Solano","Carson:Los Angeles",
    "Hesperia:San Bernardino","Santa Maria:Santa Barbara","Redding:Shasta",
    "Westminster:Orange","Santa Monica:Los Angeles","Chico:Butte",
    "Newport Beach:Orange","San Leandro:Alameda","San Marcos:San Diego",
    "Whittier:Los Angeles","Hawthorne:Los Angeles","Citrus Heights:Sacramento",
    "Alhambra:Los Angeles","Tracy:San Joaquin","Livermore:Alameda",
    "Buena Park:Orange","Menifee:Riverside","Hemet:Riverside",
    "Lakewood:Los Angeles","Merced:Merced","Chino:San Bernardino",
    "Indio:Riverside","Redwood City:San Mateo","Lake Forest:Orange",
    "Napa:Napa","Tustin:Orange","Bellflower:Los Angeles",
    "Mountain View:Santa Clara","Chino Hills:San Bernardino","Baldwin Park:Los Angeles",
    "Alameda:Alameda","Upland:San Bernardino","San Ramon:Contra Costa",
    "Folsom:Sacramento","Pleasanton:Alameda","Lynwood:Los Angeles",
    "San Clemente:Orange","Lodi:San Joaquin","Manteca:San Joaquin",
    "Palm Desert:Riverside","Perris:Riverside","Lake Elsinore:Riverside",
    "Walnut Creek:Contra Costa","Turlock:Stanislaus","Beaumont:Riverside",
    "Pico Rivera:Los Angeles","Santa Cruz:Santa Cruz","San Rafael:Marin",
    "Cathedral City:Riverside","Monterey Park:Los Angeles","Gardena:Los Angeles",
    "National City:San Diego","Rocklin:Placer","Petaluma:Sonoma",
    "Huntington Park:Los Angeles","Gilroy:Santa Clara","San Bruno:San Mateo",
    "Yucaipa:San Bernardino","Glendora:Los Angeles","La Mirada:Los Angeles",
    "Palm Springs:Riverside","Woodland:Yolo","West Sacramento:Yolo",
    "Porterville:Tulare","Tulare:Tulare","Hanford:Kings",
    "Madera:Madera","Novato:Marin","Davis:Yolo",
    "Rancho Cordova:Sacramento","Brentwood:Contra Costa","San Luis Obispo:San Luis Obispo",
    "Ceres:Stanislaus","Encinitas:San Diego","La Quinta:Riverside",
    "Poway:San Diego","Cupertino:Santa Clara","San Gabriel:Los Angeles",
    "Lompoc:Santa Barbara","Oakley:Contra Costa","Dublin:Alameda",
    "Camarillo:Ventura","Azusa:Los Angeles","Arcadia:Los Angeles",
    "Diamond Bar:Los Angeles","Rosemead:Los Angeles","Paramount:Los Angeles",
    "Eastvale:Riverside","Delano:Kern","Santee:San Diego",
    "Milpitas:Santa Clara","Yuba City:Sutter","Rancho Santa Margarita:Orange",
    "Lathrop:San Joaquin","Laguna Niguel:Orange","San Jacinto:Riverside",
    "Coachella:Riverside","Wildomar:Riverside","Danville:Contra Costa",
    "El Cerrito:Contra Costa","Newark:Alameda","Campbell:Santa Clara",
    "Visalia:Tulare",
  ],
  CO: [
    "Denver:Denver","Colorado Springs:El Paso","Aurora:Arapahoe","Fort Collins:Larimer",
    "Lakewood:Jefferson","Thornton:Adams","Arvada:Jefferson","Westminster:Adams",
    "Pueblo:Pueblo","Centennial:Arapahoe","Boulder:Boulder","Greeley:Weld",
    "Longmont:Boulder","Broomfield:Broomfield","Castle Rock:Douglas",
    "Commerce City:Adams","Parker:Douglas","Littleton:Arapahoe",
    "Northglenn:Adams","Brighton:Adams","Englewood:Arapahoe","Wheat Ridge:Jefferson",
    "Loveland:Larimer","Federal Heights:Adams","Grand Junction:Mesa",
    "Ken Caryl:Jefferson","Highlands Ranch:Douglas","Superior:Boulder",
    "Louisville:Boulder","Erie:Weld","Lafayette:Boulder","Golden:Jefferson",
    "Montrose:Montrose","Durango:La Plata","Steamboat Springs:Routt",
    "Canon City:Fremont","Sterling:Logan","Trinidad:Las Animas",
    "Evans:Weld","Windsor:Weld","Johnstown:Weld","Firestone:Weld",
    "Frederick:Weld","Lone Tree:Douglas","Sheridan:Arapahoe",
  ],
  CT: [
    "Bridgeport:Fairfield","New Haven:New Haven","Stamford:Fairfield","Hartford:Hartford",
    "Waterbury:New Haven","Norwalk:Fairfield","Danbury:Fairfield","New Britain:Hartford",
    "Bristol:Hartford","Meriden:New Haven","Milford:New Haven","West Haven:New Haven",
    "Middletown:Middlesex","Norwich:New London","Shelton:Fairfield","Torrington:Litchfield",
    "New London:New London","Ansonia:New Haven","Derby:New Haven","Groton:New London",
    "Naugatuck:New Haven","Trumbull:Fairfield","Glastonbury:Hartford","Newington:Hartford",
    "Vernon:Tolland","Enfield:Hartford","Manchester:Hartford","Southington:Hartford",
    "East Hartford:Hartford","Hamden:New Haven","Wallingford:New Haven","Stratford:Fairfield",
    "West Hartford:Hartford","Farmington:Hartford","Wethersfield:Hartford",
  ],
  DE: [
    "Wilmington:New Castle","Dover:Kent","Newark:New Castle","Middletown:New Castle",
    "Bear:New Castle","Glasgow:New Castle","Brookside:New Castle","Hockessin:New Castle",
    "Smyrna:Kent","Milford:Sussex","Seaford:Sussex","Georgetown:Sussex",
    "Lewes:Sussex","Rehoboth Beach:Sussex","Elsmere:New Castle",
  ],
  DC: [
    "Washington:District of Columbia",
  ],
  FL: [
    "Jacksonville:Duval","Miami:Miami-Dade","Tampa:Hillsborough","Orlando:Orange",
    "St. Petersburg:Pinellas","Hialeah:Miami-Dade","Tallahassee:Leon","Fort Lauderdale:Broward",
    "Port St. Lucie:St. Lucie","Cape Coral:Lee","Pembroke Pines:Broward","Hollywood:Broward",
    "Miramar:Broward","Gainesville:Alachua","Coral Springs:Broward","Miami Gardens:Miami-Dade",
    "Clearwater:Pinellas","Palm Bay:Brevard","Pompano Beach:Broward","West Palm Beach:Palm Beach",
    "Lakeland:Polk","Davie:Broward","Miami Beach:Miami-Dade","Sunrise:Broward",
    "Boca Raton:Palm Beach","Deltona:Volusia","Plantation:Broward","Palm Coast:Flagler",
    "Fort Myers:Lee","Largo:Pinellas","Kissimmee:Osceola","Deerfield Beach:Broward",
    "Melbourne:Brevard","Boynton Beach:Palm Beach","Lauderhill:Broward","Weston:Broward",
    "Homestead:Miami-Dade","Tamarac:Broward","Delray Beach:Palm Beach","Daytona Beach:Volusia",
    "North Miami:Miami-Dade","Wellington:Palm Beach","North Port:Sarasota",
    "Jupiter:Palm Beach","Coconut Creek:Broward","Port Orange:Volusia",
    "Margate:Broward","Sanford:Seminole","Ocala:Marion","Sarasota:Sarasota",
    "Bradenton:Manatee","Pensacola:Escambia","Panama City:Bay","Bonita Springs:Lee",
    "St. Cloud:Osceola","Apopka:Orange","Ocoee:Orange","Winter Haven:Polk",
    "Altamonte Springs:Seminole","Cutler Bay:Miami-Dade","Aventura:Miami-Dade",
    "Oviedo:Seminole","Winter Garden:Orange","Clermont:Lake","Riverview:Hillsborough",
    "Brandon:Hillsborough","Valrico:Hillsborough","Wesley Chapel:Pasco",
    "Spring Hill:Hernando","New Port Richey:Pasco","Land O Lakes:Pasco",
    "Zephyrhills:Pasco","Dunedin:Pinellas","Tarpon Springs:Pinellas",
    "Safety Harbor:Pinellas","Oldsmar:Pinellas","Temple Terrace:Hillsborough",
    "Plant City:Hillsborough","Ruskin:Hillsborough","Sun City Center:Hillsborough",
    "Estero:Lee","Naples:Collier","Marco Island:Collier","Immokalee:Collier",
    "Lehigh Acres:Lee","North Fort Myers:Lee","Vero Beach:Indian River",
    "Sebastian:Indian River","Stuart:Martin","Titusville:Brevard",
    "Cocoa:Brevard","Rockledge:Brevard","Merritt Island:Brevard",
    "DeLand:Volusia","New Smyrna Beach:Volusia","Ormond Beach:Volusia",
    "Crestview:Okaloosa","Fort Walton Beach:Okaloosa","Destin:Okaloosa",
    "Niceville:Okaloosa","Navarre:Santa Rosa","Milton:Santa Rosa",
    "Pace:Santa Rosa","Lynn Haven:Bay","Callaway:Bay",
    "Leesburg:Lake","Eustis:Lake","Mount Dora:Lake","Tavares:Lake",
    "Lady Lake:Lake","The Villages:Sumter","Winter Springs:Seminole",
    "Casselberry:Seminole","Lake Mary:Seminole","Longwood:Seminole",
    "Winter Park:Orange","Maitland:Orange","Windermere:Orange",
  ],
  GA: [
    "Atlanta:Fulton","Columbus:Muscogee","Augusta:Richmond","Savannah:Chatham",
    "Athens:Clarke","Sandy Springs:Fulton","Roswell:Fulton","Macon:Bibb",
    "Johns Creek:Fulton","Albany:Dougherty","Warner Robins:Houston","Alpharetta:Fulton",
    "Marietta:Cobb","Valdosta:Lowndes","Smyrna:Cobb","Brookhaven:DeKalb",
    "Dunwoody:DeKalb","Peachtree City:Fayette","Kennesaw:Cobb","Dalton:Whitfield",
    "Gainesville:Hall","Milton:Fulton","Newnan:Coweta","Douglasville:Douglas",
    "Woodstock:Cherokee","Statesboro:Bulloch","Lawrenceville:Gwinnett",
    "Duluth:Gwinnett","Suwanee:Gwinnett","Snellville:Gwinnett",
    "Tucker:DeKalb","Peachtree Corners:Gwinnett","Acworth:Cobb","Canton:Cherokee",
    "Pooler:Chatham","Cartersville:Bartow","Hinesville:Liberty","Rome:Floyd",
    "McDonough:Henry","Griffin:Spalding","East Point:Fulton","Union City:Fulton",
    "Stockbridge:Henry","Covington:Newton","Conyers:Rockdale",
    "Decatur:DeKalb","Chamblee:DeKalb","Powder Springs:Cobb",
    "Holly Springs:Cherokee","Cumming:Forsyth","Buford:Gwinnett",
    "Flowery Branch:Hall","Braselton:Jackson","Evans:Columbia",
    "Martinez:Columbia","Grovetown:Columbia","Perry:Houston",
  ],
  HI: [
    "Honolulu:Honolulu","Pearl City:Honolulu","Hilo:Hawaii","Kailua:Honolulu",
    "Waipahu:Honolulu","Kaneohe:Honolulu","Mililani Town:Honolulu","Kahului:Maui",
    "Ewa Beach:Honolulu","Kapolei:Honolulu","Kihei:Maui","Aiea:Honolulu",
  ],
  ID: [
    "Boise:Ada","Meridian:Ada","Nampa:Canyon","Idaho Falls:Bonneville",
    "Caldwell:Canyon","Pocatello:Bannock","Coeur d'Alene:Kootenai","Twin Falls:Twin Falls",
    "Post Falls:Kootenai","Lewiston:Nez Perce","Eagle:Ada","Rexburg:Madison",
    "Moscow:Latah","Kuna:Ada","Star:Ada","Mountain Home:Elmore",
    "Hayden:Kootenai","Ammon:Bonneville","Chubbuck:Bannock",
  ],
  IL: [
    "Crystal Lake:McHenry","McHenry:McHenry","Algonquin:McHenry",
    "Lake in the Hills:McHenry","Huntley:McHenry","Woodstock:McHenry",
    "Cary:McHenry","Marengo:McHenry","Harvard:McHenry",
    "Carpentersville:Kane","Elgin:Kane","South Elgin:Kane","St. Charles:Kane",
    "Geneva:Kane","Batavia:Kane","Aurora:Kane","North Aurora:Kane","Montgomery:Kane",
    "Naperville:DuPage","Wheaton:DuPage","Downers Grove:DuPage","Lombard:DuPage",
    "Lisle:DuPage","Glen Ellyn:DuPage","Warrenville:DuPage","Woodridge:DuPage",
    "Villa Park:DuPage","Westmont:DuPage","Glendale Heights:DuPage","Clarendon Hills:DuPage",
    "Bolingbrook:Will","Plainfield:Will","Joliet:Will","Lockport:Will","Shorewood:Will",
    "Oswego:Kendall","Schaumburg:Cook","Arlington Heights:Cook","Lemont:Cook",
    "Highland Park:Lake","Lyons:Cook","Elk Grove Village:Cook","Chicago:Cook",
    "Rockford:Winnebago","Springfield:Sangamon","Peoria:Peoria","Champaign:Champaign",
    "Evanston:Cook","Skokie:Cook","Des Plaines:Cook","Berwyn:Cook",
    "Orland Park:Cook","Tinley Park:Cook","Oak Lawn:Cook","Cicero:Cook",
    "Palatine:Cook","Hoffman Estates:Cook","Oak Park:Cook","Waukegan:Lake",
    "Buffalo Grove:Lake","Wheeling:Cook","Mount Prospect:Cook","Carol Stream:DuPage",
    "Hanover Park:Cook","Addison:DuPage","Park Ridge:Cook","Bartlett:Cook",
    "Streamwood:Cook","Calumet City:Cook","Normal:McLean",
    "Bloomington:McLean","DeKalb:DeKalb","Belleville:St. Clair","O'Fallon:St. Clair",
    "Granite City:Madison","Edwardsville:Madison","Collinsville:Madison",
    "Carbondale:Jackson","Urbana:Champaign","Danville:Vermilion",
    "Quincy:Adams","Decatur:Macon","Galesburg:Knox","Moline:Rock Island",
    "Rock Island:Rock Island","Kankakee:Kankakee","Romeoville:Will",
    "Gurnee:Lake","Libertyville:Lake","Mundelein:Lake","Glenview:Cook",
    "Round Lake:Lake","Vernon Hills:Lake","Lake Zurich:Lake","Wauconda:Lake",
    "Island Lake:Lake","Fox Lake:Lake","Fox River Grove:McHenry",
  ],
  IN: [
    "Indianapolis:Marion","Fort Wayne:Allen","Evansville:Vanderburgh","South Bend:St. Joseph",
    "Carmel:Hamilton","Fishers:Hamilton","Bloomington:Monroe","Hammond:Lake",
    "Gary:Lake","Lafayette:Tippecanoe","Muncie:Delaware","Terre Haute:Vigo",
    "Noblesville:Hamilton","Kokomo:Howard","Anderson:Madison","Greenwood:Johnson",
    "Westfield:Hamilton","Elkhart:Elkhart","Jeffersonville:Clark","Columbus:Bartholomew",
    "Lawrence:Marion","New Albany:Floyd","Mishawaka:St. Joseph","Goshen:Elkhart",
    "Merrillville:Lake","Crown Point:Lake","Valparaiso:Porter","Michigan City:LaPorte",
    "Portage:Porter","Richmond:Wayne","Plainfield:Hendricks","Avon:Hendricks",
    "Brownsburg:Hendricks","Zionsville:Boone","Franklin:Johnson",
    "Granger:St. Joseph","Schererville:Lake","Munster:Lake","Highland:Lake",
    "East Chicago:Lake","Hobart:Lake","La Porte:LaPorte","Shelbyville:Shelby",
    "Marion:Grant","Logansport:Cass","Seymour:Jackson","Vincennes:Knox",
    "Jasper:Dubois","Bedford:Lawrence","Crawfordsville:Montgomery",
    "Connersville:Fayette","New Castle:Henry","Warsaw:Kosciusko",
  ],
  IA: [
    "Des Moines:Polk","Cedar Rapids:Linn","Davenport:Scott","Sioux City:Woodbury",
    "Iowa City:Johnson","Waterloo:Black Hawk","Ames:Story","West Des Moines:Polk",
    "Ankeny:Polk","Council Bluffs:Pottawattamie","Dubuque:Dubuque","Urbandale:Polk",
    "Cedar Falls:Black Hawk","Marion:Linn","Bettendorf:Scott","Mason City:Cerro Gordo",
    "Marshalltown:Marshall","Clinton:Clinton","Burlington:Des Moines",
    "Ottumwa:Wapello","Fort Dodge:Webster","Muscatine:Muscatine",
    "Coralville:Johnson","Johnston:Polk","Clive:Polk","North Liberty:Johnson",
    "Waukee:Dallas","Grimes:Polk","Altoona:Polk",
  ],
  KS: [
    "Wichita:Sedgwick","Overland Park:Johnson","Kansas City:Wyandotte",
    "Olathe:Johnson","Topeka:Shawnee","Lawrence:Douglas","Shawnee:Johnson",
    "Manhattan:Riley","Lenexa:Johnson","Salina:Saline","Hutchinson:Reno",
    "Leavenworth:Leavenworth","Leawood:Johnson","Dodge City:Ford",
    "Garden City:Finney","Emporia:Lyon","Derby:Sedgwick","Prairie Village:Johnson",
    "Junction City:Geary","Liberal:Seward","Hays:Ellis","Pittsburg:Crawford",
    "Newton:Harvey","Gardner:Johnson","Great Bend:Barton",
  ],
  KY: [
    "Louisville:Jefferson","Lexington:Fayette","Bowling Green:Warren",
    "Owensboro:Daviess","Covington:Kenton","Richmond:Madison",
    "Georgetown:Scott","Florence:Boone","Hopkinsville:Christian",
    "Nicholasville:Jessamine","Elizabethtown:Hardin","Henderson:Henderson",
    "Frankfort:Franklin","Independence:Kenton","Jeffersontown:Jefferson",
    "Paducah:McCracken","Radcliff:Hardin","Ashland:Boyd","Murray:Calloway",
    "Madisonville:Hopkins","Danville:Boyle","Erlanger:Kenton",
    "Burlington:Boone","Winchester:Clark","St. Matthews:Jefferson",
    "Fort Thomas:Campbell","Newport:Campbell","Bardstown:Nelson",
  ],
  LA: [
    "New Orleans:Orleans","Baton Rouge:East Baton Rouge","Shreveport:Caddo",
    "Lafayette:Lafayette","Lake Charles:Calcasieu","Kenner:Jefferson",
    "Bossier City:Bossier","Monroe:Ouachita","Alexandria:Rapides",
    "Houma:Terrebonne","Marrero:Jefferson","New Iberia:Iberia",
    "Laplace:St. John the Baptist","Slidell:St. Tammany","Central:East Baton Rouge",
    "Ruston:Lincoln","Sulphur:Calcasieu","Hammond:Tangipahoa",
    "Zachary:East Baton Rouge","Natchitoches:Natchitoches","Gretna:Jefferson",
    "Thibodaux:Lafourche","Opelousas:St. Landry","Mandeville:St. Tammany",
    "Covington:St. Tammany","Denham Springs:Livingston","Harvey:Jefferson",
    "Youngsville:Lafayette","Broussard:Lafayette","Gonzales:Ascension",
    "Prairieville:Ascension","Metairie:Jefferson","Chalmette:St. Bernard",
  ],
  ME: [
    "Portland:Cumberland","Lewiston:Androscoggin","Bangor:Penobscot",
    "South Portland:Cumberland","Auburn:Androscoggin","Biddeford:York",
    "Sanford:York","Saco:York","Westbrook:Cumberland","Augusta:Kennebec",
    "Scarborough:Cumberland","Brunswick:Cumberland","Gorham:Cumberland",
    "Windham:Cumberland","Waterville:Kennebec","Caribou:Aroostook",
    "Presque Isle:Aroostook","Ellsworth:Hancock",
  ],
  MD: [
    "Baltimore:Baltimore City","Columbia:Howard","Germantown:Montgomery",
    "Silver Spring:Montgomery","Waldorf:Charles","Glen Burnie:Anne Arundel",
    "Frederick:Frederick","Ellicott City:Howard","Dundalk:Baltimore",
    "Rockville:Montgomery","Bethesda:Montgomery","Bowie:Prince George's",
    "Towson:Baltimore","Gaithersburg:Montgomery","Laurel:Prince George's",
    "College Park:Prince George's","Hagerstown:Washington","Annapolis:Anne Arundel",
    "Severn:Anne Arundel","Odenton:Anne Arundel","Severna Park:Anne Arundel",
    "Salisbury:Wicomico","Cumberland:Allegany","Bel Air:Harford",
    "Elkton:Cecil","Aberdeen:Harford","Havre de Grace:Harford",
    "Catonsville:Baltimore","Owings Mills:Baltimore","Pikesville:Baltimore",
    "Reisterstown:Baltimore","Westminster:Carroll","Eldersburg:Carroll",
    "Pasadena:Anne Arundel","Arnold:Anne Arundel","Crofton:Anne Arundel",
    "Edgewater:Anne Arundel","Chesapeake Beach:Calvert","Lexington Park:St. Mary's",
    "Easton:Talbot","Cambridge:Dorchester","Ocean City:Worcester",
  ],
  MA: [
    "Boston:Suffolk","Worcester:Worcester","Springfield:Hampden","Lowell:Middlesex",
    "Cambridge:Middlesex","New Bedford:Bristol","Brockton:Plymouth","Quincy:Norfolk",
    "Lynn:Essex","Fall River:Bristol","Newton:Middlesex","Lawrence:Essex",
    "Somerville:Middlesex","Framingham:Middlesex","Haverhill:Essex","Waltham:Middlesex",
    "Malden:Middlesex","Medford:Middlesex","Taunton:Bristol","Chicopee:Hampden",
    "Weymouth:Norfolk","Revere:Suffolk","Peabody:Essex","Methuen:Essex",
    "Barnstable:Barnstable","Pittsfield:Berkshire","Leominster:Worcester",
    "Fitchburg:Worcester","Attleboro:Bristol","Salem:Essex","Westfield:Hampden",
    "Beverly:Essex","Holyoke:Hampden","Chelsea:Suffolk","Everett:Middlesex",
    "Plymouth:Plymouth","Marlborough:Middlesex","Woburn:Middlesex",
    "Natick:Middlesex","Needham:Norfolk","Wellesley:Norfolk","Brookline:Norfolk",
    "Arlington:Middlesex","Burlington:Middlesex","Watertown:Middlesex",
    "Lexington:Middlesex","Reading:Middlesex","Northampton:Hampshire",
    "Amherst:Hampshire","Gloucester:Essex","Newburyport:Essex",
  ],
  MI: [
    "Detroit:Wayne","Grand Rapids:Kent","Warren:Macomb","Sterling Heights:Macomb",
    "Ann Arbor:Washtenaw","Lansing:Ingham","Dearborn:Wayne","Livonia:Wayne",
    "Troy:Oakland","Farmington Hills:Oakland","Canton:Wayne","Kalamazoo:Kalamazoo",
    "Flint:Genesee","Clinton Township:Macomb","Westland:Wayne","Dearborn Heights:Wayne",
    "Rochester Hills:Oakland","Shelby Township:Macomb","Novi:Oakland",
    "Pontiac:Oakland","Taylor:Wayne","Royal Oak:Oakland","St. Clair Shores:Macomb",
    "Southfield:Oakland","Waterford:Oakland","West Bloomfield:Oakland",
    "Portage:Kalamazoo","Wyoming:Kent","Saginaw:Saginaw","Midland:Midland",
    "Bay City:Bay","East Lansing:Ingham","Roseville:Macomb","Muskegon:Muskegon",
    "Holland:Ottawa","Jackson:Jackson","Battle Creek:Calhoun","Traverse City:Grand Traverse",
    "Mount Pleasant:Isabella","Kentwood:Kent","Grandville:Kent","Walker:Kent",
    "Allen Park:Wayne","Lincoln Park:Wayne","Southgate:Wayne","Monroe:Monroe",
    "Redford:Wayne","Commerce Township:Oakland","Bloomfield Hills:Oakland",
    "Macomb:Macomb","Chesterfield:Macomb","Harrison Township:Macomb",
    "Ypsilanti:Washtenaw","Marquette:Marquette","Alpena:Alpena",
    "Petoskey:Emmet","Norton Shores:Muskegon",
  ],
  MN: [
    "Minneapolis:Hennepin","St. Paul:Ramsey","Rochester:Olmsted","Duluth:St. Louis",
    "Bloomington:Hennepin","Brooklyn Park:Hennepin","Plymouth:Hennepin",
    "Maple Grove:Hennepin","Woodbury:Washington","St. Cloud:Stearns",
    "Eagan:Dakota","Eden Prairie:Hennepin","Lakeville:Dakota","Coon Rapids:Anoka",
    "Burnsville:Dakota","Blaine:Anoka","Minnetonka:Hennepin","Apple Valley:Dakota",
    "Edina:Hennepin","St. Louis Park:Hennepin","Moorhead:Clay",
    "Mankato:Blue Earth","Shakopee:Scott","Maplewood:Ramsey",
    "Cottage Grove:Washington","Richfield:Hennepin","Roseville:Ramsey",
    "Inver Grove Heights:Dakota","Andover:Anoka","Ramsey:Anoka",
    "Savage:Scott","Prior Lake:Scott","Champlin:Hennepin",
    "Chanhassen:Carver","Fridley:Anoka","New Brighton:Ramsey",
    "Shoreview:Ramsey","Winona:Winona","Owatonna:Steele",
    "Faribault:Rice","Albert Lea:Freeborn","Austin:Mower",
    "Elk River:Sherburne","Hastings:Dakota","Stillwater:Washington",
    "Northfield:Rice","Red Wing:Goodhue","Fergus Falls:Otter Tail",
  ],
  MS: [
    "Jackson:Hinds","Gulfport:Harrison","Southaven:DeSoto","Hattiesburg:Forrest",
    "Biloxi:Harrison","Olive Branch:DeSoto","Tupelo:Lee","Meridian:Lauderdale",
    "Greenville:Washington","Horn Lake:DeSoto","Pearl:Rankin","Madison:Madison",
    "Oxford:Lafayette","Starkville:Oktibbeha","Clinton:Hinds","Brandon:Rankin",
    "Ridgeland:Madison","Vicksburg:Warren","Columbus:Lowndes","Pascagoula:Jackson",
    "Ocean Springs:Jackson","Long Beach:Harrison","Hernando:DeSoto",
    "Laurel:Jones","Natchez:Adams","Bay St. Louis:Hancock",
    "Gautier:Jackson","Moss Point:Jackson","Corinth:Alcorn",
  ],
  MO: [
    "Kansas City:Jackson","St. Louis:St. Louis City","Springfield:Greene",
    "Columbia:Boone","Independence:Jackson","Lee's Summit:Jackson",
    "O'Fallon:St. Charles","St. Joseph:Buchanan","St. Charles:St. Charles",
    "Blue Springs:Jackson","St. Peters:St. Charles","Florissant:St. Louis",
    "Joplin:Jasper","Chesterfield:St. Louis","Jefferson City:Cole",
    "Cape Girardeau:Cape Girardeau","Wildwood:St. Louis","University City:St. Louis",
    "Ballwin:St. Louis","Wentzville:St. Charles","Raymore:Cass",
    "Liberty:Clay","Gladstone:Clay","Raytown:Jackson",
    "Webster Groves:St. Louis","Kirkwood:St. Louis","Maryland Heights:St. Louis",
    "Sedalia:Pettis","Rolla:Phelps","Hannibal:Marion",
    "Nixa:Christian","Ozark:Christian","Republic:Greene",
    "Branson:Taney","Warrensburg:Johnson","Grain Valley:Jackson",
  ],
  MT: [
    "Billings:Yellowstone","Missoula:Missoula","Great Falls:Cascade",
    "Bozeman:Gallatin","Butte:Silver Bow","Helena:Lewis and Clark",
    "Kalispell:Flathead","Havre:Hill","Anaconda:Deer Lodge",
    "Miles City:Custer","Livingston:Park","Whitefish:Flathead",
    "Belgrade:Gallatin","Laurel:Yellowstone",
  ],
  NE: [
    "Omaha:Douglas","Lincoln:Lancaster","Bellevue:Sarpy","Grand Island:Hall",
    "Kearney:Buffalo","Fremont:Dodge","Hastings:Adams","Norfolk:Madison",
    "North Platte:Lincoln","Columbus:Platte","Papillion:Sarpy",
    "La Vista:Sarpy","Scottsbluff:Scotts Bluff","South Sioux City:Dakota",
    "Beatrice:Gage","Lexington:Dawson","Gering:Scotts Bluff",
    "Alliance:Box Butte","York:York","McCook:Red Willow",
  ],
  NV: [
    "Las Vegas:Clark","Henderson:Clark","Reno:Washoe","North Las Vegas:Clark",
    "Sparks:Washoe","Carson City:Carson City","Fernley:Lyon","Elko:Elko",
    "Mesquite:Clark","Boulder City:Clark","Fallon:Churchill","Winnemucca:Humboldt",
    "West Wendover:Elko","Pahrump:Nye","Spring Valley:Clark",
    "Sunrise Manor:Clark","Enterprise:Clark","Paradise:Clark",
    "Whitney:Clark","Summerlin South:Clark",
  ],
  NH: [
    "Manchester:Hillsborough","Nashua:Hillsborough","Concord:Merrimack",
    "Derry:Rockingham","Dover:Strafford","Rochester:Strafford",
    "Salem:Rockingham","Merrimack:Hillsborough","Londonderry:Rockingham",
    "Hudson:Hillsborough","Keene:Cheshire","Bedford:Hillsborough",
    "Portsmouth:Rockingham","Laconia:Belknap","Claremont:Sullivan",
    "Lebanon:Grafton","Hanover:Grafton","Exeter:Rockingham",
    "Hampton:Rockingham","Durham:Strafford","Milford:Hillsborough",
  ],
  NJ: [
    "Newark:Essex","Jersey City:Hudson","Paterson:Passaic","Elizabeth:Union",
    "Lakewood:Ocean","Edison:Middlesex","Woodbridge:Middlesex","Toms River:Ocean",
    "Hamilton:Mercer","Trenton:Mercer","Clifton:Passaic","Camden:Camden",
    "Brick:Ocean","Cherry Hill:Camden","Passaic:Passaic","Union City:Hudson",
    "Franklin:Somerset","Old Bridge:Middlesex","Middletown:Monmouth",
    "Bayonne:Hudson","East Orange:Essex","North Bergen:Hudson",
    "Vineland:Cumberland","Hoboken:Hudson","Perth Amboy:Middlesex",
    "West New York:Hudson","Plainfield:Union","Hackensack:Bergen",
    "Sayreville:Middlesex","Kearny:Hudson","Linden:Union",
    "Atlantic City:Atlantic","Long Branch:Monmouth","Rahway:Union",
    "Englewood:Bergen","Bergenfield:Bergen","Paramus:Bergen",
    "Bloomfield:Essex","West Orange:Essex","Montclair:Essex",
    "Maplewood:Essex","Morristown:Morris","Parsippany:Morris",
    "Livingston:Essex","Nutley:Essex","Cranford:Union",
    "Westfield:Union","Summit:Union","South Brunswick:Middlesex",
    "East Brunswick:Middlesex","North Brunswick:Middlesex","Piscataway:Middlesex",
    "Monroe:Middlesex","Princeton:Mercer","Ewing:Mercer",
    "Marlboro:Monmouth","Holmdel:Monmouth","Red Bank:Monmouth",
    "Freehold:Monmouth","Howell:Monmouth","Manalapan:Monmouth",
    "Wall:Monmouth","Ocean:Monmouth","Tinton Falls:Monmouth",
    "Bridgewater:Somerset","Somerville:Somerset","Bound Brook:Somerset",
    "Voorhees:Camden","Gloucester:Camden","Haddonfield:Camden",
    "Mount Laurel:Burlington","Evesham:Burlington","Moorestown:Burlington",
    "Burlington:Burlington","Willingboro:Burlington","Medford:Burlington",
  ],
  NM: [
    "Albuquerque:Bernalillo","Las Cruces:Dona Ana","Rio Rancho:Sandoval",
    "Santa Fe:Santa Fe","Roswell:Chaves","Farmington:San Juan",
    "Hobbs:Lea","Clovis:Curry","Carlsbad:Eddy","Alamogordo:Otero",
    "Las Vegas:San Miguel","Deming:Luna","Los Lunas:Valencia",
    "Gallup:McKinley","Sunland Park:Dona Ana","Silver City:Grant",
    "Artesia:Eddy","Lovington:Lea","Bernalillo:Sandoval",
  ],
  NY: [
    "New York:New York","Buffalo:Erie","Rochester:Monroe","Yonkers:Westchester",
    "Syracuse:Onondaga","Albany:Albany","New Rochelle:Westchester","Mount Vernon:Westchester",
    "Schenectady:Schenectady","Utica:Oneida","White Plains:Westchester",
    "Troy:Rensselaer","Niagara Falls:Niagara","Binghamton:Broome",
    "Freeport:Nassau","Valley Stream:Nassau","Long Beach:Nassau",
    "Hempstead:Nassau","Levittown:Nassau","Hicksville:Nassau",
    "Massapequa:Nassau","Plainview:Nassau","Syosset:Nassau",
    "Commack:Suffolk","Huntington:Suffolk","Smithtown:Suffolk",
    "Brookhaven:Suffolk","Islip:Suffolk","Babylon:Suffolk",
    "Bay Shore:Suffolk","Central Islip:Suffolk","Brentwood:Suffolk",
    "Patchogue:Suffolk","Riverhead:Suffolk","Centereach:Suffolk",
    "Coram:Suffolk","Medford:Suffolk","Lake Grove:Suffolk",
    "Saratoga Springs:Saratoga","Ithaca:Tompkins","Kingston:Ulster",
    "Poughkeepsie:Dutchess","Newburgh:Orange","Middletown:Orange",
    "Beacon:Dutchess","Peekskill:Westchester","Ossining:Westchester",
    "Tarrytown:Westchester","Port Chester:Westchester","Mamaroneck:Westchester",
    "Harrison:Westchester","Rome:Oneida","Watertown:Jefferson",
    "Plattsburgh:Clinton","Glens Falls:Warren","Amsterdam:Montgomery",
    "Oneonta:Otsego","Corning:Steuben","Elmira:Chemung",
    "Auburn:Cayuga","Batavia:Genesee","Geneva:Ontario",
    "Jamestown:Chautauqua","Lockport:Niagara","North Tonawanda:Niagara",
    "Tonawanda:Erie","Depew:Erie","Kenmore:Erie",
    "West Seneca:Erie","Cheektowaga:Erie","Amherst:Erie",
    "Hamburg:Erie","Orchard Park:Erie","Williamsville:Erie",
    "East Aurora:Erie","Lancaster:Erie","Clarence:Erie",
    "Irondequoit:Monroe","Greece:Monroe","Henrietta:Monroe",
    "Webster:Monroe","Pittsford:Monroe","Penfield:Monroe",
    "Brighton:Monroe","Gates:Monroe","Chili:Monroe",
  ],
  NC: [
    "Charlotte:Mecklenburg","Raleigh:Wake","Greensboro:Guilford","Durham:Durham",
    "Winston-Salem:Forsyth","Fayetteville:Cumberland","Cary:Wake","Wilmington:New Hanover",
    "High Point:Guilford","Concord:Cabarrus","Greenville:Pitt","Asheville:Buncombe",
    "Gastonia:Gaston","Jacksonville:Onslow","Chapel Hill:Orange","Huntersville:Mecklenburg",
    "Apex:Wake","Mooresville:Iredell","Holly Springs:Wake","Kannapolis:Cabarrus",
    "Burlington:Alamance","Indian Trail:Union","Cornelius:Mecklenburg","Matthews:Mecklenburg",
    "Mint Hill:Mecklenburg","Wake Forest:Wake","Monroe:Union","Sanford:Lee",
    "Hickory:Catawba","Salisbury:Rowan","Rocky Mount:Nash","Wilson:Wilson",
    "Goldsboro:Wayne","Kinston:Lenoir","New Bern:Craven","Lumberton:Robeson",
    "Thomasville:Davidson","Lexington:Davidson","Asheboro:Randolph",
    "Statesville:Iredell","Fuquay-Varina:Wake","Garner:Wake",
    "Clayton:Johnston","Smithfield:Johnston","Morrisville:Wake",
    "Carrboro:Orange","Knightdale:Wake","Kernersville:Forsyth",
    "Clemmons:Forsyth","Lewisville:Forsyth","King:Stokes",
    "Hendersonville:Henderson","Brevard:Transylvania","Waxhaw:Union",
    "Pineville:Mecklenburg","Davidson:Mecklenburg","Harrisburg:Cabarrus",
    "Shelby:Cleveland","Morganton:Burke","Marion:McDowell",
  ],
  ND: [
    "Fargo:Cass","Bismarck:Burleigh","Grand Forks:Grand Forks",
    "Minot:Ward","West Fargo:Cass","Williston:Williams",
    "Dickinson:Stark","Mandan:Morton","Jamestown:Stutsman",
    "Wahpeton:Richland","Devils Lake:Ramsey","Valley City:Barnes",
  ],
  OH: [
    "Columbus:Franklin","Cleveland:Cuyahoga","Cincinnati:Hamilton",
    "Toledo:Lucas","Akron:Summit","Dayton:Montgomery","Parma:Cuyahoga",
    "Canton:Stark","Youngstown:Mahoning","Lorain:Lorain","Hamilton:Butler",
    "Springfield:Clark","Kettering:Montgomery","Elyria:Lorain",
    "Lakewood:Cuyahoga","Cuyahoga Falls:Summit","Middletown:Butler",
    "Euclid:Cuyahoga","Mansfield:Richland","Newark:Licking",
    "Mentor:Lake","Beavercreek:Greene","Cleveland Heights:Cuyahoga",
    "Strongsville:Cuyahoga","Dublin:Franklin","Fairfield:Butler",
    "Findlay:Hancock","Warren:Trumbull","Lancaster:Fairfield",
    "Lima:Allen","Huber Heights:Montgomery","Westerville:Franklin",
    "Marion:Marion","Grove City:Franklin","Reynoldsburg:Franklin",
    "Delaware:Delaware","Brunswick:Medina","Upper Arlington:Franklin",
    "Gahanna:Franklin","Stow:Summit","North Olmsted:Cuyahoga",
    "North Royalton:Cuyahoga","Westlake:Cuyahoga","Avon:Lorain",
    "Avon Lake:Lorain","Solon:Cuyahoga","Mason:Warren",
    "Centerville:Montgomery","Trotwood:Montgomery","Xenia:Greene",
    "Wooster:Wayne","Medina:Medina","Wadsworth:Medina",
    "Massillon:Stark","Alliance:Stark","Green:Summit",
    "Barberton:Summit","Hudson:Summit","Twinsburg:Summit",
    "North Canton:Stark","Chillicothe:Ross","Zanesville:Muskingum",
    "Sandusky:Erie","Fremont:Sandusky","Bowling Green:Wood",
    "Defiance:Defiance","Ashland:Ashland","New Philadelphia:Tuscarawas",
    "Dover:Tuscarawas","Cambridge:Guernsey","Piqua:Miami","Troy:Miami",
    "Sidney:Shelby","Marysville:Union","Powell:Delaware",
    "Lewis Center:Delaware","Hilliard:Franklin","Pickerington:Fairfield",
    "Canal Winchester:Franklin","Pataskala:Licking","Heath:Licking",
  ],
  OK: [
    "Oklahoma City:Oklahoma","Tulsa:Tulsa","Norman:Cleveland","Broken Arrow:Tulsa",
    "Edmond:Oklahoma","Lawton:Comanche","Moore:Cleveland","Midwest City:Oklahoma",
    "Enid:Garfield","Stillwater:Payne","Owasso:Tulsa","Bartlesville:Washington",
    "Muskogee:Muskogee","Shawnee:Pottawatomie","Bixby:Tulsa","Jenks:Tulsa",
    "Yukon:Canadian","Del City:Oklahoma","Mustang:Canadian","Sand Springs:Tulsa",
    "Bethany:Oklahoma","Sapulpa:Creek","Claremore:Rogers","Duncan:Stephens",
    "Ardmore:Carter","Ponca City:Kay","Ada:Pontotoc","Chickasha:Grady",
    "Tahlequah:Cherokee","McAlester:Pittsburg",
  ],
  OR: [
    "Portland:Multnomah","Salem:Marion","Eugene:Lane","Gresham:Multnomah",
    "Hillsboro:Washington","Beaverton:Washington","Bend:Deschutes","Medford:Jackson",
    "Springfield:Lane","Corvallis:Benton","Albany:Linn","Tigard:Washington",
    "Lake Oswego:Clackamas","Keizer:Marion","Grants Pass:Josephine",
    "Oregon City:Clackamas","McMinnville:Yamhill","Redmond:Deschutes",
    "Tualatin:Washington","West Linn:Clackamas","Woodburn:Marion",
    "Forest Grove:Washington","Newberg:Yamhill","Wilsonville:Clackamas",
    "Roseburg:Douglas","Ashland:Jackson","Klamath Falls:Klamath",
    "Milwaukie:Clackamas","Canby:Clackamas","Happy Valley:Clackamas",
    "Sherwood:Washington","Coos Bay:Coos","The Dalles:Wasco",
    "Pendleton:Umatilla","Hermiston:Umatilla","La Grande:Union",
    "Central Point:Jackson","Troutdale:Multnomah","Fairview:Multnomah",
  ],
  PA: [
    "Philadelphia:Philadelphia","Pittsburgh:Allegheny","Allentown:Lehigh",
    "Reading:Berks","Scranton:Lackawanna","Bethlehem:Northampton","Lancaster:Lancaster",
    "Harrisburg:Dauphin","York:York","Wilkes-Barre:Luzerne","Erie:Erie",
    "Chester:Delaware","Easton:Northampton","Lebanon:Lebanon",
    "Hazleton:Luzerne","Norristown:Montgomery","Pottstown:Montgomery",
    "State College:Centre","Williamsport:Lycoming","Carlisle:Cumberland",
    "Chambersburg:Franklin","Hanover:York","Mechanicsburg:Cumberland",
    "King of Prussia:Montgomery","Levittown:Bucks","Bensalem:Bucks",
    "Bristol:Bucks","Doylestown:Bucks","Warminster:Bucks",
    "Abington:Montgomery","Cheltenham:Montgomery","Lansdale:Montgomery",
    "Phoenixville:Chester","West Chester:Chester","Coatesville:Chester",
    "Kennett Square:Chester","Downingtown:Chester","Exton:Chester",
    "Media:Delaware","Springfield:Delaware","Drexel Hill:Delaware",
    "Havertown:Delaware","Broomall:Delaware","Conshohocken:Montgomery",
    "Ardmore:Montgomery","Wynnewood:Montgomery","Bala Cynwyd:Montgomery",
    "Wyndmoor:Montgomery","Ambler:Montgomery","Horsham:Montgomery",
    "Blue Bell:Montgomery","Plymouth Meeting:Montgomery","Collegeville:Montgomery",
    "New Castle:Lawrence","Butler:Butler","Greensburg:Westmoreland",
    "Monroeville:Allegheny","Bethel Park:Allegheny","Mount Lebanon:Allegheny",
    "Upper St. Clair:Allegheny","Peters Township:Washington","Cranberry Township:Butler",
    "Moon Township:Allegheny","McCandless:Allegheny","Ross Township:Allegheny",
    "Shaler:Allegheny","Franklin Park:Allegheny","Robinson Township:Allegheny",
    "North Huntingdon:Westmoreland","Murrysville:Westmoreland",
    "Latrobe:Westmoreland","Indiana:Indiana","Johnstown:Cambria",
    "Altoona:Blair","Meadville:Crawford","Oil City:Venango",
    "Warren:Warren","Bradford:McKean","Sunbury:Northumberland",
    "Lewisburg:Union","Selinsgrove:Snyder","Bloomsburg:Columbia",
    "Stroudsburg:Monroe","East Stroudsburg:Monroe","Jim Thorpe:Carbon",
  ],
  RI: [
    "Providence:Providence","Warwick:Kent","Cranston:Providence",
    "Pawtucket:Providence","East Providence:Providence","Woonsocket:Providence",
    "Coventry:Kent","Cumberland:Providence","North Providence:Providence",
    "South Kingstown:Washington","West Warwick:Kent","Johnston:Providence",
    "North Kingstown:Washington","Newport:Newport","Bristol:Bristol",
    "Lincoln:Providence","Central Falls:Providence","Smithfield:Providence",
  ],
  SC: [
    "Charleston:Charleston","Columbia:Richland","North Charleston:Charleston",
    "Mount Pleasant:Charleston","Rock Hill:York","Greenville:Greenville",
    "Summerville:Dorchester","Goose Creek:Berkeley","Hilton Head Island:Beaufort",
    "Sumter:Sumter","Florence:Florence","Spartanburg:Spartanburg",
    "Myrtle Beach:Horry","North Myrtle Beach:Horry","Conway:Horry",
    "Anderson:Anderson","Greer:Greenville","Aiken:Aiken",
    "Mauldin:Greenville","Simpsonville:Greenville","Easley:Pickens",
    "Taylors:Greenville","Hanahan:Berkeley","Irmo:Richland",
    "Bluffton:Beaufort","Beaufort:Beaufort","Lexington:Lexington",
    "West Columbia:Lexington","Cayce:Lexington","Fort Mill:York",
    "Tega Cay:York","Indian Land:Lancaster","Camden:Kershaw",
    "Orangeburg:Orangeburg","Clemson:Pickens","Seneca:Oconee",
    "Newberry:Newberry","Laurens:Laurens","Gaffney:Cherokee",
  ],
  SD: [
    "Sioux Falls:Minnehaha","Rapid City:Pennington","Aberdeen:Brown",
    "Brookings:Brookings","Watertown:Codington","Mitchell:Davison",
    "Yankton:Yankton","Huron:Beadle","Pierre:Hughes",
    "Spearfish:Lawrence","Vermillion:Clay","Brandon:Minnehaha",
    "Box Elder:Pennington","Harrisburg:Lincoln","Tea:Lincoln",
  ],
  TN: [
    "Nashville:Davidson","Memphis:Shelby","Knoxville:Knox","Chattanooga:Hamilton",
    "Clarksville:Montgomery","Murfreesboro:Rutherford","Franklin:Williamson",
    "Jackson:Madison","Johnson City:Washington","Bartlett:Shelby",
    "Hendersonville:Sumner","Kingsport:Sullivan","Collierville:Shelby",
    "Smyrna:Rutherford","Cleveland:Bradley","Brentwood:Williamson",
    "Germantown:Shelby","Spring Hill:Maury","La Vergne:Rutherford",
    "Mount Juliet:Wilson","Lebanon:Wilson","Gallatin:Sumner",
    "Cookeville:Putnam","Oak Ridge:Anderson","Maryville:Blount",
    "Bristol:Sullivan","Farragut:Knox","Morristown:Hamblen",
    "Tullahoma:Coffee","Shelbyville:Bedford","Columbia:Maury",
    "Sevierville:Sevier","Pigeon Forge:Sevier","Gatlinburg:Sevier",
    "Dyersburg:Dyer","Martin:Weakley","Paris:Henry",
    "McMinnville:Warren","Crossville:Cumberland","Athens:McMinn",
    "Soddy-Daisy:Hamilton","Red Bank:Hamilton","East Ridge:Hamilton",
    "Signal Mountain:Hamilton","Nolensville:Williamson","Thompson's Station:Williamson",
  ],
  TX: [
    "Houston:Harris","San Antonio:Bexar","Dallas:Dallas","Austin:Travis",
    "Fort Worth:Tarrant","El Paso:El Paso","Arlington:Tarrant","Corpus Christi:Nueces",
    "Plano:Collin","Laredo:Webb","Lubbock:Lubbock","Garland:Dallas",
    "Irving:Dallas","Amarillo:Potter","Grand Prairie:Dallas","Brownsville:Cameron",
    "McKinney:Collin","Frisco:Collin","Pasadena:Harris","Killeen:Bell",
    "McAllen:Hidalgo","Mesquite:Dallas","Midland:Midland","Denton:Denton",
    "Waco:McLennan","Carrollton:Dallas","Round Rock:Williamson","Abilene:Taylor",
    "Pearland:Brazoria","Richardson:Dallas","Odessa:Ector","Sugar Land:Fort Bend",
    "College Station:Brazos","Beaumont:Jefferson","Lewisville:Denton",
    "Allen:Collin","League City:Galveston","Tyler:Smith","Edinburg:Hidalgo",
    "San Marcos:Hays","Wichita Falls:Wichita","Flower Mound:Denton",
    "Temple:Bell","North Richland Hills:Tarrant","Pharr:Hidalgo",
    "Missouri City:Fort Bend","Baytown:Harris","New Braunfels:Comal",
    "Pflugerville:Travis","Cedar Park:Williamson","Georgetown:Williamson",
    "Mansfield:Tarrant","Rowlett:Dallas","Victoria:Victoria",
    "Conroe:Montgomery","Bryan:Brazos","Wylie:Collin","Cedar Hill:Dallas",
    "Burleson:Johnson","Haltom City:Tarrant","The Colony:Denton",
    "DeSoto:Dallas","Lancaster:Dallas","Friendswood:Galveston",
    "Duncanville:Dallas","Keller:Tarrant","Coppell:Dallas",
    "Hurst:Tarrant","Grapevine:Tarrant","Colleyville:Tarrant",
    "Southlake:Tarrant","Euless:Tarrant","Bedford:Tarrant",
    "Weatherford:Parker","Cleburne:Johnson","Granbury:Hood",
    "Mineral Wells:Palo Pinto","Stephenville:Erath","Corsicana:Navarro",
    "Greenville:Hunt","Sherman:Grayson","Denison:Grayson",
    "Texarkana:Bowie","Longview:Gregg","Marshall:Harrison",
    "Nacogdoches:Nacogdoches","Lufkin:Angelina","Palestine:Anderson",
    "Jacksonville:Cherokee","Henderson:Rusk","Athens:Henderson",
    "Port Arthur:Jefferson","Orange:Orange","Vidor:Orange",
    "Nederland:Jefferson","Jasper:Jasper","Silsbee:Hardin",
    "Huntsville:Walker","Brenham:Washington","Navasota:Grimes",
    "Bay City:Matagorda","Rosenberg:Fort Bend","Richmond:Fort Bend",
    "Katy:Harris","Tomball:Harris","Spring:Harris",
    "Humble:Harris","Kingwood:Harris","Atascocita:Harris",
    "The Woodlands:Montgomery","Magnolia:Montgomery","Willis:Montgomery",
    "Galveston:Galveston","Texas City:Galveston","La Marque:Galveston",
    "Dickinson:Galveston","Angleton:Brazoria","Clute:Brazoria",
    "Lake Jackson:Brazoria","Freeport:Brazoria","Alvin:Brazoria",
    "San Benito:Cameron","Harlingen:Cameron","Weslaco:Hidalgo",
    "Mission:Hidalgo","Donna:Hidalgo","Mercedes:Hidalgo",
    "Seguin:Guadalupe","Schertz:Guadalupe","Cibolo:Guadalupe",
    "Boerne:Kendall","Helotes:Bexar","Live Oak:Bexar",
    "Universal City:Bexar","Selma:Guadalupe","Converse:Bexar",
    "Kyle:Hays","Buda:Hays",
    "Dripping Springs:Hays","Lockhart:Caldwell","Bastrop:Bastrop",
    "Taylor:Williamson","Hutto:Williamson","Leander:Williamson",
    "Liberty Hill:Williamson","Marble Falls:Burnet","Lampasas:Lampasas",
    "Copperas Cove:Coryell","Harker Heights:Bell","Belton:Bell",
  ],
  UT: [
    "Salt Lake City:Salt Lake","West Valley City:Salt Lake","Provo:Utah",
    "West Jordan:Salt Lake","Orem:Utah","Sandy:Salt Lake","Ogden:Weber",
    "St. George:Washington","Layton:Davis","South Jordan:Salt Lake",
    "Lehi:Utah","Millcreek:Salt Lake","Taylorsville:Salt Lake","Logan:Cache",
    "Murray:Salt Lake","Draper:Salt Lake","Bountiful:Davis","Riverton:Salt Lake",
    "Herriman:Salt Lake","Spanish Fork:Utah","Roy:Weber","Pleasant Grove:Utah",
    "Tooele:Tooele","Cottonwood Heights:Salt Lake","Midvale:Salt Lake",
    "Springville:Utah","Eagle Mountain:Utah","Cedar City:Iron",
    "Kaysville:Davis","Clearfield:Davis","Holladay:Salt Lake",
    "American Fork:Utah","Syracuse:Davis","Saratoga Springs:Utah",
    "North Ogden:Weber","Farmington:Davis","Centerville:Davis",
    "Clinton:Davis","Payson:Utah","Brigham City:Box Elder",
    "Highland:Utah","Alpine:Utah","Lindon:Utah","Vineyard:Utah",
  ],
  VT: [
    "Burlington:Chittenden","South Burlington:Chittenden","Rutland:Rutland",
    "Essex Junction:Chittenden","Barre:Washington","Montpelier:Washington",
    "Winooski:Chittenden","St. Albans:Franklin","Bennington:Bennington",
    "Brattleboro:Windham","St. Johnsbury:Caledonia","Newport:Orleans",
    "Middlebury:Addison","Shelburne:Chittenden","Williston:Chittenden",
  ],
  VA: [
    "Virginia Beach:Virginia Beach","Norfolk:Norfolk","Chesapeake:Chesapeake",
    "Richmond:Richmond","Newport News:Newport News","Alexandria:Alexandria",
    "Hampton:Hampton","Roanoke:Roanoke","Portsmouth:Portsmouth",
    "Suffolk:Suffolk","Lynchburg:Lynchburg","Harrisonburg:Harrisonburg",
    "Leesburg:Loudoun","Charlottesville:Charlottesville","Danville:Danville",
    "Blacksburg:Montgomery","Manassas:Manassas","Petersburg:Petersburg",
    "Fredericksburg:Fredericksburg","Winchester:Winchester",
    "Salem:Salem","Staunton:Staunton","Waynesboro:Waynesboro",
    "Radford:Radford","Bristol:Bristol","Colonial Heights:Colonial Heights",
    "Woodbridge:Prince William","Ashburn:Loudoun","Sterling:Loudoun",
    "Reston:Fairfax","Herndon:Fairfax","Centreville:Fairfax",
    "Burke:Fairfax","Fairfax:Fairfax","Annandale:Fairfax",
    "Springfield:Fairfax","McLean:Fairfax","Falls Church:Falls Church",
    "Tysons:Fairfax","Vienna:Fairfax","Chantilly:Fairfax",
    "Dale City:Prince William","Dumfries:Prince William","Gainesville:Prince William",
    "Lake Ridge:Prince William","Montclair:Prince William","Stafford:Stafford",
    "Spotsylvania:Spotsylvania","Culpeper:Culpeper","Warrenton:Fauquier",
    "Front Royal:Warren","Christiansburg:Montgomery","Pulaski:Pulaski",
    "Wytheville:Wythe","Abingdon:Washington","Marion:Smyth",
  ],
  WA: [
    "Seattle:King","Spokane:Spokane","Tacoma:Pierce","Vancouver:Clark",
    "Bellevue:King","Kent:King","Everett:Snohomish","Renton:King",
    "Spokane Valley:Spokane","Federal Way:King","Kirkland:King",
    "Auburn:King","Bellingham:Whatcom","Kennewick:Benton","Redmond:King",
    "Marysville:Snohomish","Pasco:Franklin","Lakewood:Pierce",
    "Sammamish:King","Olympia:Thurston","Lacey:Thurston","Tumwater:Thurston",
    "Burien:King","Shoreline:King","Lynnwood:Snohomish","Edmonds:Snohomish",
    "Bothell:King","Puyallup:Pierce","Bonney Lake:Pierce","Issaquah:King",
    "Bremerton:Kitsap","Walla Walla:Walla Walla","Wenatchee:Chelan",
    "Mount Vernon:Skagit","Pullman:Whitman","Moses Lake:Grant",
    "Centralia:Lewis","Ellensburg:Kittitas","Longview:Cowlitz",
    "Kelso:Cowlitz","Richland:Benton","West Richland:Benton",
    "University Place:Pierce","Gig Harbor:Pierce","Maple Valley:King",
    "Covington:King","SeaTac:King","Tukwila:King","Des Moines:King",
    "Mercer Island:King","Woodinville:King","Lake Stevens:Snohomish",
    "Snohomish:Snohomish","Monroe:Snohomish","Arlington:Snohomish",
    "Stanwood:Snohomish","Oak Harbor:Island","Anacortes:Skagit",
    "Sequim:Clallam","Port Angeles:Clallam","Port Townsend:Jefferson",
  ],
  WV: [
    "Charleston:Kanawha","Huntington:Cabell","Morgantown:Monongalia",
    "Parkersburg:Wood","Wheeling:Ohio","Weirton:Hancock",
    "Fairmont:Marion","Beckley:Raleigh","Clarksburg:Harrison",
    "Martinsburg:Berkeley","South Charleston:Kanawha","Bluefield:Mercer",
    "Bridgeport:Harrison","Vienna:Wood","Teays Valley:Putnam",
    "Hurricane:Putnam","Elkins:Randolph","Lewisburg:Greenbrier",
    "Princeton:Mercer","Keyser:Mineral",
  ],
  WI: [
    "Milwaukee:Milwaukee","Madison:Dane","Green Bay:Brown","Kenosha:Kenosha",
    "Racine:Racine","Appleton:Outagamie","Waukesha:Waukesha","Eau Claire:Eau Claire",
    "Oshkosh:Winnebago","Janesville:Rock","West Allis:Milwaukee",
    "La Crosse:La Crosse","Sheboygan:Sheboygan","Wauwatosa:Milwaukee",
    "Fond du Lac:Fond du Lac","New Berlin:Waukesha","Wausau:Marathon",
    "Brookfield:Waukesha","Beloit:Rock","Greenfield:Milwaukee",
    "Franklin:Milwaukee","Oak Creek:Milwaukee","Manitowoc:Manitowoc",
    "West Bend:Washington","Sun Prairie:Dane","Fitchburg:Dane",
    "Mount Pleasant:Racine","Menomonee Falls:Waukesha","Muskego:Waukesha",
    "Caledonia:Racine","Germantown:Washington","Stevens Point:Portage",
    "Marshfield:Wood","Wisconsin Rapids:Wood","Superior:Douglas",
    "De Pere:Brown","Ashwaubenon:Brown","Howard:Brown","Suamico:Brown",
    "Menasha:Winnebago","Neenah:Winnebago","Kaukauna:Outagamie",
    "Middleton:Dane","Oregon:Dane","Verona:Dane","Stoughton:Dane",
    "Beaver Dam:Dodge","Watertown:Jefferson","Fort Atkinson:Jefferson",
    "Whitewater:Walworth","Elkhorn:Walworth","Lake Geneva:Walworth",
    "Burlington:Racine","Oconomowoc:Waukesha","Delafield:Waukesha",
    "Pewaukee:Waukesha","Sussex:Waukesha","Hartland:Waukesha",
    "Mukwonago:Waukesha","Grafton:Ozaukee","Cedarburg:Ozaukee",
    "Mequon:Ozaukee",
  ],
  WY: [
    "Cheyenne:Laramie","Casper:Natrona","Laramie:Albany","Gillette:Campbell",
    "Rock Springs:Sweetwater","Sheridan:Sheridan","Green River:Sweetwater",
    "Evanston:Uinta","Riverton:Fremont","Jackson:Teton",
    "Cody:Park","Lander:Fremont","Rawlins:Carbon","Powell:Park",
    "Torrington:Goshen","Douglas:Converse",
  ],
};

// Cities that already have hand-crafted content in cities-data.ts
const HANDCRAFTED = new Set([
  "IL:crystal-lake","IL:mchenry","IL:algonquin","IL:lake-in-the-hills","IL:huntley",
  "IL:woodstock","IL:cary","IL:marengo","IL:harvard","IL:carpentersville","IL:elgin",
  "IL:south-elgin","IL:st-charles","IL:geneva","IL:batavia","IL:aurora","IL:north-aurora",
  "IL:montgomery","IL:naperville","IL:wheaton","IL:downers-grove","IL:lombard","IL:lisle",
  "IL:glen-ellyn","IL:warrenville","IL:woodridge","IL:villa-park","IL:westmont",
  "IL:glendale-heights","IL:clarendon-hills","IL:bolingbrook","IL:plainfield","IL:joliet",
  "IL:lockport","IL:shorewood","IL:oswego","IL:schaumburg","IL:arlington-heights",
  "IL:lemont","IL:highland-park","IL:lyons","IL:elk-grove-village","IL:chicago",
  "IL:rockford","IL:springfield","IL:peoria","IL:champaign",
  "CA:los-angeles","CA:san-diego","CA:san-jose","CA:san-francisco","CA:fresno",
  "CA:sacramento","CA:long-beach","CA:oakland","CA:bakersfield","CA:anaheim",
  "CA:santa-ana","CA:riverside","CA:stockton","CA:irvine",
  // chula-vista intentionally NOT in HANDCRAFTED: no entry exists in cities-data.ts,
  // so it must flow through the generated path from RAW_CITIES instead. Removing
  // it here closes fpnm-009 (prior [fpnm-001] hotfix was wiped by generator re-runs).
  "TX:houston","TX:san-antonio","TX:dallas","TX:austin","TX:fort-worth","TX:el-paso",
  "TX:arlington","TX:corpus-christi","TX:plano","TX:laredo","TX:lubbock",
  "FL:jacksonville","FL:miami","FL:tampa","FL:orlando","FL:st-petersburg",
  "NY:new-york","NY:buffalo","NY:rochester",
  "PA:philadelphia","PA:pittsburgh",
  "AZ:phoenix","AZ:tucson","AZ:mesa","AZ:chandler","AZ:gilbert","AZ:glendale","AZ:scottsdale",
  "GA:atlanta","GA:savannah",
  "NC:charlotte","NC:raleigh",
  "OH:columbus","OH:cleveland","OH:cincinnati",
  "CO:denver","CO:colorado-springs","CO:aurora",
  "WA:seattle","WA:spokane","WA:tacoma",
  "TN:nashville","TN:memphis","TN:knoxville",
  "MA:boston",
  "IN:indianapolis",
  "MO:kansas-city","MO:st-louis",
  "MD:baltimore",
  "WI:milwaukee","WI:madison",
  "MN:minneapolis","MN:st-paul",
  "LA:new-orleans","LA:baton-rouge","LA:shreveport",
  "NV:las-vegas","NV:henderson","NV:reno",
  "AL:birmingham","AL:huntsville","AL:montgomery","AL:mobile",
  "KY:louisville","KY:lexington",
  "OR:portland","OR:salem","OR:eugene",
  "OK:oklahoma-city","OK:tulsa",
  "CT:bridgeport","CT:new-haven","CT:stamford","CT:hartford",
  "UT:salt-lake-city",
  "MI:detroit","MI:grand-rapids",
  "NJ:newark","NJ:jersey-city",
  "VA:virginia-beach",
  "SC:charleston",
  "NE:omaha","NE:lincoln",
  "HI:honolulu",
  "NM:albuquerque",
  "WV:charleston",
  "ID:boise",
  "NH:manchester",
  "ME:portland",
  "RI:providence",
  "DE:wilmington",
  "SD:sioux-falls",
  "ND:fargo","ND:bismarck",
  "MT:billings",
  "VT:burlington",
  "WY:cheyenne","WY:casper","WY:laramie",
  "AK:anchorage",
  "DC:washington",
  "AR:little-rock",
  "MS:jackson",
  "KS:wichita",
  "IA:des-moines",
]);

const STATE_SLUGS = {
  AL:"alabama",AK:"alaska",AZ:"arizona",AR:"arkansas",CA:"california",
  CO:"colorado",CT:"connecticut",DE:"delaware",DC:"district-of-columbia",
  FL:"florida",GA:"georgia",HI:"hawaii",ID:"idaho",IL:"illinois",
  IN:"indiana",IA:"iowa",KS:"kansas",KY:"kentucky",LA:"louisiana",
  ME:"maine",MD:"maryland",MA:"massachusetts",MI:"michigan",MN:"minnesota",
  MS:"mississippi",MO:"missouri",MT:"montana",NE:"nebraska",NV:"nevada",
  NH:"new-hampshire",NJ:"new-jersey",NM:"new-mexico",NY:"new-york",
  NC:"north-carolina",ND:"north-dakota",OH:"ohio",OK:"oklahoma",
  OR:"oregon",PA:"pennsylvania",RI:"rhode-island",SC:"south-carolina",
  SD:"south-dakota",TN:"tennessee",TX:"texas",UT:"utah",VT:"vermont",
  VA:"virginia",WA:"washington",WV:"west-virginia",WI:"wisconsin",WY:"wyoming",
};

// Build all non-handcrafted cities
const allCities = {};
for (const [state, pairs] of Object.entries(RAW_CITIES)) {
  const seen = new Set();
  allCities[state] = [];
  for (const pair of pairs) {
    const [name, county] = pair.split(":");
    const slug = slugify(name);
    const key = `${state}:${slug}`;
    if (seen.has(slug) || HANDCRAFTED.has(key)) continue;
    seen.add(slug);
    allCities[state].push({ slug, name, county });
  }
}

// Nearby cities: same county first, then adjacent entries
function getNearbyCities(state, index, cities) {
  const city = cities[index];
  const nearby = [];
  for (let i = 0; i < cities.length; i++) {
    if (i === index) continue;
    if (cities[i].county === city.county && nearby.length < 4) {
      nearby.push(cities[i]);
    }
  }
  if (nearby.length < 3) {
    for (let offset = 1; offset <= 3; offset++) {
      if (nearby.length >= 4) break;
      if (index + offset < cities.length && !nearby.includes(cities[index + offset]))
        nearby.push(cities[index + offset]);
      if (index - offset >= 0 && !nearby.includes(cities[index - offset]) && nearby.length < 4)
        nearby.push(cities[index - offset]);
    }
  }
  return nearby.slice(0, 5);
}

function generateHero(name, county, state) {
  const region = getRegion(state);
  const templates = HERO_TEMPLATES[region];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return templates[Math.abs(hash) % templates.length](name, county);
}

// Generate the output file
let output = `/**
 * Generated city data — 2,000+ additional US cities.
 * This file is auto-generated by scripts/generate-cities-data.mjs
 * It exports a function that registers cities into the CITY_DATA object.
 */

import type { CityInfo, NearbyCityRef } from "./cities-data";

function nc(name: string, citySlug: string, stateSlug: string): NearbyCityRef {
  return { name, citySlug, stateSlug };
}

export function registerGeneratedCities(
  CITY_DATA: Record<string, Record<string, CityInfo>>
) {
  function add(state: string, cities: Record<string, CityInfo>) {
    if (!CITY_DATA[state]) CITY_DATA[state] = {};
    Object.assign(CITY_DATA[state], cities);
  }

`;

const stateOrder = Object.keys(RAW_CITIES).sort();
let totalGenerated = 0;

for (const state of stateOrder) {
  const cities = allCities[state];
  if (!cities || cities.length === 0) continue;
  const stateSlug = STATE_SLUGS[state];

  output += `  // ${state} (${cities.length} cities)\n`;
  output += `  add("${state}", {\n`;

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    const hero = generateHero(city.name, city.county, state);
    const nearby = getNearbyCities(state, i, cities);
    const nearbyStr = nearby.map(n =>
      `nc("${n.name.replace(/"/g, '\\"')}","${n.slug}","${stateSlug}")`
    ).join(", ");

    // Escape any quotes in hero and name
    const escapedName = city.name.replace(/"/g, '\\"');
    const escapedCounty = city.county.replace(/"/g, '\\"');
    const escapedHero = hero.replace(/"/g, '\\"').replace(/'/g, "'");

    output += `    "${city.slug}": { name: "${escapedName}", state: "${state}", county: "${escapedCounty}", heroContent: "${escapedHero}", nearbyCities: [${nearbyStr}] },\n`;
    totalGenerated++;
  }

  output += `  });\n\n`;
}

output += `}\n`;

console.log(`Generated ${totalGenerated} new cities (excluding hand-crafted)`);

const outPath = resolve(__dirname, "../src/lib/cities-generated.ts");
writeFileSync(outPath, output);
console.log(`Wrote ${outPath}`);

// ===========================================================================
// COORD BACKFILL — emit src/lib/city-coords.ts from the same RAW_CITIES seed
// ===========================================================================

const COORDS_CACHE_PATH = resolve(__dirname, "city-coords-cache.json");
const COORDS_OUT_PATH = resolve(__dirname, "../src/lib/city-coords.ts");
const US_CITIES_CSV_PATH = resolve(__dirname, "data/us-cities.csv");

const STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"DC",FL:"Florida",
  GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",
  IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",
  MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

// Every city in RAW_CITIES needs a coord (handcrafted + generated alike).
const targetCities = [];
for (const [state, pairs] of Object.entries(RAW_CITIES)) {
  const seen = new Set();
  for (const pair of pairs) {
    const [name] = pair.split(":");
    const slug = slugify(name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    targetCities.push({ state, slug, name });
  }
}

// Seed the coord map from two sources, in order:
//   1) existing src/lib/city-coords.ts (parse its COORDS literal)
//   2) scripts/city-coords-cache.json (canonical; overrides existing)
// After this run the cache is the source of truth — city-coords.ts is
// regenerated deterministically from it.
function parseExistingCoords() {
  if (!existsSync(COORDS_OUT_PATH)) return {};
  const text = readFileSync(COORDS_OUT_PATH, "utf-8");
  const map = {};
  const re = /"([A-Z]{2}):([a-z0-9-]+)":\s*\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = `${m[1]}:${m[2]}`;
    if (!(key in map)) map[key] = [parseFloat(m[3]), parseFloat(m[4])];
  }
  return map;
}

function loadCache() {
  if (!existsSync(COORDS_CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(COORDS_CACHE_PATH, "utf-8"));
  } catch (err) {
    console.error(`  [cache] failed to parse ${COORDS_CACHE_PATH}: ${err.message}`);
    return {};
  }
}

function saveCache(map) {
  // Stable key order so diffs stay readable.
  const sorted = {};
  for (const key of Object.keys(map).sort()) sorted[key] = map[key];
  writeFileSync(COORDS_CACHE_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function geocode(name, state) {
  if (!GOOGLE_API_KEY) return { fatal: true, reason: "no-key" };
  const address = `${name}, ${state}, USA`;
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
      return { fatal: true, reason: data.status, message: data.error_message };
    }
    if (data.status !== "OK" || !data.results || !data.results.length) {
      return { ok: false, reason: data.status };
    }
    const loc = data.results[0].geometry.location;
    return {
      ok: true,
      lat: parseFloat(loc.lat.toFixed(2)),
      lng: parseFloat(loc.lng.toFixed(2)),
    };
  } catch (err) {
    return { ok: false, reason: "fetch-error", message: err.message };
  }
}

// Nominatim / OpenStreetMap — free, no API key. Usage policy: 1 req/sec max
// and a descriptive User-Agent. Used as a fallback between the CSV and
// Google Geocoding so we aren't blocked if a Google API isn't enabled.
async function geocodeOsm(name, state) {
  const q = `${name}, ${state}, USA`;
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "fast-plumber-near-me/coord-backfill (contact: info@fastplumbernearme.com)",
      },
    });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { ok: false, reason: "no-results" };
    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return { ok: false, reason: "parse-error" };
    return { ok: true, lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) };
  } catch (err) {
    return { ok: false, reason: "fetch-error", message: err.message };
  }
}

// Primary coord source: SimpleMaps-style CSV (scripts/data/us-cities.csv).
// Free, offline, ~30k US cities — no API key needed for the bulk backfill.
// Google Geocoding is the fallback for cities the CSV doesn't cover.
function parseCsvLine(line) {
  // Minimal CSV splitter that honors double-quoted fields (no escaped quotes).
  const out = [];
  let i = 0, field = "", inQuote = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') inQuote = false;
      else field += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") { out.push(field); field = ""; }
      else field += c;
    }
    i++;
  }
  out.push(field);
  return out;
}

function loadUsCitiesCsv() {
  if (!existsSync(US_CITIES_CSV_PATH)) return null;
  const text = readFileSync(US_CITIES_CSV_PATH, "utf-8");
  const lines = text.split("\n");
  // Index: "ST:slug" -> [lat, lng]. If a slug collides across counties, first
  // one wins (the CSV is alphabetical by state/city, so this is stable).
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    // cols: ID, STATE_CODE, STATE_NAME, CITY, COUNTY, LATITUDE, LONGITUDE
    const state = cols[1];
    const cityName = cols[3];
    const lat = parseFloat(cols[5]);
    const lng = parseFloat(cols[6]);
    if (!state || !cityName || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const slug = slugify(cityName);
    const key = `${state}:${slug}`;
    if (!map.has(key)) {
      map.set(key, [parseFloat(lat.toFixed(4)), parseFloat(lng.toFixed(4))]);
    }
  }
  return map;
}

const existingCoords = parseExistingCoords();
const cache = loadCache();
const csvIndex = loadUsCitiesCsv();
const coordsMap = { ...existingCoords, ...cache };

console.log(`\n=== Coord backfill ===`);
console.log(`  Target cities: ${targetCities.length}`);
console.log(`  From city-coords.ts: ${Object.keys(existingCoords).length}`);
console.log(`  From cache JSON:     ${Object.keys(cache).length}`);
console.log(`  CSV index size:      ${csvIndex ? csvIndex.size : "(CSV missing)"}`);

// Phase 1: fill from the bundled CSV.
let csvHits = 0;
if (csvIndex) {
  for (const c of targetCities) {
    const key = `${c.state}:${c.slug}`;
    if (coordsMap[key]) continue;
    const hit = csvIndex.get(key);
    if (hit) {
      coordsMap[key] = hit;
      csvHits++;
    }
  }
  console.log(`  CSV backfilled: ${csvHits}`);
}

let missing = targetCities.filter((c) => !coordsMap[`${c.state}:${c.slug}`]);
console.log(`  Still missing:  ${missing.length}`);

const geocodeFailures = [];

// Phase 2: OpenStreetMap / Nominatim (free, no key, 1 req/sec).
if (missing.length > 0) {
  console.log(`  Geocoding ${missing.length} residual cities via Nominatim (OSM)...`);
  let done = 0;
  let failed = 0;
  for (const c of missing) {
    const result = await geocodeOsm(c.name, c.state);
    if (result.ok) {
      coordsMap[`${c.state}:${c.slug}`] = [result.lat, result.lng];
      done++;
    } else {
      failed++;
    }
    if ((done + failed) % 25 === 0) {
      saveCache(coordsMap);
      console.log(`    osm progress ${done + failed}/${missing.length} (ok=${done}, fail=${failed})`);
    }
    // Nominatim policy: max 1 req/sec.
    await sleep(1100);
  }
  console.log(`  OSM backfilled: ${done}, failed: ${failed}`);
  missing = targetCities.filter((c) => !coordsMap[`${c.state}:${c.slug}`]);
  console.log(`  Still missing:  ${missing.length}`);
}

// Phase 3: Google Geocoding (if enabled) for anything OSM didn't cover.
if (missing.length > 0 && GOOGLE_API_KEY) {
  console.log(`  Geocoding ${missing.length} residual cities via Google Geocoding API...`);
  let done = 0;
  let failed = 0;
  let fatalAbort = null;

  for (const c of missing) {
    const result = await geocode(c.name, c.state);
    if (result.fatal) {
      fatalAbort = result;
      logErrorCLI({
        entity: "coord-backfill",
        severity: "warn",
        message: `Google Geocoding fallback unavailable (${result.reason}) — ${missing.length - (done + failed)} cities still missing`,
        context: { apiMessage: result.message, remaining: missing.length - (done + failed) },
      });
      break;
    }
    if (result.ok) {
      coordsMap[`${c.state}:${c.slug}`] = [result.lat, result.lng];
      done++;
    } else {
      failed++;
      geocodeFailures.push({ state: c.state, slug: c.slug, name: c.name, reason: result.reason });
    }
    if ((done + failed) % 50 === 0) {
      saveCache(coordsMap);
      console.log(`    progress ${done + failed}/${missing.length} (ok=${done}, fail=${failed})`);
    }
    await sleep(40);
  }

  console.log(`  Geocoded: ${done}, failed: ${failed}`);
  if (fatalAbort && fatalAbort.reason === "REQUEST_DENIED") {
    console.error(`  Note: enable Geocoding at https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com`);
  }
}

saveCache(coordsMap);

// Recompute missing after both phases.
missing = targetCities.filter((c) => !coordsMap[`${c.state}:${c.slug}`]);

// Per-city geocode failures (soft — we still rewrite what we have, then exit
// non-zero at the end if the target set isn't fully covered).
for (const f of geocodeFailures) {
  logErrorCLI({
    entity: "coord-backfill",
    message: `Geocoding returned no result for ${f.name}, ${f.state} (${f.reason})`,
    context: f,
  });
}

// Emit city-coords.ts, grouped by state (sorted alphabetically within a state).
const stateOrderOut = Object.keys(STATE_NAMES).sort();
let coordsOut = `/**
 * Approximate city center coordinates for geolocation matching.
 * GENERATED by scripts/generate-cities-data.mjs — do not edit by hand.
 * Source of truth: scripts/city-coords-cache.json (+ RAW_CITIES in the
 * generate script). Rerun the script to regenerate.
 * Format: "stateAbbr:citySlug" -> [lat, lng]
 */

const COORDS: Record<string, [number, number]> = {
`;

for (const state of stateOrderOut) {
  const entries = Object.entries(coordsMap)
    .filter(([k]) => k.startsWith(`${state}:`))
    .sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) continue;
  coordsOut += `  // ${STATE_NAMES[state]}\n`;
  for (const [key, [lat, lng]] of entries) {
    coordsOut += `  "${key}": [${lat}, ${lng}],\n`;
  }
}

coordsOut += `};

import { CITY_LIST } from "./city-list";

export interface CityCoord {
  name: string;
  state: string;
  stateSlug: string;
  citySlug: string;
  lat: number;
  lng: number;
}

export function getCityCoordBySlug(stateAbbr: string, citySlug: string): [number, number] | null {
  const key = \`\${stateAbbr}:\${citySlug}\`;
  return COORDS[key] || null;
}

export function getCityCoords(): CityCoord[] {
  const result: CityCoord[] = [];

  for (const city of CITY_LIST) {
    const key = \`\${city.state}:\${city.citySlug}\`;
    const coord = COORDS[key];
    if (coord) {
      result.push({
        name: city.name,
        state: city.state,
        stateSlug: city.stateSlug,
        citySlug: city.citySlug,
        lat: coord[0],
        lng: coord[1],
      });
    }
  }

  return result;
}
`;
writeFileSync(COORDS_OUT_PATH, coordsOut);
console.log(`  Wrote ${COORDS_OUT_PATH} (${Object.keys(coordsMap).length} total coord entries)`);

// Hard contract: every city in RAW_CITIES must have a coord. If any are
// missing we log + fail so the CI run / developer sees it immediately.
const stillMissing = targetCities.filter((c) => !coordsMap[`${c.state}:${c.slug}`]);
if (stillMissing.length > 0) {
  console.error(`\nERROR: ${stillMissing.length} cities still missing coords after backfill.`);
  for (const c of stillMissing.slice(0, 20)) {
    console.error(`  - ${c.state}:${c.slug} (${c.name})`);
  }
  if (stillMissing.length > 20) console.error(`  ... +${stillMissing.length - 20} more`);
  logErrorCLI({
    entity: "coord-backfill",
    message: `${stillMissing.length} cities still missing coords after backfill`,
    context: {
      missingCount: stillMissing.length,
      sample: stillMissing.slice(0, 10),
    },
  });
  process.exit(1);
}
console.log(`  All ${targetCities.length} RAW_CITIES entries have coords ✓`);
