#!/usr/bin/env node

/**
 * Compute 5-mile service radius for each plumber.
 * Adds `serviceCities` array to each plumber in the synthesized data.
 *
 * Usage: node scripts/compute-service-radius.js
 */

const fs = require("fs");
const path = require("path");

const SYNTH_PATH = path.join(__dirname, "..", "data", "synthesized", "plumbers-synthesized.json");
const LEADERBOARD_PATH = path.join(__dirname, "..", "data", "synthesized", "leaderboard.json");
const SERVICE_RADIUS_MILES = 5;

// City center coordinates for all cities in our service area
const CITY_CENTERS = {
  // McHenry County
  "Crystal Lake": { lat: 42.2411, lng: -88.3162 },
  "McHenry": { lat: 42.3334, lng: -88.2668 },
  "Algonquin": { lat: 42.1656, lng: -88.2943 },
  "Lake in the Hills": { lat: 42.1808, lng: -88.3310 },
  "Huntley": { lat: 42.1681, lng: -88.4282 },
  "Woodstock": { lat: 42.3147, lng: -88.4487 },
  "Marengo": { lat: 42.2492, lng: -88.6084 },
  "Harvard": { lat: 42.4217, lng: -88.6137 },
  "Cary": { lat: 42.2120, lng: -88.2382 },
  "Fox River Grove": { lat: 42.2009, lng: -88.2135 },
  // Kane County (Fox Valley)
  "Elgin": { lat: 42.0354, lng: -88.2826 },
  "South Elgin": { lat: 41.9942, lng: -88.2923 },
  "St. Charles": { lat: 41.9142, lng: -88.3087 },
  "Geneva": { lat: 41.8875, lng: -88.3054 },
  "Batavia": { lat: 41.8500, lng: -88.3126 },
  "Aurora": { lat: 41.7606, lng: -88.3201 },
  "North Aurora": { lat: 41.8064, lng: -88.3271 },
  "Montgomery": { lat: 41.7306, lng: -88.3459 },
  "Carpentersville": { lat: 42.1211, lng: -88.2579 },
  // Lake County
  "Libertyville": { lat: 42.2831, lng: -87.9530 },
  "Mundelein": { lat: 42.2631, lng: -88.0039 },
  "Gurnee": { lat: 42.3703, lng: -87.9020 },
  "Waukegan": { lat: 42.3636, lng: -87.8448 },
  "Lake Zurich": { lat: 42.1967, lng: -88.0934 },
  "Grayslake": { lat: 42.3445, lng: -88.0416 },
  "Antioch": { lat: 42.4773, lng: -88.0956 },
  "Round Lake": { lat: 42.3534, lng: -88.0931 },
  "Zion": { lat: 42.4461, lng: -87.8328 },
  // DuPage County
  "Naperville": { lat: 41.7508, lng: -88.1535 },
  "Wheaton": { lat: 41.8661, lng: -88.1071 },
  "Downers Grove": { lat: 41.7959, lng: -88.0112 },
  "Elmhurst": { lat: 41.8995, lng: -87.9403 },
  "Lombard": { lat: 41.8801, lng: -88.0079 },
  "Glen Ellyn": { lat: 41.8775, lng: -88.0673 },
  "Hinsdale": { lat: 41.8006, lng: -87.9370 },
  "Lisle": { lat: 41.8011, lng: -88.0748 },
  "Carol Stream": { lat: 41.9128, lng: -88.1348 },
  "Addison": { lat: 41.9317, lng: -88.0084 },
  "Woodridge": { lat: 41.7470, lng: -88.0505 },
  "Bloomingdale": { lat: 41.9484, lng: -88.0810 },
  "Glendale Heights": { lat: 41.9145, lng: -88.0648 },
  "Bensenville": { lat: 41.9559, lng: -87.9401 },
  "Villa Park": { lat: 41.8895, lng: -87.9790 },
  "West Chicago": { lat: 41.8848, lng: -88.2039 },
  "Westmont": { lat: 41.7959, lng: -87.9756 },
  "Warrenville": { lat: 41.8181, lng: -88.1737 },
  "Darien": { lat: 41.7520, lng: -87.9718 },
  "Clarendon Hills": { lat: 41.7975, lng: -87.9584 },
  "Oak Brook": { lat: 41.8328, lng: -87.9290 },
  "Willowbrook": { lat: 41.7659, lng: -87.9357 },
  // Northwest Cook
  "Schaumburg": { lat: 42.0334, lng: -88.0834 },
  "Arlington Heights": { lat: 42.0884, lng: -87.9806 },
  "Palatine": { lat: 42.1103, lng: -88.0340 },
  "Hoffman Estates": { lat: 42.0420, lng: -88.1229 },
  "Des Plaines": { lat: 42.0334, lng: -87.8834 },
  "Mount Prospect": { lat: 42.0664, lng: -87.9373 },
  "Buffalo Grove": { lat: 42.1514, lng: -87.9601 },
  "Elk Grove Village": { lat: 42.0039, lng: -87.9703 },
  "Rolling Meadows": { lat: 42.0742, lng: -88.0131 },
  "Streamwood": { lat: 42.0256, lng: -88.1784 },
  "Wheeling": { lat: 42.1392, lng: -87.9290 },
  "Prospect Heights": { lat: 42.0953, lng: -87.9373 },
  "Inverness": { lat: 42.1181, lng: -88.0962 },
  // North Shore
  "Evanston": { lat: 42.0451, lng: -87.6877 },
  "Skokie": { lat: 42.0324, lng: -87.7334 },
  "Glenview": { lat: 42.0698, lng: -87.7873 },
  "Highland Park": { lat: 42.1817, lng: -87.8003 },
  "Northbrook": { lat: 42.1275, lng: -87.8290 },
  "Vernon Hills": { lat: 42.2192, lng: -87.9601 },
  "Wilmette": { lat: 42.0722, lng: -87.7237 },
  "Deerfield": { lat: 42.1712, lng: -87.8445 },
  "Lake Forest": { lat: 42.2586, lng: -87.8407 },
  "Lincolnshire": { lat: 42.1903, lng: -87.9090 },
  "Winnetka": { lat: 42.1081, lng: -87.7359 },
  "Glencoe": { lat: 42.1350, lng: -87.7579 },
  "Kenilworth": { lat: 42.0856, lng: -87.7173 },
  // South/West/Southwest suburbs
  "Joliet": { lat: 41.5250, lng: -88.0817 },
  "Bolingbrook": { lat: 41.6986, lng: -88.0684 },
  "Plainfield": { lat: 41.6270, lng: -88.2037 },
  "Orland Park": { lat: 41.6303, lng: -87.8539 },
  "Tinley Park": { lat: 41.5731, lng: -87.7845 },
  "Oak Lawn": { lat: 41.7106, lng: -87.7584 },
  "Oak Park": { lat: 41.8850, lng: -87.7845 },
  "Berwyn": { lat: 41.8506, lng: -87.7937 },
  "Cicero": { lat: 41.8456, lng: -87.7539 },
};

// Haversine distance in miles
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function main() {
  const data = JSON.parse(fs.readFileSync(SYNTH_PATH, "utf-8"));

  let totalAssignments = 0;

  for (const plumber of data.plumbers) {
    const serviceCities = new Set();

    // Always include their home city
    serviceCities.add(plumber.city);

    if (plumber.location?.lat && plumber.location?.lng) {
      for (const [cityName, coords] of Object.entries(CITY_CENTERS)) {
        const dist = haversine(plumber.location.lat, plumber.location.lng, coords.lat, coords.lng);
        if (dist <= SERVICE_RADIUS_MILES) {
          serviceCities.add(cityName);
        }
      }
    }

    plumber.serviceCities = [...serviceCities].sort();
    totalAssignments += plumber.serviceCities.length;
  }

  // Write updated synthesized data
  fs.writeFileSync(SYNTH_PATH, JSON.stringify(data, null, 2));

  // Update leaderboard too
  const leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_PATH, "utf-8"));
  for (const entry of leaderboard.plumbers) {
    const plumber = data.plumbers.find(p => p.name === entry.name);
    if (plumber) entry.serviceCities = plumber.serviceCities;
  }
  fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(leaderboard, null, 2));

  // Summary
  console.log(`\nService radius computed (${SERVICE_RADIUS_MILES} miles)`);
  console.log(`  Plumbers: ${data.plumbers.length}`);
  console.log(`  Total city assignments: ${totalAssignments}`);
  console.log(`  Avg cities per plumber: ${(totalAssignments / data.plumbers.length).toFixed(1)}`);

  // Show coverage per city
  const cityCoverage = {};
  for (const p of data.plumbers) {
    for (const c of p.serviceCities) {
      cityCoverage[c] = (cityCoverage[c] || 0) + 1;
    }
  }
  const sorted = Object.entries(cityCoverage).sort((a, b) => b[1] - a[1]);
  console.log(`\nCity coverage:`);
  for (const [city, count] of sorted) {
    console.log(`  ${city}: ${count} plumbers`);
  }
}

main();
