/**
 * Service-keyword dictionary.
 *
 * Maps internal service slugs (matching SERVICE_CONFIGS in src/lib/services-config.ts)
 * to the substrings the preprocess pass scans review text for. Substring matches are
 * case-insensitive, whole-word-ish (we don't fuss with word boundaries — homeowners
 * write reviews unevenly).
 *
 * NOT user-facing copy. NOT for ranking. Algorithmic input to preprocess-reviews.js.
 */

const SERVICE_KEYWORDS = {
  "water-heater": [
    "water heater", "hot water heater", "tankless", "hot water tank",
    "water heater install", "water heater replacement", "no hot water",
  ],
  "drain-cleaning": [
    "drain cleaning", "drain clog", "clogged drain", "snake the drain",
    "snaking", "drain pipe", "drain line", "kitchen drain", "bathroom drain",
    "drain jet",
  ],
  "sewer": [
    "sewer", "sewer line", "main line", "main sewer", "sewer backup",
    "sewer cleanout", "sewer scope", "sewer camera",
  ],
  "sewer-line-replacement": [
    "sewer line replacement", "sewer replacement", "replaced the sewer",
    "new sewer line", "trenchless sewer",
  ],
  "hydro-jetting": [
    "hydro jet", "hydro-jet", "hydrojet", "hydro jetting",
    "high pressure jet",
  ],
  "burst-pipe-repair": [
    "burst pipe", "pipe burst", "frozen pipe", "pipe split",
    "broken pipe", "pipe broke",
  ],
  "water-line-repair": [
    "water line", "water main", "main water", "service line",
    "water service",
  ],
  "slab-leak-repair": [
    "slab leak", "leak under the slab", "under the foundation", "slab leak detection",
  ],
  "water-leak": [
    "water leak", "leaking pipe", "pipe leak", "leak detection",
    "leak under sink", "ceiling leak",
  ],
  "sump-pump-repair": [
    "sump pump", "sump pit", "ejector pump",
  ],
  "garbage-disposal-repair": [
    "garbage disposal", "disposal", "disposer",
  ],
  "faucet-repair": [
    "faucet", "kitchen faucet", "bathroom faucet", "faucet install",
    "faucet replacement", "fixture", "shower head",
  ],
  "toilet-repair": [
    "toilet", "running toilet", "toilet install", "toilet replacement",
    "wax ring", "flush",
  ],
  "gas-line-repair": [
    "gas line", "gas leak", "gas smell", "gas pipe",
  ],
  "sewage-backup": [
    "sewage backup", "sewage back up", "raw sewage", "sewage in", "septic backup",
  ],
  "sewer-repair": [
    "sewer repair", "fix the sewer", "sewer fixed", "sewer break",
  ],
  "repiping": [
    "repipe", "re-pipe", "repiping", "whole house repipe", "pex repipe",
  ],
  "low-water-pressure": [
    "low water pressure", "water pressure", "pressure regulator",
    "pressure valve", "no water pressure",
  ],
  "frozen-pipes": [
    "frozen pipe", "thaw", "froze", "thawing the pipe",
  ],
  "no-hot-water": [
    "no hot water", "lukewarm shower", "cold shower", "ran out of hot water",
  ],
  "bathroom-remodel-plumbing": [
    "bathroom remodel", "bath remodel", "bathroom rough", "shower install",
    "tub install", "bathroom renovation",
  ],
  "kitchen-remodel-plumbing": [
    "kitchen remodel", "kitchen renovation", "kitchen rough",
  ],
  "licensed-plumber": [
    "licensed", "license number", "master plumber",
  ],
  "24-hour-plumber": [
    "24 hour", "24-hour", "24/7", "around the clock", "anytime",
  ],
  "emergency-plumbers": [
    "emergency", "emergency call", "called in an emergency", "true emergency",
  ],
  "same-day-plumber": [
    "same day", "same-day", "today", "right away", "within hours",
  ],
  "plumber-cost": [
    "cost", "price", "quote", "estimate", "$",
  ],
  "cheap-plumber": [
    "affordable", "reasonable", "cheap", "budget",
  ],
};

module.exports = { SERVICE_KEYWORDS };
