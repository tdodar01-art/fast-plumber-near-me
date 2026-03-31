/**
 * National city data for build-time static generation.
 * Cities organized by state abbreviation → city slug.
 * City slugs are lowercase, hyphenated city names (no state suffix).
 */

export interface NearbyCityRef {
  name: string;
  citySlug: string;
  stateSlug: string;
}

export interface CityInfo {
  name: string;
  state: string; // 2-letter abbreviation
  county: string;
  heroContent: string;
  nearbyCities: NearbyCityRef[];
}

// State abbreviation → { citySlug → CityInfo }
export const CITY_DATA: Record<string, Record<string, CityInfo>> = {};

// Helper to register cities
function addCities(state: string, cities: Record<string, CityInfo>) {
  if (!CITY_DATA[state]) CITY_DATA[state] = {};
  Object.assign(CITY_DATA[state], cities);
}

function nc(name: string, citySlug: string, stateSlug: string): NearbyCityRef {
  return { name, citySlug, stateSlug };
}

// ============================================================================
// ILLINOIS
// ============================================================================
addCities("IL", {
  "crystal-lake": { name: "Crystal Lake", state: "IL", county: "McHenry", heroContent: "Crystal Lake is the largest city in McHenry County, with older homes and aging plumbing infrastructure that can lead to emergencies — especially during harsh Illinois winters. Frozen pipes, water heater failures, and sewer backups are common issues.", nearbyCities: [nc("McHenry","mchenry","illinois"), nc("Algonquin","algonquin","illinois"), nc("Lake in the Hills","lake-in-the-hills","illinois"), nc("Cary","cary","illinois"), nc("Woodstock","woodstock","illinois")] },
  "mchenry": { name: "McHenry", state: "IL", county: "McHenry", heroContent: "McHenry residents know that plumbing emergencies don't wait for business hours. With the Fox River running through town and seasonal temperature swings, pipes can freeze, burst, or back up at any time.", nearbyCities: [nc("Crystal Lake","crystal-lake","illinois"), nc("Woodstock","woodstock","illinois"), nc("Huntley","huntley","illinois"), nc("Lake in the Hills","lake-in-the-hills","illinois")] },
  "algonquin": { name: "Algonquin", state: "IL", county: "McHenry", heroContent: "Algonquin is a rapidly growing community straddling McHenry and Kane counties. Plumbing emergencies range from slab leaks to water heater failures in both newer and established neighborhoods.", nearbyCities: [nc("Crystal Lake","crystal-lake","illinois"), nc("Lake in the Hills","lake-in-the-hills","illinois"), nc("Carpentersville","carpentersville","illinois"), nc("Huntley","huntley","illinois")] },
  "lake-in-the-hills": { name: "Lake in the Hills", state: "IL", county: "McHenry", heroContent: "Lake in the Hills is a vibrant McHenry County community with many homes built in the 1990s and 2000s. As these homes age, plumbing issues like water heater failures and drain clogs become more common.", nearbyCities: [nc("Crystal Lake","crystal-lake","illinois"), nc("Algonquin","algonquin","illinois"), nc("Huntley","huntley","illinois"), nc("Cary","cary","illinois")] },
  "huntley": { name: "Huntley", state: "IL", county: "McHenry", heroContent: "Huntley has been one of the fastest-growing communities in the Chicago suburbs, bringing a need for reliable emergency plumbing services across its many newer subdivisions.", nearbyCities: [nc("Crystal Lake","crystal-lake","illinois"), nc("Lake in the Hills","lake-in-the-hills","illinois"), nc("Algonquin","algonquin","illinois"), nc("Woodstock","woodstock","illinois")] },
  "woodstock": { name: "Woodstock", state: "IL", county: "McHenry", heroContent: "Woodstock, the McHenry County seat famous for the Groundhog Day square, has many historic homes with aging plumbing systems prone to frozen pipes and sewer issues.", nearbyCities: [nc("Crystal Lake","crystal-lake","illinois"), nc("McHenry","mchenry","illinois"), nc("Huntley","huntley","illinois"), nc("Harvard","harvard","illinois"), nc("Marengo","marengo","illinois")] },
  "cary": { name: "Cary", state: "IL", county: "McHenry", heroContent: "Cary is a charming village along the Fox River with many homes dating back several decades, making plumbing emergencies like burst pipes and sewer problems a frequent concern.", nearbyCities: [nc("Crystal Lake","crystal-lake","illinois"), nc("Algonquin","algonquin","illinois"), nc("Lake in the Hills","lake-in-the-hills","illinois")] },
  "marengo": { name: "Marengo", state: "IL", county: "McHenry", heroContent: "Marengo is a small but growing community in western McHenry County with many older homes and rural properties where plumbing emergencies can be especially stressful.", nearbyCities: [nc("Woodstock","woodstock","illinois"), nc("Harvard","harvard","illinois"), nc("Huntley","huntley","illinois")] },
  "harvard": { name: "Harvard", state: "IL", county: "McHenry", heroContent: "Harvard sits at the northern edge of McHenry County near the Wisconsin border, where finding reliable emergency plumbing service can be challenging.", nearbyCities: [nc("Woodstock","woodstock","illinois"), nc("Marengo","marengo","illinois")] },
  "carpentersville": { name: "Carpentersville", state: "IL", county: "Kane", heroContent: "Carpentersville is a diverse Fox River community where plumbing emergencies from burst pipes to water heater failures can happen in any neighborhood.", nearbyCities: [nc("Algonquin","algonquin","illinois"), nc("Elgin","elgin","illinois"), nc("South Elgin","south-elgin","illinois")] },
  "elgin": { name: "Elgin", state: "IL", county: "Kane", heroContent: "Elgin is one of the largest Fox Valley cities with diverse housing from historic Victorians to modern developments. Aging pipes and water heater emergencies are everyday realities.", nearbyCities: [nc("South Elgin","south-elgin","illinois"), nc("Carpentersville","carpentersville","illinois"), nc("St. Charles","st-charles","illinois")] },
  "south-elgin": { name: "South Elgin", state: "IL", county: "Kane", heroContent: "South Elgin is a growing Fox River community in Kane County with a mix of established and newer neighborhoods experiencing various plumbing challenges.", nearbyCities: [nc("Elgin","elgin","illinois"), nc("St. Charles","st-charles","illinois"), nc("Geneva","geneva","illinois"), nc("Carpentersville","carpentersville","illinois")] },
  "st-charles": { name: "St. Charles", state: "IL", county: "Kane", heroContent: "St. Charles is a picturesque Fox River community with both historic homes and modern developments where plumbing emergencies don't wait for business hours.", nearbyCities: [nc("Geneva","geneva","illinois"), nc("Batavia","batavia","illinois"), nc("South Elgin","south-elgin","illinois"), nc("North Aurora","north-aurora","illinois")] },
  "geneva": { name: "Geneva", state: "IL", county: "Kane", heroContent: "Geneva is a charming Fox River community known for its historic Third Street district. Many older homes have plumbing systems that need emergency attention.", nearbyCities: [nc("St. Charles","st-charles","illinois"), nc("Batavia","batavia","illinois"), nc("Naperville","naperville","illinois")] },
  "batavia": { name: "Batavia", state: "IL", county: "Kane", heroContent: "Batavia, the oldest city in Kane County, features homes spanning over a century of construction with a wide variety of plumbing systems and potential emergencies.", nearbyCities: [nc("Geneva","geneva","illinois"), nc("Aurora","aurora","illinois"), nc("St. Charles","st-charles","illinois"), nc("North Aurora","north-aurora","illinois")] },
  "aurora": { name: "Aurora", state: "IL", county: "Kane", heroContent: "Aurora is the second-largest city in Illinois with a vast range of housing. Plumbing emergencies are a constant from older east-side homes to new far-west construction.", nearbyCities: [nc("Naperville","naperville","illinois"), nc("North Aurora","north-aurora","illinois"), nc("Batavia","batavia","illinois"), nc("Montgomery","montgomery","illinois"), nc("Oswego","oswego","illinois"), nc("Plainfield","plainfield","illinois")] },
  "north-aurora": { name: "North Aurora", state: "IL", county: "Kane", heroContent: "North Aurora is a growing Kane County village where aging and new construction alike experience plumbing issues requiring fast emergency response.", nearbyCities: [nc("Aurora","aurora","illinois"), nc("Batavia","batavia","illinois"), nc("Montgomery","montgomery","illinois")] },
  "montgomery": { name: "Montgomery", state: "IL", county: "Kane", heroContent: "Montgomery straddles the Fox River in Kane and Kendall counties with a growing residential base needing reliable emergency plumbing service.", nearbyCities: [nc("Aurora","aurora","illinois"), nc("Oswego","oswego","illinois"), nc("North Aurora","north-aurora","illinois")] },
  "naperville": { name: "Naperville", state: "IL", county: "DuPage", heroContent: "Naperville is consistently ranked as one of the best places to live in Illinois, but even great cities have plumbing emergencies — from burst pipes to water heater failures.", nearbyCities: [nc("Aurora","aurora","illinois"), nc("Wheaton","wheaton","illinois"), nc("Lisle","lisle","illinois"), nc("Bolingbrook","bolingbrook","illinois"), nc("Downers Grove","downers-grove","illinois"), nc("Plainfield","plainfield","illinois")] },
  "wheaton": { name: "Wheaton", state: "IL", county: "DuPage", heroContent: "Wheaton is the DuPage County seat with beautiful neighborhoods and homes with older plumbing prone to emergencies, especially during winter freezes.", nearbyCities: [nc("Naperville","naperville","illinois"), nc("Glen Ellyn","glen-ellyn","illinois"), nc("Lombard","lombard","illinois"), nc("Downers Grove","downers-grove","illinois")] },
  "downers-grove": { name: "Downers Grove", state: "IL", county: "DuPage", heroContent: "Downers Grove is a classic DuPage County suburb with tree-lined streets and homes dating from the early 1900s. Older plumbing systems mean more emergencies.", nearbyCities: [nc("Naperville","naperville","illinois"), nc("Lombard","lombard","illinois"), nc("Lisle","lisle","illinois"), nc("Westmont","westmont","illinois"), nc("Woodridge","woodridge","illinois")] },
  "lombard": { name: "Lombard", state: "IL", county: "DuPage", heroContent: "Lombard is a well-established DuPage County village with housing spanning several decades where aging pipes and water heater problems are everyday realities.", nearbyCities: [nc("Downers Grove","downers-grove","illinois"), nc("Glen Ellyn","glen-ellyn","illinois"), nc("Villa Park","villa-park","illinois"), nc("Wheaton","wheaton","illinois")] },
  "lisle": { name: "Lisle", state: "IL", county: "DuPage", heroContent: "Lisle is a charming village along the East Branch of the DuPage River where plumbing emergencies can strike residential and commercial properties alike.", nearbyCities: [nc("Naperville","naperville","illinois"), nc("Downers Grove","downers-grove","illinois"), nc("Wheaton","wheaton","illinois"), nc("Woodridge","woodridge","illinois")] },
  "glen-ellyn": { name: "Glen Ellyn", state: "IL", county: "DuPage", heroContent: "Glen Ellyn is a sought-after DuPage County village with many historic homes where older plumbing systems mean burst pipes and drain backups are common.", nearbyCities: [nc("Wheaton","wheaton","illinois"), nc("Lombard","lombard","illinois"), nc("Glendale Heights","glendale-heights","illinois")] },
  "warrenville": { name: "Warrenville", state: "IL", county: "DuPage", heroContent: "Warrenville is a small but vibrant DuPage County city surrounded by forest preserves, where residential plumbing emergencies need reliable service.", nearbyCities: [nc("Naperville","naperville","illinois"), nc("Wheaton","wheaton","illinois"), nc("Lisle","lisle","illinois")] },
  "woodridge": { name: "Woodridge", state: "IL", county: "DuPage", heroContent: "Woodridge is a friendly village in DuPage and Will counties with homes from the 1970s-2000s now experiencing aging plumbing issues.", nearbyCities: [nc("Bolingbrook","bolingbrook","illinois"), nc("Downers Grove","downers-grove","illinois"), nc("Lisle","lisle","illinois")] },
  "villa-park": { name: "Villa Park", state: "IL", county: "DuPage", heroContent: "Villa Park is a welcoming DuPage County village with established neighborhoods where older plumbing systems can lead to unexpected emergencies.", nearbyCities: [nc("Lombard","lombard","illinois"), nc("Downers Grove","downers-grove","illinois"), nc("Glendale Heights","glendale-heights","illinois")] },
  "westmont": { name: "Westmont", state: "IL", county: "DuPage", heroContent: "Westmont is a compact DuPage County village where residential plumbing emergencies need quick, reliable service from verified professionals.", nearbyCities: [nc("Downers Grove","downers-grove","illinois"), nc("Clarendon Hills","clarendon-hills","illinois"), nc("Lombard","lombard","illinois")] },
  "glendale-heights": { name: "Glendale Heights", state: "IL", county: "DuPage", heroContent: "Glendale Heights is a diverse DuPage County village with a range of housing types all susceptible to plumbing emergencies.", nearbyCities: [nc("Glen Ellyn","glen-ellyn","illinois"), nc("Lombard","lombard","illinois"), nc("Villa Park","villa-park","illinois")] },
  "clarendon-hills": { name: "Clarendon Hills", state: "IL", county: "DuPage", heroContent: "Clarendon Hills is a charming DuPage County village with beautiful older homes where historic plumbing systems mean emergencies are a real concern.", nearbyCities: [nc("Westmont","westmont","illinois"), nc("Downers Grove","downers-grove","illinois")] },
  "bolingbrook": { name: "Bolingbrook", state: "IL", county: "Will", heroContent: "Bolingbrook is a large Will County suburb with homes from the 1960s to present. Aging pipes, sump pump failures, and water heater emergencies are common.", nearbyCities: [nc("Naperville","naperville","illinois"), nc("Woodridge","woodridge","illinois"), nc("Plainfield","plainfield","illinois"), nc("Lockport","lockport","illinois")] },
  "plainfield": { name: "Plainfield", state: "IL", county: "Will", heroContent: "Plainfield has exploded with growth, bringing thousands of homes now aging into their first major plumbing issues like water heater replacements and sewer problems.", nearbyCities: [nc("Naperville","naperville","illinois"), nc("Joliet","joliet","illinois"), nc("Bolingbrook","bolingbrook","illinois"), nc("Oswego","oswego","illinois"), nc("Aurora","aurora","illinois")] },
  "joliet": { name: "Joliet", state: "IL", county: "Will", heroContent: "Joliet is the largest city in Will County with diverse housing from historic stone homes to modern subdivisions all needing reliable emergency plumbing.", nearbyCities: [nc("Plainfield","plainfield","illinois"), nc("Lockport","lockport","illinois"), nc("Shorewood","shorewood","illinois"), nc("Bolingbrook","bolingbrook","illinois")] },
  "lockport": { name: "Lockport", state: "IL", county: "Will", heroContent: "Lockport is a historic Will County city along the Des Plaines River where aging plumbing in older neighborhoods means emergency calls are common.", nearbyCities: [nc("Joliet","joliet","illinois"), nc("Plainfield","plainfield","illinois"), nc("Bolingbrook","bolingbrook","illinois"), nc("Lemont","lemont","illinois")] },
  "shorewood": { name: "Shorewood", state: "IL", county: "Will", heroContent: "Shorewood is a growing Will County village near Joliet with newer homes along the DuPage River that can still experience plumbing emergencies.", nearbyCities: [nc("Joliet","joliet","illinois"), nc("Plainfield","plainfield","illinois"), nc("Lockport","lockport","illinois")] },
  "oswego": { name: "Oswego", state: "IL", county: "Kendall", heroContent: "Oswego has grown rapidly along the Fox River with many newer homes starting to experience their first plumbing issues from water heater failures to frozen pipes.", nearbyCities: [nc("Aurora","aurora","illinois"), nc("Plainfield","plainfield","illinois"), nc("Montgomery","montgomery","illinois")] },
  "schaumburg": { name: "Schaumburg", state: "IL", county: "Cook", heroContent: "Schaumburg is a major suburban hub with thousands of homes and businesses depending on reliable plumbing. Emergencies here demand fast response.", nearbyCities: [nc("Arlington Heights","arlington-heights","illinois"), nc("Elk Grove Village","elk-grove-village","illinois")] },
  "arlington-heights": { name: "Arlington Heights", state: "IL", county: "Cook", heroContent: "Arlington Heights is one of Illinois' largest villages with mid-century and newer homes. Aging plumbing systems mean burst pipes and water heater failures are common.", nearbyCities: [nc("Schaumburg","schaumburg","illinois"), nc("Elk Grove Village","elk-grove-village","illinois")] },
  "lemont": { name: "Lemont", state: "IL", county: "Cook", heroContent: "Lemont sits along the Des Plaines River with homes ranging from historic limestone buildings to modern developments all needing reliable emergency plumbing.", nearbyCities: [nc("Bolingbrook","bolingbrook","illinois"), nc("Lockport","lockport","illinois")] },
  "highland-park": { name: "Highland Park", state: "IL", county: "Lake", heroContent: "Highland Park is an affluent North Shore community with historic estates and modern homes that deserve premium emergency plumbing service.", nearbyCities: [] },
  "lyons": { name: "Lyons", state: "IL", county: "Cook", heroContent: "Lyons is a Cook County village with older residential and commercial properties where plumbing emergencies in aging buildings need fast professional response.", nearbyCities: [] },
  "elk-grove-village": { name: "Elk Grove Village", state: "IL", county: "Cook", heroContent: "Elk Grove Village has thriving residential neighborhoods alongside one of the largest industrial parks in the US, all needing fast plumbing response.", nearbyCities: [nc("Glendale Heights","glendale-heights","illinois"), nc("Schaumburg","schaumburg","illinois")] },
  "chicago": { name: "Chicago", state: "IL", county: "Cook", heroContent: "Chicago's massive housing stock ranges from century-old brick bungalows to modern high-rises. Harsh winters cause frozen pipes, while aging infrastructure leads to sewer backups across every neighborhood.", nearbyCities: [nc("Schaumburg","schaumburg","illinois"), nc("Arlington Heights","arlington-heights","illinois"), nc("Naperville","naperville","illinois"), nc("Aurora","aurora","illinois")] },
  "rockford": { name: "Rockford", state: "IL", county: "Winnebago", heroContent: "Rockford is Illinois' third-largest city with a diverse mix of older homes and new development. Harsh winters and aging pipes make emergency plumbing a year-round necessity.", nearbyCities: [] },
  "springfield": { name: "Springfield", state: "IL", county: "Sangamon", heroContent: "Springfield, the Illinois state capital, has historic neighborhoods with older plumbing infrastructure prone to burst pipes and sewer line issues.", nearbyCities: [] },
  "peoria": { name: "Peoria", state: "IL", county: "Peoria", heroContent: "Peoria sits along the Illinois River with housing stock spanning decades. Seasonal temperature extremes put stress on plumbing systems throughout the city.", nearbyCities: [] },
  "champaign": { name: "Champaign", state: "IL", county: "Champaign", heroContent: "Champaign is a university city with a mix of student housing and family homes where plumbing emergencies from frozen pipes to water heater failures are common.", nearbyCities: [] },
});

// ============================================================================
// CALIFORNIA
// ============================================================================
addCities("CA", {
  "los-angeles": { name: "Los Angeles", state: "CA", county: "Los Angeles", heroContent: "Los Angeles' sprawling housing stock and aging infrastructure mean plumbing emergencies from slab leaks to sewer line failures are a daily reality for millions of homeowners.", nearbyCities: [nc("Long Beach","long-beach","california"), nc("Anaheim","anaheim","california"), nc("Santa Ana","santa-ana","california"), nc("Irvine","irvine","california")] },
  "san-diego": { name: "San Diego", state: "CA", county: "San Diego", heroContent: "San Diego's coastal climate and older neighborhoods create unique plumbing challenges from corroded pipes to water heater failures throughout the year.", nearbyCities: [] },
  "san-jose": { name: "San Jose", state: "CA", county: "Santa Clara", heroContent: "San Jose is the heart of Silicon Valley with a mix of older ranch homes and new construction, all requiring responsive emergency plumbing service.", nearbyCities: [nc("San Francisco","san-francisco","california"), nc("Oakland","oakland","california")] },
  "san-francisco": { name: "San Francisco", state: "CA", county: "San Francisco", heroContent: "San Francisco's Victorian and Edwardian homes have plumbing systems over a century old, making burst pipes and sewer backups a frequent concern.", nearbyCities: [nc("Oakland","oakland","california"), nc("San Jose","san-jose","california")] },
  "fresno": { name: "Fresno", state: "CA", county: "Fresno", heroContent: "Fresno's Central Valley heat puts extreme strain on water systems and plumbing infrastructure, with water heater failures common during scorching summer months.", nearbyCities: [nc("Bakersfield","bakersfield","california"), nc("Stockton","stockton","california")] },
  "sacramento": { name: "Sacramento", state: "CA", county: "Sacramento", heroContent: "Sacramento's hot summers and older neighborhoods create constant demand for emergency plumbing from water heater replacements to burst pipes.", nearbyCities: [nc("Stockton","stockton","california")] },
  "long-beach": { name: "Long Beach", state: "CA", county: "Los Angeles", heroContent: "Long Beach's coastal location and aging residential infrastructure mean plumbing emergencies from corroded pipes to sewer backups require fast, reliable response.", nearbyCities: [nc("Los Angeles","los-angeles","california"), nc("Anaheim","anaheim","california")] },
  "oakland": { name: "Oakland", state: "CA", county: "Alameda", heroContent: "Oakland's diverse housing from historic Craftsman bungalows to modern apartments all depend on reliable plumbing, especially during rainy winter months.", nearbyCities: [nc("San Francisco","san-francisco","california"), nc("San Jose","san-jose","california")] },
  "bakersfield": { name: "Bakersfield", state: "CA", county: "Kern", heroContent: "Bakersfield's extreme Central Valley heat and hard water conditions accelerate plumbing wear, making water heater failures and pipe issues a common emergency.", nearbyCities: [nc("Fresno","fresno","california")] },
  "anaheim": { name: "Anaheim", state: "CA", county: "Orange", heroContent: "Anaheim's mix of vintage neighborhoods and newer developments means plumbing emergencies ranging from aging pipe failures to modern fixture issues.", nearbyCities: [nc("Los Angeles","los-angeles","california"), nc("Santa Ana","santa-ana","california"), nc("Irvine","irvine","california")] },
  "santa-ana": { name: "Santa Ana", state: "CA", county: "Orange", heroContent: "Santa Ana is Orange County's urban core with dense, older housing where sewer backups and pipe failures are frequent plumbing emergencies.", nearbyCities: [nc("Anaheim","anaheim","california"), nc("Irvine","irvine","california")] },
  "riverside": { name: "Riverside", state: "CA", county: "Riverside", heroContent: "Riverside's inland heat and older citrus-era homes create plumbing challenges from pipe expansion to water heater strain throughout the year.", nearbyCities: [] },
  "stockton": { name: "Stockton", state: "CA", county: "San Joaquin", heroContent: "Stockton's Central Valley location and affordable older housing mean plumbing emergencies from deteriorating pipes are a common homeowner concern.", nearbyCities: [nc("Sacramento","sacramento","california"), nc("Fresno","fresno","california")] },
  "irvine": { name: "Irvine", state: "CA", county: "Orange", heroContent: "Irvine's master-planned communities feature newer plumbing systems, but water heater failures and unexpected pipe issues still require emergency response.", nearbyCities: [nc("Anaheim","anaheim","california"), nc("Santa Ana","santa-ana","california")] },
});

// ============================================================================
// TEXAS
// ============================================================================
addCities("TX", {
  "houston": { name: "Houston", state: "TX", county: "Harris", heroContent: "Houston's flat terrain and heavy rainfall make sewer backups and flooding-related plumbing emergencies a constant concern for the nation's fourth-largest city.", nearbyCities: [nc("San Antonio","san-antonio","texas"), nc("Dallas","dallas","texas"), nc("Austin","austin","texas")] },
  "san-antonio": { name: "San Antonio", state: "TX", county: "Bexar", heroContent: "San Antonio's hard water and extreme summer heat accelerate plumbing wear, with water heater failures and pipe corrosion leading to frequent emergencies.", nearbyCities: [nc("Austin","austin","texas"), nc("Houston","houston","texas")] },
  "dallas": { name: "Dallas", state: "TX", county: "Dallas", heroContent: "Dallas' extreme temperature swings from summer heat to winter freezes put tremendous stress on plumbing systems across the metroplex.", nearbyCities: [nc("Fort Worth","fort-worth","texas"), nc("Arlington","arlington","texas"), nc("Plano","plano","texas"), nc("Irving","irving","texas"), nc("Garland","garland","texas"), nc("Frisco","frisco","texas")] },
  "austin": { name: "Austin", state: "TX", county: "Travis", heroContent: "Austin's rapid growth and limestone-heavy soil create unique plumbing challenges from shifting foundations to hard water damage across the booming metro.", nearbyCities: [nc("San Antonio","san-antonio","texas"), nc("Houston","houston","texas")] },
  "fort-worth": { name: "Fort Worth", state: "TX", county: "Tarrant", heroContent: "Fort Worth's expansive housing stock from historic Stockyards-area homes to modern suburbs all face plumbing emergencies from frozen pipes to sewer failures.", nearbyCities: [nc("Dallas","dallas","texas"), nc("Arlington","arlington","texas")] },
  "el-paso": { name: "El Paso", state: "TX", county: "El Paso", heroContent: "El Paso's desert climate and hard water conditions cause mineral buildup and accelerated plumbing deterioration requiring emergency service.", nearbyCities: [] },
  "arlington": { name: "Arlington", state: "TX", county: "Tarrant", heroContent: "Arlington sits between Dallas and Fort Worth with diverse housing that experiences plumbing emergencies from aging pipes to water heater failures.", nearbyCities: [nc("Dallas","dallas","texas"), nc("Fort Worth","fort-worth","texas")] },
  "corpus-christi": { name: "Corpus Christi", state: "TX", county: "Nueces", heroContent: "Corpus Christi's coastal salt air and humidity accelerate pipe corrosion, making emergency plumbing service essential for homeowners.", nearbyCities: [] },
  "plano": { name: "Plano", state: "TX", county: "Collin", heroContent: "Plano is one of the largest Dallas suburbs with homes from the 1970s to present. Aging plumbing in established neighborhoods creates steady emergency demand.", nearbyCities: [nc("Dallas","dallas","texas"), nc("Frisco","frisco","texas"), nc("McKinney","mckinney","texas")] },
  "laredo": { name: "Laredo", state: "TX", county: "Webb", heroContent: "Laredo's extreme South Texas heat and hard water conditions put constant strain on plumbing systems and water heaters.", nearbyCities: [] },
  "lubbock": { name: "Lubbock", state: "TX", county: "Lubbock", heroContent: "Lubbock's West Texas climate with extreme temperature swings and hard water creates unique plumbing challenges requiring reliable emergency service.", nearbyCities: [] },
  "irving": { name: "Irving", state: "TX", county: "Dallas", heroContent: "Irving is a major Dallas-area city with a mix of residential and commercial properties all requiring responsive emergency plumbing.", nearbyCities: [nc("Dallas","dallas","texas"), nc("Arlington","arlington","texas")] },
  "garland": { name: "Garland", state: "TX", county: "Dallas", heroContent: "Garland's established neighborhoods east of Dallas feature homes from the 1960s-80s with aging plumbing systems prone to emergency failures.", nearbyCities: [nc("Dallas","dallas","texas"), nc("Plano","plano","texas")] },
  "frisco": { name: "Frisco", state: "TX", county: "Collin", heroContent: "Frisco is one of America's fastest-growing cities, but even newer construction can experience plumbing emergencies from defective fixtures to water heater issues.", nearbyCities: [nc("Plano","plano","texas"), nc("McKinney","mckinney","texas"), nc("Dallas","dallas","texas")] },
  "mckinney": { name: "McKinney", state: "TX", county: "Collin", heroContent: "McKinney blends historic downtown charm with rapid suburban growth, creating diverse plumbing needs from century-old pipes to modern system failures.", nearbyCities: [nc("Plano","plano","texas"), nc("Frisco","frisco","texas")] },
});

// ============================================================================
// FLORIDA
// ============================================================================
addCities("FL", {
  "jacksonville": { name: "Jacksonville", state: "FL", county: "Duval", heroContent: "Jacksonville is the largest city by area in the continental US, with diverse neighborhoods where tropical storms and aging pipes create frequent plumbing emergencies.", nearbyCities: [] },
  "miami": { name: "Miami", state: "FL", county: "Miami-Dade", heroContent: "Miami's tropical climate, limestone geology, and aging infrastructure create constant plumbing challenges from corroded pipes to hurricane-related emergencies.", nearbyCities: [nc("Fort Lauderdale","fort-lauderdale","florida"), nc("Hialeah","hialeah","florida"), nc("Pembroke Pines","pembroke-pines","florida")] },
  "tampa": { name: "Tampa", state: "FL", county: "Hillsborough", heroContent: "Tampa's humid subtropical climate and older neighborhoods mean plumbing emergencies from pipe corrosion to water heater failures are a year-round concern.", nearbyCities: [nc("St. Petersburg","st-petersburg","florida"), nc("Orlando","orlando","florida")] },
  "orlando": { name: "Orlando", state: "FL", county: "Orange", heroContent: "Orlando's rapid growth and Florida's unique water table create plumbing challenges from slab leaks to sewer line issues across the expanding metro.", nearbyCities: [nc("Tampa","tampa","florida")] },
  "st-petersburg": { name: "St. Petersburg", state: "FL", county: "Pinellas", heroContent: "St. Petersburg's coastal location and many older homes from the 1920s-50s mean corroded pipes and emergency plumbing calls are a regular occurrence.", nearbyCities: [nc("Tampa","tampa","florida")] },
  "hialeah": { name: "Hialeah", state: "FL", county: "Miami-Dade", heroContent: "Hialeah is one of South Florida's most densely populated cities with older infrastructure that leads to frequent plumbing emergencies.", nearbyCities: [nc("Miami","miami","florida"), nc("Fort Lauderdale","fort-lauderdale","florida")] },
  "port-st-lucie": { name: "Port St. Lucie", state: "FL", county: "St. Lucie", heroContent: "Port St. Lucie's rapid residential growth means many homes are reaching the age where plumbing systems need emergency attention.", nearbyCities: [] },
  "cape-coral": { name: "Cape Coral", state: "FL", county: "Lee", heroContent: "Cape Coral has one of the most extensive canal systems in the world, and its unique geography combined with Florida's limestone create distinct plumbing challenges.", nearbyCities: [] },
  "tallahassee": { name: "Tallahassee", state: "FL", county: "Leon", heroContent: "Tallahassee's mix of historic homes near the Capitol and newer suburban development creates diverse plumbing emergency needs.", nearbyCities: [] },
  "fort-lauderdale": { name: "Fort Lauderdale", state: "FL", county: "Broward", heroContent: "Fort Lauderdale's coastal salt air and aging waterfront properties create accelerated pipe corrosion and frequent plumbing emergencies.", nearbyCities: [nc("Miami","miami","florida"), nc("Pembroke Pines","pembroke-pines","florida")] },
  "pembroke-pines": { name: "Pembroke Pines", state: "FL", county: "Broward", heroContent: "Pembroke Pines is a large Broward County suburb where homes from the 1980s-2000s are reaching the age of first major plumbing repairs.", nearbyCities: [nc("Fort Lauderdale","fort-lauderdale","florida"), nc("Miami","miami","florida")] },
});

// ============================================================================
// NEW YORK
// ============================================================================
addCities("NY", {
  "new-york": { name: "New York City", state: "NY", county: "New York", heroContent: "New York City's massive and aging infrastructure — some pipes dating to the 1800s — makes plumbing emergencies from burst mains to backed-up sewers an everyday reality.", nearbyCities: [nc("Yonkers","yonkers","new-york")] },
  "buffalo": { name: "Buffalo", state: "NY", county: "Erie", heroContent: "Buffalo's brutal winters and aging housing stock make frozen and burst pipes one of the most common plumbing emergencies in Western New York.", nearbyCities: [nc("Rochester","rochester","new-york")] },
  "rochester": { name: "Rochester", state: "NY", county: "Monroe", heroContent: "Rochester's heavy snowfall and older homes create constant demand for emergency plumbing service, especially frozen pipe repair in winter months.", nearbyCities: [nc("Buffalo","buffalo","new-york"), nc("Syracuse","syracuse","new-york")] },
  "yonkers": { name: "Yonkers", state: "NY", county: "Westchester", heroContent: "Yonkers' dense urban housing and older apartment buildings mean emergency plumbing calls for burst pipes and sewer issues are frequent.", nearbyCities: [nc("New York City","new-york","new-york")] },
  "syracuse": { name: "Syracuse", state: "NY", county: "Onondaga", heroContent: "Syracuse receives some of the heaviest snowfall of any US city, making frozen pipes and winter plumbing emergencies a top concern for homeowners.", nearbyCities: [nc("Rochester","rochester","new-york"), nc("Albany","albany","new-york")] },
  "albany": { name: "Albany", state: "NY", county: "Albany", heroContent: "Albany's historic capital district homes have aging plumbing systems that face extreme stress during New York's harsh winters.", nearbyCities: [nc("Syracuse","syracuse","new-york")] },
});

// ============================================================================
// PENNSYLVANIA
// ============================================================================
addCities("PA", {
  "philadelphia": { name: "Philadelphia", state: "PA", county: "Philadelphia", heroContent: "Philadelphia's centuries-old row homes and aging city infrastructure make burst pipes, sewer backups, and water heater failures a constant plumbing emergency.", nearbyCities: [nc("Pittsburgh","pittsburgh","pennsylvania"), nc("Allentown","allentown","pennsylvania")] },
  "pittsburgh": { name: "Pittsburgh", state: "PA", county: "Allegheny", heroContent: "Pittsburgh's hilly terrain and older housing stock with lead and iron pipes create unique plumbing challenges, especially during freeze-thaw winter cycles.", nearbyCities: [nc("Philadelphia","philadelphia","pennsylvania")] },
  "allentown": { name: "Allentown", state: "PA", county: "Lehigh", heroContent: "Allentown's mix of older Lehigh Valley homes and newer developments face plumbing emergencies from aging pipe failures to water heater issues.", nearbyCities: [nc("Philadelphia","philadelphia","pennsylvania"), nc("Reading","reading","pennsylvania")] },
  "erie": { name: "Erie", state: "PA", county: "Erie", heroContent: "Erie's Lake Effect snow and extreme cold make frozen and burst pipes one of the most common winter plumbing emergencies in northwestern Pennsylvania.", nearbyCities: [] },
  "reading": { name: "Reading", state: "PA", county: "Berks", heroContent: "Reading's older row homes and industrial-era housing stock mean aging plumbing systems that are prone to emergency failures.", nearbyCities: [nc("Allentown","allentown","pennsylvania"), nc("Philadelphia","philadelphia","pennsylvania")] },
});

// ============================================================================
// OHIO
// ============================================================================
addCities("OH", {
  "columbus": { name: "Columbus", state: "OH", county: "Franklin", heroContent: "Columbus is Ohio's largest and fastest-growing city, where older neighborhoods and rapid new development both create steady demand for emergency plumbing.", nearbyCities: [nc("Cincinnati","cincinnati","ohio"), nc("Cleveland","cleveland","ohio"), nc("Dayton","dayton","ohio")] },
  "cleveland": { name: "Cleveland", state: "OH", county: "Cuyahoga", heroContent: "Cleveland's harsh Lake Erie winters and older housing stock make frozen pipes and basement flooding among the most common plumbing emergencies.", nearbyCities: [nc("Akron","akron","ohio"), nc("Columbus","columbus","ohio"), nc("Toledo","toledo","ohio")] },
  "cincinnati": { name: "Cincinnati", state: "OH", county: "Hamilton", heroContent: "Cincinnati's hilly terrain and older neighborhoods face unique plumbing challenges from sewer line issues to pipe failures in century-old homes.", nearbyCities: [nc("Columbus","columbus","ohio"), nc("Dayton","dayton","ohio")] },
  "toledo": { name: "Toledo", state: "OH", county: "Lucas", heroContent: "Toledo's location on Lake Erie and cold winters mean plumbing emergencies from frozen pipes are a major concern for northwest Ohio homeowners.", nearbyCities: [nc("Cleveland","cleveland","ohio")] },
  "akron": { name: "Akron", state: "OH", county: "Summit", heroContent: "Akron's older rubber-era homes and winter freeze cycles create constant demand for emergency plumbing from burst pipes to water heater replacements.", nearbyCities: [nc("Cleveland","cleveland","ohio"), nc("Columbus","columbus","ohio")] },
  "dayton": { name: "Dayton", state: "OH", county: "Montgomery", heroContent: "Dayton's affordable older housing stock means many homes have aging plumbing systems prone to emergency failures during extreme weather.", nearbyCities: [nc("Columbus","columbus","ohio"), nc("Cincinnati","cincinnati","ohio")] },
});

// ============================================================================
// GEORGIA
// ============================================================================
addCities("GA", {
  "atlanta": { name: "Atlanta", state: "GA", county: "Fulton", heroContent: "Atlanta's rapid growth and older in-town neighborhoods create constant demand for emergency plumbing, from burst pipes during rare freezes to sewer backups.", nearbyCities: [nc("Augusta","augusta","georgia"), nc("Savannah","savannah","georgia")] },
  "augusta": { name: "Augusta", state: "GA", county: "Richmond", heroContent: "Augusta's older homes and seasonal temperature changes create plumbing challenges from water heater failures to pipe leaks.", nearbyCities: [nc("Atlanta","atlanta","georgia")] },
  "columbus": { name: "Columbus", state: "GA", county: "Muscogee", heroContent: "Columbus' mix of military housing and established neighborhoods means consistent demand for reliable emergency plumbing service.", nearbyCities: [nc("Atlanta","atlanta","georgia")] },
  "savannah": { name: "Savannah", state: "GA", county: "Chatham", heroContent: "Savannah's historic district homes with century-old plumbing and coastal humidity create unique emergency plumbing challenges.", nearbyCities: [nc("Atlanta","atlanta","georgia")] },
  "athens": { name: "Athens", state: "GA", county: "Clarke", heroContent: "Athens' mix of university housing and historic homes means plumbing emergencies range from overtaxed rental systems to aging residential pipes.", nearbyCities: [nc("Atlanta","atlanta","georgia")] },
});

// ============================================================================
// NORTH CAROLINA
// ============================================================================
addCities("NC", {
  "charlotte": { name: "Charlotte", state: "NC", county: "Mecklenburg", heroContent: "Charlotte's booming growth from banking hub to tech center means both new construction issues and aging suburban plumbing emergencies across the Queen City.", nearbyCities: [nc("Raleigh","raleigh","north-carolina"), nc("Greensboro","greensboro","north-carolina")] },
  "raleigh": { name: "Raleigh", state: "NC", county: "Wake", heroContent: "Raleigh's Research Triangle growth has brought rapid development, but older neighborhoods still face aging pipe emergencies alongside newer construction issues.", nearbyCities: [nc("Durham","durham","north-carolina"), nc("Charlotte","charlotte","north-carolina")] },
  "greensboro": { name: "Greensboro", state: "NC", county: "Guilford", heroContent: "Greensboro's established neighborhoods and clay-heavy soil create plumbing challenges from shifting sewer lines to pipe corrosion.", nearbyCities: [nc("Winston-Salem","winston-salem","north-carolina"), nc("Durham","durham","north-carolina")] },
  "durham": { name: "Durham", state: "NC", county: "Durham", heroContent: "Durham's revitalized downtown and growing suburbs mean diverse plumbing needs from historic building repairs to new construction emergencies.", nearbyCities: [nc("Raleigh","raleigh","north-carolina"), nc("Greensboro","greensboro","north-carolina")] },
  "winston-salem": { name: "Winston-Salem", state: "NC", county: "Forsyth", heroContent: "Winston-Salem's older tobacco-era homes and newer suburban development create varied plumbing emergency needs across the Twin City.", nearbyCities: [nc("Greensboro","greensboro","north-carolina")] },
  "fayetteville": { name: "Fayetteville", state: "NC", county: "Cumberland", heroContent: "Fayetteville's military community and established neighborhoods near Fort Liberty require reliable around-the-clock emergency plumbing service.", nearbyCities: [nc("Raleigh","raleigh","north-carolina")] },
});

// ============================================================================
// ARIZONA
// ============================================================================
addCities("AZ", {
  "phoenix": { name: "Phoenix", state: "AZ", county: "Maricopa", heroContent: "Phoenix's extreme desert heat puts immense strain on plumbing systems, with water heater failures and pipe expansion issues common during scorching summer months.", nearbyCities: [nc("Mesa","mesa","arizona"), nc("Scottsdale","scottsdale","arizona"), nc("Chandler","chandler","arizona"), nc("Glendale","glendale","arizona"), nc("Tempe","tempe","arizona")] },
  "tucson": { name: "Tucson", state: "AZ", county: "Pima", heroContent: "Tucson's desert climate and hard water conditions cause mineral buildup and accelerated pipe deterioration, making emergency plumbing a regular need.", nearbyCities: [] },
  "mesa": { name: "Mesa", state: "AZ", county: "Maricopa", heroContent: "Mesa is the third-largest city in Arizona where extreme heat and hard water create constant plumbing stress on residential systems.", nearbyCities: [nc("Phoenix","phoenix","arizona"), nc("Chandler","chandler","arizona"), nc("Gilbert","gilbert","arizona"), nc("Tempe","tempe","arizona")] },
  "chandler": { name: "Chandler", state: "AZ", county: "Maricopa", heroContent: "Chandler's tech-driven growth and desert climate mean both newer and established homes face water heater and pipe emergencies from extreme heat.", nearbyCities: [nc("Mesa","mesa","arizona"), nc("Gilbert","gilbert","arizona"), nc("Tempe","tempe","arizona"), nc("Phoenix","phoenix","arizona")] },
  "scottsdale": { name: "Scottsdale", state: "AZ", county: "Maricopa", heroContent: "Scottsdale's luxury homes and desert location mean premium plumbing service is essential when emergencies strike in the Valley's most upscale community.", nearbyCities: [nc("Phoenix","phoenix","arizona"), nc("Tempe","tempe","arizona")] },
  "gilbert": { name: "Gilbert", state: "AZ", county: "Maricopa", heroContent: "Gilbert has transformed from farmland to one of Arizona's largest communities, where newer homes still face hard water and heat-related plumbing emergencies.", nearbyCities: [nc("Mesa","mesa","arizona"), nc("Chandler","chandler","arizona")] },
  "glendale": { name: "Glendale", state: "AZ", county: "Maricopa", heroContent: "Glendale's mix of established neighborhoods and new development in the West Valley creates diverse plumbing emergency needs throughout the year.", nearbyCities: [nc("Phoenix","phoenix","arizona"), nc("Peoria","peoria","arizona")] },
  "tempe": { name: "Tempe", state: "AZ", county: "Maricopa", heroContent: "Tempe's university-driven rental market and established residential areas both face plumbing emergencies from Arizona's extreme heat and hard water.", nearbyCities: [nc("Phoenix","phoenix","arizona"), nc("Mesa","mesa","arizona"), nc("Scottsdale","scottsdale","arizona"), nc("Chandler","chandler","arizona")] },
  "peoria": { name: "Peoria", state: "AZ", county: "Maricopa", heroContent: "Peoria's rapid growth in the Northwest Valley means many newer homes are reaching the age of first major plumbing issues alongside established communities.", nearbyCities: [nc("Glendale","glendale","arizona"), nc("Phoenix","phoenix","arizona"), nc("Surprise","surprise","arizona")] },
  "surprise": { name: "Surprise", state: "AZ", county: "Maricopa", heroContent: "Surprise is one of Phoenix's fastest-growing suburbs where desert heat and hard water put constant strain on newer plumbing systems.", nearbyCities: [nc("Peoria","peoria","arizona"), nc("Phoenix","phoenix","arizona")] },
});

// ============================================================================
// WASHINGTON
// ============================================================================
addCities("WA", {
  "seattle": { name: "Seattle", state: "WA", county: "King", heroContent: "Seattle's heavy rainfall and aging infrastructure make sewer backups and drain emergencies a frequent concern for homeowners across the Emerald City.", nearbyCities: [nc("Tacoma","tacoma","washington"), nc("Bellevue","bellevue","washington"), nc("Kent","kent","washington")] },
  "spokane": { name: "Spokane", state: "WA", county: "Spokane", heroContent: "Spokane's harsh winters and older downtown housing stock mean frozen pipes and water heater failures are among the most common plumbing emergencies.", nearbyCities: [] },
  "tacoma": { name: "Tacoma", state: "WA", county: "Pierce", heroContent: "Tacoma's older industrial-era homes and rainy climate create plumbing challenges from corroded pipes to persistent drain issues.", nearbyCities: [nc("Seattle","seattle","washington"), nc("Kent","kent","washington")] },
  "vancouver": { name: "Vancouver", state: "WA", county: "Clark", heroContent: "Vancouver's Pacific Northwest rain and growing residential areas mean steady demand for emergency plumbing from drain backups to water heater failures.", nearbyCities: [] },
  "bellevue": { name: "Bellevue", state: "WA", county: "King", heroContent: "Bellevue's upscale homes and tech-industry growth demand premium emergency plumbing service when pipe bursts or water heater failures strike.", nearbyCities: [nc("Seattle","seattle","washington"), nc("Kent","kent","washington")] },
  "kent": { name: "Kent", state: "WA", county: "King", heroContent: "Kent's diverse residential neighborhoods in the Green River Valley face plumbing emergencies from aging infrastructure and seasonal rain-related issues.", nearbyCities: [nc("Seattle","seattle","washington"), nc("Tacoma","tacoma","washington"), nc("Bellevue","bellevue","washington")] },
});

// ============================================================================
// COLORADO
// ============================================================================
addCities("CO", {
  "denver": { name: "Denver", state: "CO", county: "Denver", heroContent: "Denver's Mile High altitude and dramatic temperature swings cause rapid freeze-thaw cycles that put extreme stress on residential plumbing systems.", nearbyCities: [nc("Aurora","aurora","colorado"), nc("Lakewood","lakewood","colorado"), nc("Thornton","thornton","colorado")] },
  "colorado-springs": { name: "Colorado Springs", state: "CO", county: "El Paso", heroContent: "Colorado Springs' high elevation and cold winters mean frozen pipes and water line breaks are among the most frequent plumbing emergencies.", nearbyCities: [nc("Denver","denver","colorado")] },
  "aurora": { name: "Aurora", state: "CO", county: "Arapahoe", heroContent: "Aurora's sprawling suburbs east of Denver feature homes from multiple eras, all facing Colorado's extreme temperature swings that stress plumbing systems.", nearbyCities: [nc("Denver","denver","colorado"), nc("Lakewood","lakewood","colorado")] },
  "fort-collins": { name: "Fort Collins", state: "CO", county: "Larimer", heroContent: "Fort Collins' university town atmosphere and northern Colorado winters create steady demand for emergency plumbing from frozen pipes to water heater failures.", nearbyCities: [nc("Denver","denver","colorado")] },
  "lakewood": { name: "Lakewood", state: "CO", county: "Jefferson", heroContent: "Lakewood's established neighborhoods west of Denver have aging plumbing systems that face Colorado's freeze-thaw cycles.", nearbyCities: [nc("Denver","denver","colorado"), nc("Aurora","aurora","colorado")] },
  "thornton": { name: "Thornton", state: "CO", county: "Adams", heroContent: "Thornton is a rapidly growing northern Denver suburb where new construction and established homes alike face Colorado's plumbing challenges.", nearbyCities: [nc("Denver","denver","colorado")] },
});

// ============================================================================
// REMAINING MAJOR STATES (key cities)
// ============================================================================

addCities("MA", {
  "boston": { name: "Boston", state: "MA", county: "Suffolk", heroContent: "Boston's centuries-old buildings and brutal nor'easters make frozen pipes and aging infrastructure failures among the most common plumbing emergencies.", nearbyCities: [nc("Worcester","worcester","massachusetts"), nc("Cambridge","cambridge","massachusetts")] },
  "worcester": { name: "Worcester", state: "MA", county: "Worcester", heroContent: "Worcester's older triple-deckers and harsh New England winters create constant demand for emergency plumbing service.", nearbyCities: [nc("Boston","boston","massachusetts"), nc("Springfield","springfield","massachusetts")] },
  "springfield": { name: "Springfield", state: "MA", county: "Hampden", heroContent: "Springfield's older housing stock and Western Massachusetts winters mean aging plumbing systems face regular emergency situations.", nearbyCities: [nc("Worcester","worcester","massachusetts")] },
  "cambridge": { name: "Cambridge", state: "MA", county: "Middlesex", heroContent: "Cambridge's dense mix of historic homes and university buildings creates unique plumbing challenges, especially during harsh winter months.", nearbyCities: [nc("Boston","boston","massachusetts")] },
  "lowell": { name: "Lowell", state: "MA", county: "Middlesex", heroContent: "Lowell's historic mill city architecture and older residential areas mean plumbing emergencies from aging pipes are a frequent concern.", nearbyCities: [nc("Boston","boston","massachusetts")] },
});

addCities("TN", {
  "nashville": { name: "Nashville", state: "TN", county: "Davidson", heroContent: "Nashville's explosive growth has brought new construction alongside older neighborhoods, creating diverse emergency plumbing needs across Music City.", nearbyCities: [nc("Memphis","memphis","tennessee"), nc("Knoxville","knoxville","tennessee"), nc("Clarksville","clarksville","tennessee")] },
  "memphis": { name: "Memphis", state: "TN", county: "Shelby", heroContent: "Memphis sits on the Mississippi River bluffs with older housing stock and clay soil that create sewer line and foundation-related plumbing emergencies.", nearbyCities: [nc("Nashville","nashville","tennessee")] },
  "knoxville": { name: "Knoxville", state: "TN", county: "Knox", heroContent: "Knoxville's mix of university housing and older East Tennessee homes creates varied plumbing emergency needs year-round.", nearbyCities: [nc("Nashville","nashville","tennessee"), nc("Chattanooga","chattanooga","tennessee")] },
  "chattanooga": { name: "Chattanooga", state: "TN", county: "Hamilton", heroContent: "Chattanooga's mountain terrain and older neighborhoods face unique plumbing challenges from shifting sewer lines to winter pipe freezes.", nearbyCities: [nc("Knoxville","knoxville","tennessee"), nc("Nashville","nashville","tennessee")] },
  "clarksville": { name: "Clarksville", state: "TN", county: "Montgomery", heroContent: "Clarksville's military community near Fort Campbell requires reliable 24/7 emergency plumbing service for its growing population.", nearbyCities: [nc("Nashville","nashville","tennessee")] },
});

addCities("IN", {
  "indianapolis": { name: "Indianapolis", state: "IN", county: "Marion", heroContent: "Indianapolis' continental climate brings harsh winters that freeze pipes and humid summers that strain water heaters across Indiana's capital.", nearbyCities: [nc("Fort Wayne","fort-wayne","indiana"), nc("Carmel","carmel","indiana")] },
  "fort-wayne": { name: "Fort Wayne", state: "IN", county: "Allen", heroContent: "Fort Wayne's cold winters and older residential areas create frequent plumbing emergencies from burst pipes to sewer backups.", nearbyCities: [nc("Indianapolis","indianapolis","indiana"), nc("South Bend","south-bend","indiana")] },
  "evansville": { name: "Evansville", state: "IN", county: "Vanderburgh", heroContent: "Evansville's Ohio River location and older housing stock face plumbing challenges from river flooding risks to aging pipe systems.", nearbyCities: [nc("Indianapolis","indianapolis","indiana")] },
  "south-bend": { name: "South Bend", state: "IN", county: "St. Joseph", heroContent: "South Bend's Lake Effect weather and older neighborhoods near Notre Dame make winter plumbing emergencies a top homeowner concern.", nearbyCities: [nc("Fort Wayne","fort-wayne","indiana")] },
  "carmel": { name: "Carmel", state: "IN", county: "Hamilton", heroContent: "Carmel is one of Indiana's most affluent suburbs with both new luxury homes and established neighborhoods requiring responsive plumbing service.", nearbyCities: [nc("Indianapolis","indianapolis","indiana")] },
});

addCities("MO", {
  "kansas-city": { name: "Kansas City", state: "MO", county: "Jackson", heroContent: "Kansas City's extreme temperature range from scorching summers to frigid winters puts year-round stress on plumbing systems across the metro.", nearbyCities: [nc("St. Louis","st-louis","missouri"), nc("Independence","independence","missouri")] },
  "st-louis": { name: "St. Louis", state: "MO", county: "St. Louis City", heroContent: "St. Louis' historic brick homes and aging city infrastructure make sewer backups and pipe failures among the most common plumbing emergencies.", nearbyCities: [nc("Kansas City","kansas-city","missouri"), nc("Springfield","springfield","missouri"), nc("Columbia","columbia","missouri")] },
  "springfield": { name: "Springfield", state: "MO", county: "Greene", heroContent: "Springfield's Ozarks location and karst geology create unique plumbing challenges from shifting foundations to sewer issues.", nearbyCities: [nc("Kansas City","kansas-city","missouri"), nc("St. Louis","st-louis","missouri")] },
  "columbia": { name: "Columbia", state: "MO", county: "Boone", heroContent: "Columbia's university-driven growth and mix of housing types create diverse plumbing emergency needs from aging pipes to new construction issues.", nearbyCities: [nc("Kansas City","kansas-city","missouri"), nc("St. Louis","st-louis","missouri")] },
  "independence": { name: "Independence", state: "MO", county: "Jackson", heroContent: "Independence's established neighborhoods east of Kansas City have aging plumbing systems that face Missouri's extreme seasonal temperature swings.", nearbyCities: [nc("Kansas City","kansas-city","missouri")] },
});

addCities("MI", {
  "detroit": { name: "Detroit", state: "MI", county: "Wayne", heroContent: "Detroit's aging infrastructure and harsh Michigan winters make burst pipes, sewer backups, and water heater failures a constant plumbing emergency.", nearbyCities: [nc("Warren","warren","michigan"), nc("Sterling Heights","sterling-heights","michigan"), nc("Ann Arbor","ann-arbor","michigan")] },
  "grand-rapids": { name: "Grand Rapids", state: "MI", county: "Kent", heroContent: "Grand Rapids' revitalized downtown and West Michigan winters create diverse plumbing needs from frozen pipes in older homes to new construction issues.", nearbyCities: [nc("Lansing","lansing","michigan")] },
  "warren": { name: "Warren", state: "MI", county: "Macomb", heroContent: "Warren's post-war suburban homes are reaching the age of major plumbing system failures, making emergency service essential.", nearbyCities: [nc("Detroit","detroit","michigan"), nc("Sterling Heights","sterling-heights","michigan")] },
  "sterling-heights": { name: "Sterling Heights", state: "MI", county: "Macomb", heroContent: "Sterling Heights' 1970s-era suburban homes are experiencing aging plumbing issues as systems reach 40-50 years of service.", nearbyCities: [nc("Detroit","detroit","michigan"), nc("Warren","warren","michigan")] },
  "ann-arbor": { name: "Ann Arbor", state: "MI", county: "Washtenaw", heroContent: "Ann Arbor's university town atmosphere and mix of historic and modern homes create varied plumbing emergency needs.", nearbyCities: [nc("Detroit","detroit","michigan"), nc("Lansing","lansing","michigan")] },
  "lansing": { name: "Lansing", state: "MI", county: "Ingham", heroContent: "Lansing's state capital homes and Michigan winters mean emergency plumbing service for frozen pipes and aging systems is in constant demand.", nearbyCities: [nc("Grand Rapids","grand-rapids","michigan"), nc("Ann Arbor","ann-arbor","michigan")] },
});

addCities("MD", {
  "baltimore": { name: "Baltimore", state: "MD", county: "Baltimore City", heroContent: "Baltimore's historic row homes and aging city infrastructure make burst pipes and sewer backups among the most common emergency plumbing calls.", nearbyCities: [nc("Frederick","frederick","maryland"), nc("Rockville","rockville","maryland")] },
  "frederick": { name: "Frederick", state: "MD", county: "Frederick", heroContent: "Frederick's blend of historic downtown charm and growing suburbs creates diverse plumbing emergency needs in western Maryland.", nearbyCities: [nc("Baltimore","baltimore","maryland"), nc("Rockville","rockville","maryland")] },
  "rockville": { name: "Rockville", state: "MD", county: "Montgomery", heroContent: "Rockville's established Montgomery County neighborhoods and newer developments face plumbing emergencies from pipe failures to water heater issues.", nearbyCities: [nc("Baltimore","baltimore","maryland"), nc("Gaithersburg","gaithersburg","maryland")] },
  "gaithersburg": { name: "Gaithersburg", state: "MD", county: "Montgomery", heroContent: "Gaithersburg's tech-corridor growth and diverse housing stock create consistent demand for responsive emergency plumbing service.", nearbyCities: [nc("Rockville","rockville","maryland"), nc("Frederick","frederick","maryland")] },
});

addCities("WI", {
  "milwaukee": { name: "Milwaukee", state: "WI", county: "Milwaukee", heroContent: "Milwaukee's Lake Michigan winters and older housing stock make frozen pipes and water heater failures among the most common plumbing emergencies.", nearbyCities: [nc("Madison","madison","wisconsin"), nc("Kenosha","kenosha","wisconsin"), nc("Racine","racine","wisconsin")] },
  "madison": { name: "Madison", state: "WI", county: "Dane", heroContent: "Madison's isthmus location and Wisconsin winters create plumbing challenges from frozen pipes to sewer line issues across the capital city.", nearbyCities: [nc("Milwaukee","milwaukee","wisconsin"), nc("Green Bay","green-bay","wisconsin")] },
  "green-bay": { name: "Green Bay", state: "WI", county: "Brown", heroContent: "Green Bay's extreme Wisconsin winters and older neighborhoods mean emergency plumbing for frozen and burst pipes is a winter staple.", nearbyCities: [nc("Milwaukee","milwaukee","wisconsin"), nc("Madison","madison","wisconsin")] },
  "kenosha": { name: "Kenosha", state: "WI", county: "Kenosha", heroContent: "Kenosha's Lake Michigan location and mix of older and newer housing face plumbing emergencies from harsh winters and aging infrastructure.", nearbyCities: [nc("Milwaukee","milwaukee","wisconsin"), nc("Racine","racine","wisconsin")] },
  "racine": { name: "Racine", state: "WI", county: "Racine", heroContent: "Racine's lakefront location and industrial-era housing stock mean aging plumbing systems face regular emergency situations.", nearbyCities: [nc("Milwaukee","milwaukee","wisconsin"), nc("Kenosha","kenosha","wisconsin")] },
});

addCities("MN", {
  "minneapolis": { name: "Minneapolis", state: "MN", county: "Hennepin", heroContent: "Minneapolis' extreme winters — often below zero for weeks — make frozen and burst pipes the most common plumbing emergency in the Twin Cities.", nearbyCities: [nc("St. Paul","st-paul","minnesota"), nc("Bloomington","bloomington","minnesota")] },
  "st-paul": { name: "St. Paul", state: "MN", county: "Ramsey", heroContent: "St. Paul's historic neighborhoods and brutal Minnesota winters create constant demand for emergency plumbing from frozen pipe repair to sewer line work.", nearbyCities: [nc("Minneapolis","minneapolis","minnesota"), nc("Bloomington","bloomington","minnesota")] },
  "rochester": { name: "Rochester", state: "MN", county: "Olmsted", heroContent: "Rochester's Mayo Clinic-driven growth and southern Minnesota winters mean plumbing emergencies from frozen pipes and aging systems.", nearbyCities: [nc("Minneapolis","minneapolis","minnesota")] },
  "bloomington": { name: "Bloomington", state: "MN", county: "Hennepin", heroContent: "Bloomington's established suburbs near the Mall of America have homes with aging plumbing systems facing Minnesota's extreme cold.", nearbyCities: [nc("Minneapolis","minneapolis","minnesota"), nc("St. Paul","st-paul","minnesota")] },
});

addCities("NV", {
  "las-vegas": { name: "Las Vegas", state: "NV", county: "Clark", heroContent: "Las Vegas' extreme desert heat and hard water conditions cause rapid water heater failures and pipe mineral buildup, making emergency plumbing essential.", nearbyCities: [nc("Henderson","henderson","nevada"), nc("North Las Vegas","north-las-vegas","nevada")] },
  "henderson": { name: "Henderson", state: "NV", county: "Clark", heroContent: "Henderson's desert climate and newer suburban development face plumbing challenges from extreme heat stress and hard water damage.", nearbyCities: [nc("Las Vegas","las-vegas","nevada"), nc("North Las Vegas","north-las-vegas","nevada")] },
  "reno": { name: "Reno", state: "NV", county: "Washoe", heroContent: "Reno's mountain-desert climate with cold winters and dry summers creates plumbing challenges from frozen pipes to mineral-related failures.", nearbyCities: [nc("Sparks","sparks","nevada")] },
  "north-las-vegas": { name: "North Las Vegas", state: "NV", county: "Clark", heroContent: "North Las Vegas' rapid growth in the desert means newer homes still face hard water and heat-related plumbing emergencies.", nearbyCities: [nc("Las Vegas","las-vegas","nevada"), nc("Henderson","henderson","nevada")] },
  "sparks": { name: "Sparks", state: "NV", county: "Washoe", heroContent: "Sparks' high desert location near Reno creates plumbing challenges from mineral-heavy water and freeze-thaw temperature cycles.", nearbyCities: [nc("Reno","reno","nevada")] },
});

addCities("OR", {
  "portland": { name: "Portland", state: "OR", county: "Multnomah", heroContent: "Portland's persistent rainfall and older craftsman homes make drain backups and sewer issues among the most common plumbing emergencies.", nearbyCities: [nc("Salem","salem","oregon"), nc("Gresham","gresham","oregon"), nc("Hillsboro","hillsboro","oregon")] },
  "salem": { name: "Salem", state: "OR", county: "Marion", heroContent: "Salem's Willamette Valley rainfall and older state capital neighborhoods create steady demand for emergency drain and pipe repair.", nearbyCities: [nc("Portland","portland","oregon"), nc("Eugene","eugene","oregon")] },
  "eugene": { name: "Eugene", state: "OR", county: "Lane", heroContent: "Eugene's rainy climate and university town atmosphere mean persistent drain issues and older plumbing system emergencies.", nearbyCities: [nc("Salem","salem","oregon")] },
  "gresham": { name: "Gresham", state: "OR", county: "Multnomah", heroContent: "Gresham's eastern Portland metro location and rainy climate create consistent plumbing emergency needs from drain backups to pipe issues.", nearbyCities: [nc("Portland","portland","oregon"), nc("Hillsboro","hillsboro","oregon")] },
  "hillsboro": { name: "Hillsboro", state: "OR", county: "Washington", heroContent: "Hillsboro's tech-industry growth and Pacific Northwest rainfall mean both new and established homes face drain and pipe emergencies.", nearbyCities: [nc("Portland","portland","oregon"), nc("Gresham","gresham","oregon")] },
});

addCities("NJ", {
  "newark": { name: "Newark", state: "NJ", county: "Essex", heroContent: "Newark's aging urban infrastructure and dense housing make burst pipes and sewer backups among the most frequent plumbing emergencies.", nearbyCities: [nc("Jersey City","jersey-city","new-jersey"), nc("Elizabeth","elizabeth","new-jersey"), nc("Paterson","paterson","new-jersey")] },
  "jersey-city": { name: "Jersey City", state: "NJ", county: "Hudson", heroContent: "Jersey City's waterfront development boom and older brownstones create diverse plumbing emergency needs from new-build leaks to century-old pipe failures.", nearbyCities: [nc("Newark","newark","new-jersey"), nc("Elizabeth","elizabeth","new-jersey")] },
  "paterson": { name: "Paterson", state: "NJ", county: "Passaic", heroContent: "Paterson's historic Silk City architecture and older apartment buildings mean aging plumbing systems face regular emergency situations.", nearbyCities: [nc("Newark","newark","new-jersey")] },
  "elizabeth": { name: "Elizabeth", state: "NJ", county: "Union", heroContent: "Elizabeth's dense urban housing and older infrastructure create constant demand for emergency plumbing from pipe repairs to sewer issues.", nearbyCities: [nc("Newark","newark","new-jersey"), nc("Jersey City","jersey-city","new-jersey")] },
});

addCities("VA", {
  "virginia-beach": { name: "Virginia Beach", state: "VA", county: "Virginia Beach", heroContent: "Virginia Beach's coastal salt air and sandy soil create unique plumbing challenges from accelerated pipe corrosion to shifting sewer lines.", nearbyCities: [nc("Norfolk","norfolk","virginia"), nc("Chesapeake","chesapeake","virginia"), nc("Newport News","newport-news","virginia")] },
  "norfolk": { name: "Norfolk", state: "VA", county: "Norfolk", heroContent: "Norfolk's naval community and older waterfront neighborhoods face plumbing emergencies from corroded pipes and flooding-related issues.", nearbyCities: [nc("Virginia Beach","virginia-beach","virginia"), nc("Chesapeake","chesapeake","virginia")] },
  "chesapeake": { name: "Chesapeake", state: "VA", county: "Chesapeake", heroContent: "Chesapeake's mix of rural and suburban development with coastal influences creates diverse plumbing emergency needs.", nearbyCities: [nc("Virginia Beach","virginia-beach","virginia"), nc("Norfolk","norfolk","virginia")] },
  "richmond": { name: "Richmond", state: "VA", county: "Richmond", heroContent: "Richmond's historic Fan District homes and expanding suburbs create varied plumbing needs from aging pipe failures to new construction issues.", nearbyCities: [nc("Newport News","newport-news","virginia")] },
  "newport-news": { name: "Newport News", state: "VA", county: "Newport News", heroContent: "Newport News' military and shipyard community requires reliable 24/7 emergency plumbing service for its diverse housing.", nearbyCities: [nc("Virginia Beach","virginia-beach","virginia"), nc("Norfolk","norfolk","virginia")] },
  "alexandria": { name: "Alexandria", state: "VA", county: "Alexandria", heroContent: "Alexandria's Old Town historic homes and newer developments near DC face plumbing emergencies from century-old pipe failures to modern system issues.", nearbyCities: [nc("Richmond","richmond","virginia")] },
});

addCities("SC", {
  "charleston": { name: "Charleston", state: "SC", county: "Charleston", heroContent: "Charleston's historic homes, coastal flooding risks, and high water table create unique plumbing challenges from corroded pipes to sewer backups.", nearbyCities: [nc("North Charleston","north-charleston","south-carolina"), nc("Mount Pleasant","mount-pleasant","south-carolina")] },
  "columbia": { name: "Columbia", state: "SC", county: "Richland", heroContent: "Columbia's hot summers and clay-heavy Midlands soil create plumbing challenges from water heater strain to shifting sewer lines.", nearbyCities: [nc("Greenville","greenville","south-carolina")] },
  "north-charleston": { name: "North Charleston", state: "SC", county: "Charleston", heroContent: "North Charleston's growing population and Lowcountry climate create steady demand for emergency plumbing service.", nearbyCities: [nc("Charleston","charleston","south-carolina"), nc("Mount Pleasant","mount-pleasant","south-carolina")] },
  "mount-pleasant": { name: "Mount Pleasant", state: "SC", county: "Charleston", heroContent: "Mount Pleasant's coastal development and salt air create accelerated plumbing wear, making emergency service essential.", nearbyCities: [nc("Charleston","charleston","south-carolina"), nc("North Charleston","north-charleston","south-carolina")] },
  "greenville": { name: "Greenville", state: "SC", county: "Greenville", heroContent: "Greenville's booming Upstate economy and mix of older and new housing create diverse plumbing emergency needs.", nearbyCities: [nc("Columbia","columbia","south-carolina")] },
});

addCities("AL", {
  "birmingham": { name: "Birmingham", state: "AL", county: "Jefferson", heroContent: "Birmingham's older iron-era housing stock and Alabama's clay soil create plumbing challenges from corroded pipes to shifting sewer lines.", nearbyCities: [nc("Huntsville","huntsville","alabama"), nc("Montgomery","montgomery","alabama")] },
  "montgomery": { name: "Montgomery", state: "AL", county: "Montgomery", heroContent: "Montgomery's state capital homes and Southern heat mean water heater failures and pipe issues are common plumbing emergencies.", nearbyCities: [nc("Birmingham","birmingham","alabama")] },
  "huntsville": { name: "Huntsville", state: "AL", county: "Madison", heroContent: "Huntsville's rocket-fueled growth and North Alabama's diverse weather create plumbing emergencies from frozen pipes to new construction issues.", nearbyCities: [nc("Birmingham","birmingham","alabama")] },
  "mobile": { name: "Mobile", state: "AL", county: "Mobile", heroContent: "Mobile's Gulf Coast humidity and hurricane risks create unique plumbing challenges from pipe corrosion to flood-related emergencies.", nearbyCities: [] },
  "tuscaloosa": { name: "Tuscaloosa", state: "AL", county: "Tuscaloosa", heroContent: "Tuscaloosa's university community and mix of older homes create varied plumbing emergency needs from aging pipes to overtaxed rental systems.", nearbyCities: [nc("Birmingham","birmingham","alabama")] },
});

addCities("LA", {
  "new-orleans": { name: "New Orleans", state: "LA", county: "Orleans Parish", heroContent: "New Orleans' below-sea-level elevation, aging infrastructure, and tropical storms create some of the most challenging plumbing conditions in the nation.", nearbyCities: [nc("Baton Rouge","baton-rouge","louisiana"), nc("Metairie","metairie","louisiana")] },
  "baton-rouge": { name: "Baton Rouge", state: "LA", county: "East Baton Rouge", heroContent: "Baton Rouge's low-lying terrain and heavy rainfall create persistent plumbing challenges from sewer backups to flood-related emergencies.", nearbyCities: [nc("New Orleans","new-orleans","louisiana"), nc("Lafayette","lafayette","louisiana")] },
  "shreveport": { name: "Shreveport", state: "LA", county: "Caddo", heroContent: "Shreveport's aging North Louisiana housing stock and clay soil mean sewer line issues and pipe failures are frequent plumbing emergencies.", nearbyCities: [] },
  "metairie": { name: "Metairie", state: "LA", county: "Jefferson", heroContent: "Metairie's low elevation near New Orleans and older suburban homes face persistent plumbing challenges from drainage to pipe corrosion.", nearbyCities: [nc("New Orleans","new-orleans","louisiana")] },
  "lafayette": { name: "Lafayette", state: "LA", county: "Lafayette", heroContent: "Lafayette's Cajun Country location and low-lying terrain create unique plumbing challenges from drainage issues to aging residential systems.", nearbyCities: [nc("Baton Rouge","baton-rouge","louisiana")] },
});

addCities("KY", {
  "louisville": { name: "Louisville", state: "KY", county: "Jefferson", heroContent: "Louisville's Ohio River location and diverse housing from Victorian Highlands to modern suburbs create varied emergency plumbing needs.", nearbyCities: [nc("Lexington","lexington","kentucky")] },
  "lexington": { name: "Lexington", state: "KY", county: "Fayette", heroContent: "Lexington's Bluegrass Region charm and mix of older and university-area housing create diverse plumbing emergency needs.", nearbyCities: [nc("Louisville","louisville","kentucky"), nc("Bowling Green","bowling-green","kentucky")] },
  "bowling-green": { name: "Bowling Green", state: "KY", county: "Warren", heroContent: "Bowling Green's growing population and karst geology create unique plumbing challenges from sinkhole-related pipe damage to aging systems.", nearbyCities: [nc("Louisville","louisville","kentucky"), nc("Lexington","lexington","kentucky")] },
});

addCities("OK", {
  "oklahoma-city": { name: "Oklahoma City", state: "OK", county: "Oklahoma", heroContent: "Oklahoma City's extreme weather from tornadoes to ice storms puts tremendous stress on plumbing systems across the metro.", nearbyCities: [nc("Tulsa","tulsa","oklahoma"), nc("Norman","norman","oklahoma")] },
  "tulsa": { name: "Tulsa", state: "OK", county: "Tulsa", heroContent: "Tulsa's older neighborhoods and Oklahoma's freeze-thaw cycles create frequent plumbing emergencies from burst pipes to sewer failures.", nearbyCities: [nc("Oklahoma City","oklahoma-city","oklahoma"), nc("Broken Arrow","broken-arrow","oklahoma")] },
  "norman": { name: "Norman", state: "OK", county: "Cleveland", heroContent: "Norman's university community and tornado-prone climate mean emergency plumbing readiness is essential for homeowners.", nearbyCities: [nc("Oklahoma City","oklahoma-city","oklahoma")] },
  "broken-arrow": { name: "Broken Arrow", state: "OK", county: "Tulsa", heroContent: "Broken Arrow's growing Tulsa suburb has homes from multiple decades all facing Oklahoma's extreme weather-related plumbing stress.", nearbyCities: [nc("Tulsa","tulsa","oklahoma")] },
});

addCities("CT", {
  "bridgeport": { name: "Bridgeport", state: "CT", county: "Fairfield", heroContent: "Bridgeport's coastal location and older housing stock mean corroded pipes and winter-related plumbing emergencies are a regular concern.", nearbyCities: [nc("New Haven","new-haven","connecticut"), nc("Stamford","stamford","connecticut")] },
  "new-haven": { name: "New Haven", state: "CT", county: "New Haven", heroContent: "New Haven's Yale-area historic homes and older apartment buildings create diverse emergency plumbing needs from aging pipes to sewer issues.", nearbyCities: [nc("Bridgeport","bridgeport","connecticut"), nc("Hartford","hartford","connecticut")] },
  "stamford": { name: "Stamford", state: "CT", county: "Fairfield", heroContent: "Stamford's affluent Gold Coast homes and corporate campuses demand premium emergency plumbing service when systems fail.", nearbyCities: [nc("Bridgeport","bridgeport","connecticut")] },
  "hartford": { name: "Hartford", state: "CT", county: "Hartford", heroContent: "Hartford's capital city infrastructure and New England winters create constant demand for emergency plumbing from frozen pipes to aging system failures.", nearbyCities: [nc("New Haven","new-haven","connecticut"), nc("Waterbury","waterbury","connecticut")] },
  "waterbury": { name: "Waterbury", state: "CT", county: "New Haven", heroContent: "Waterbury's industrial-era housing and Connecticut winters mean aging plumbing systems face regular emergency situations.", nearbyCities: [nc("Hartford","hartford","connecticut"), nc("New Haven","new-haven","connecticut")] },
});

addCities("UT", {
  "salt-lake-city": { name: "Salt Lake City", state: "UT", county: "Salt Lake", heroContent: "Salt Lake City's cold winters and hard mountain water create plumbing challenges from frozen pipes to mineral buildup throughout the valley.", nearbyCities: [nc("West Valley City","west-valley-city","utah"), nc("Provo","provo","utah"), nc("West Jordan","west-jordan","utah")] },
  "west-valley-city": { name: "West Valley City", state: "UT", county: "Salt Lake", heroContent: "West Valley City's suburban growth and Utah winters mean homes face plumbing emergencies from frozen pipes to water heater failures.", nearbyCities: [nc("Salt Lake City","salt-lake-city","utah"), nc("West Jordan","west-jordan","utah")] },
  "provo": { name: "Provo", state: "UT", county: "Utah", heroContent: "Provo's university community and Utah Valley winters create steady demand for emergency plumbing from frozen pipe repair to water heater issues.", nearbyCities: [nc("Salt Lake City","salt-lake-city","utah"), nc("Orem","orem","utah")] },
  "west-jordan": { name: "West Jordan", state: "UT", county: "Salt Lake", heroContent: "West Jordan's growing south valley suburbs face Utah's freeze-thaw cycles that stress plumbing systems throughout the winter.", nearbyCities: [nc("Salt Lake City","salt-lake-city","utah"), nc("West Valley City","west-valley-city","utah")] },
  "orem": { name: "Orem", state: "UT", county: "Utah", heroContent: "Orem's family-oriented community in Utah Valley faces plumbing emergencies from mountain-fed hard water and cold winter temperatures.", nearbyCities: [nc("Provo","provo","utah"), nc("Salt Lake City","salt-lake-city","utah")] },
});

addCities("KS", {
  "wichita": { name: "Wichita", state: "KS", county: "Sedgwick", heroContent: "Wichita's prairie weather extremes from summer heat to winter ice storms create year-round plumbing emergency demand.", nearbyCities: [] },
  "overland-park": { name: "Overland Park", state: "KS", county: "Johnson", heroContent: "Overland Park's established Johnson County neighborhoods have homes with aging plumbing facing Kansas' extreme seasonal temperature swings.", nearbyCities: [nc("Olathe","olathe","kansas"), nc("Kansas City","kansas-city","kansas")] },
  "kansas-city": { name: "Kansas City", state: "KS", county: "Wyandotte", heroContent: "Kansas City, Kansas sits across from its Missouri counterpart with older neighborhoods facing the same extreme temperature plumbing challenges.", nearbyCities: [nc("Overland Park","overland-park","kansas"), nc("Olathe","olathe","kansas")] },
  "olathe": { name: "Olathe", state: "KS", county: "Johnson", heroContent: "Olathe's rapid growth south of Kansas City means many homes are aging into their first major plumbing emergencies.", nearbyCities: [nc("Overland Park","overland-park","kansas"), nc("Kansas City","kansas-city","kansas")] },
  "topeka": { name: "Topeka", state: "KS", county: "Shawnee", heroContent: "Topeka's capital city homes and Kansas weather extremes create steady demand for emergency plumbing service.", nearbyCities: [nc("Kansas City","kansas-city","kansas")] },
});

addCities("NE", {
  "omaha": { name: "Omaha", state: "NE", county: "Douglas", heroContent: "Omaha's harsh Great Plains winters and older neighborhoods make frozen pipes and water main breaks a constant plumbing concern.", nearbyCities: [nc("Lincoln","lincoln","nebraska")] },
  "lincoln": { name: "Lincoln", state: "NE", county: "Lancaster", heroContent: "Lincoln's university town growth and Nebraska winters create plumbing challenges from frozen pipes to aging system failures.", nearbyCities: [nc("Omaha","omaha","nebraska")] },
});

addCities("NM", {
  "albuquerque": { name: "Albuquerque", state: "NM", county: "Bernalillo", heroContent: "Albuquerque's high desert climate and hard water cause mineral buildup and pipe deterioration requiring emergency plumbing service.", nearbyCities: [nc("Rio Rancho","rio-rancho","new-mexico"), nc("Santa Fe","santa-fe","new-mexico")] },
  "las-cruces": { name: "Las Cruces", state: "NM", county: "Dona Ana", heroContent: "Las Cruces' desert heat and hard water conditions accelerate plumbing wear, making water heater failures a common emergency.", nearbyCities: [nc("Albuquerque","albuquerque","new-mexico")] },
  "rio-rancho": { name: "Rio Rancho", state: "NM", county: "Sandoval", heroContent: "Rio Rancho's newer development and New Mexico's hard water create plumbing challenges from mineral buildup to water heater strain.", nearbyCities: [nc("Albuquerque","albuquerque","new-mexico"), nc("Santa Fe","santa-fe","new-mexico")] },
  "santa-fe": { name: "Santa Fe", state: "NM", county: "Santa Fe", heroContent: "Santa Fe's historic adobe homes and mountain climate create unique plumbing challenges from aging systems to freeze-related emergencies.", nearbyCities: [nc("Albuquerque","albuquerque","new-mexico"), nc("Rio Rancho","rio-rancho","new-mexico")] },
});

addCities("ID", {
  "boise": { name: "Boise", state: "ID", county: "Ada", heroContent: "Boise's rapid growth and Idaho winters create plumbing challenges from frozen pipes in older neighborhoods to new construction issues.", nearbyCities: [nc("Meridian","meridian","idaho"), nc("Nampa","nampa","idaho")] },
  "meridian": { name: "Meridian", state: "ID", county: "Ada", heroContent: "Meridian is Idaho's fastest-growing city where newer homes face Treasure Valley's freeze-thaw cycles and hard water issues.", nearbyCities: [nc("Boise","boise","idaho"), nc("Nampa","nampa","idaho")] },
  "nampa": { name: "Nampa", state: "ID", county: "Canyon", heroContent: "Nampa's affordable growth and Idaho winters mean plumbing emergencies from frozen pipes are a major homeowner concern.", nearbyCities: [nc("Boise","boise","idaho"), nc("Meridian","meridian","idaho")] },
});

addCities("HI", {
  "honolulu": { name: "Honolulu", state: "HI", county: "Honolulu", heroContent: "Honolulu's tropical climate and salt air accelerate pipe corrosion, while older Waikiki and downtown buildings face persistent plumbing challenges.", nearbyCities: [] },
});

addCities("IA", {
  "des-moines": { name: "Des Moines", state: "IA", county: "Polk", heroContent: "Des Moines' harsh Iowa winters and older neighborhoods make frozen pipes and water heater failures common plumbing emergencies.", nearbyCities: [nc("Cedar Rapids","cedar-rapids","iowa")] },
  "cedar-rapids": { name: "Cedar Rapids", state: "IA", county: "Linn", heroContent: "Cedar Rapids' flood-prone location and cold winters create diverse plumbing emergency needs from frozen pipes to sewer backups.", nearbyCities: [nc("Des Moines","des-moines","iowa"), nc("Davenport","davenport","iowa")] },
  "davenport": { name: "Davenport", state: "IA", county: "Scott", heroContent: "Davenport's Mississippi River location and older Quad Cities housing face plumbing challenges from flooding risks to aging pipe failures.", nearbyCities: [nc("Cedar Rapids","cedar-rapids","iowa")] },
});

addCities("AR", {
  "little-rock": { name: "Little Rock", state: "AR", county: "Pulaski", heroContent: "Little Rock's capital city homes and Arkansas' variable weather create plumbing emergencies from ice storm pipe bursts to summer heat water heater failures.", nearbyCities: [nc("Fort Smith","fort-smith","arkansas"), nc("Fayetteville","fayetteville","arkansas")] },
  "fort-smith": { name: "Fort Smith", state: "AR", county: "Sebastian", heroContent: "Fort Smith's River Valley location and older housing stock face plumbing challenges from aging pipes to seasonal weather extremes.", nearbyCities: [nc("Little Rock","little-rock","arkansas"), nc("Fayetteville","fayetteville","arkansas")] },
  "fayetteville": { name: "Fayetteville", state: "AR", county: "Washington", heroContent: "Fayetteville's university-driven growth in Northwest Arkansas creates diverse plumbing emergency needs from new construction to aging systems.", nearbyCities: [nc("Little Rock","little-rock","arkansas"), nc("Fort Smith","fort-smith","arkansas")] },
});

addCities("MS", {
  "jackson": { name: "Jackson", state: "MS", county: "Hinds", heroContent: "Jackson's aging water infrastructure and Mississippi's climate create persistent plumbing challenges from water pressure issues to pipe failures.", nearbyCities: [nc("Gulfport","gulfport","mississippi")] },
  "gulfport": { name: "Gulfport", state: "MS", county: "Harrison", heroContent: "Gulfport's Gulf Coast location and hurricane risks create unique plumbing challenges from salt air corrosion to flood-related emergencies.", nearbyCities: [nc("Jackson","jackson","mississippi")] },
});

addCities("WV", {
  "charleston": { name: "Charleston", state: "WV", county: "Kanawha", heroContent: "Charleston's mountain terrain and older housing stock face plumbing challenges from shifting foundations to winter freeze-related pipe bursts.", nearbyCities: [nc("Huntington","huntington","west-virginia")] },
  "huntington": { name: "Huntington", state: "WV", county: "Cabell", heroContent: "Huntington's Ohio River location and aging residential areas create steady demand for emergency plumbing service.", nearbyCities: [nc("Charleston","charleston","west-virginia")] },
});

addCities("NH", {
  "manchester": { name: "Manchester", state: "NH", county: "Hillsborough", heroContent: "Manchester's mill city architecture and New Hampshire winters create plumbing emergencies from frozen pipes to aging system failures.", nearbyCities: [nc("Nashua","nashua","new-hampshire"), nc("Concord","concord","new-hampshire")] },
  "nashua": { name: "Nashua", state: "NH", county: "Hillsborough", heroContent: "Nashua's growing tech corridor and harsh New England winters mean plumbing emergencies from frozen pipes are a top homeowner concern.", nearbyCities: [nc("Manchester","manchester","new-hampshire")] },
  "concord": { name: "Concord", state: "NH", county: "Merrimack", heroContent: "Concord's capital city homes and New Hampshire's extreme cold create constant demand for emergency plumbing service.", nearbyCities: [nc("Manchester","manchester","new-hampshire")] },
});

addCities("ME", {
  "portland": { name: "Portland", state: "ME", county: "Cumberland", heroContent: "Portland's coastal location and Maine's brutal winters make frozen pipes and older building plumbing failures a frequent emergency.", nearbyCities: [nc("Lewiston","lewiston","maine")] },
  "lewiston": { name: "Lewiston", state: "ME", county: "Androscoggin", heroContent: "Lewiston's older mill city housing and Maine winters create persistent plumbing emergency needs from frozen pipes to aging systems.", nearbyCities: [nc("Portland","portland","maine"), nc("Bangor","bangor","maine")] },
  "bangor": { name: "Bangor", state: "ME", county: "Penobscot", heroContent: "Bangor's location in northern Maine means some of the coldest temperatures in the Northeast, making frozen pipe emergencies extremely common.", nearbyCities: [nc("Lewiston","lewiston","maine")] },
});

addCities("RI", {
  "providence": { name: "Providence", state: "RI", county: "Providence", heroContent: "Providence's historic architecture and coastal New England winters create diverse plumbing emergency needs from aged pipes to frozen systems.", nearbyCities: [nc("Warwick","warwick","rhode-island"), nc("Cranston","cranston","rhode-island")] },
  "warwick": { name: "Warwick", state: "RI", county: "Kent", heroContent: "Warwick's established suburban neighborhoods and Rhode Island's seasonal weather create steady demand for emergency plumbing service.", nearbyCities: [nc("Providence","providence","rhode-island"), nc("Cranston","cranston","rhode-island")] },
  "cranston": { name: "Cranston", state: "RI", county: "Providence", heroContent: "Cranston's dense suburban housing near Providence faces plumbing emergencies from aging infrastructure and New England winters.", nearbyCities: [nc("Providence","providence","rhode-island"), nc("Warwick","warwick","rhode-island")] },
});

addCities("DE", {
  "wilmington": { name: "Wilmington", state: "DE", county: "New Castle", heroContent: "Wilmington's older city center and Delaware's seasonal weather create plumbing challenges from aging pipe systems to winter freeze damage.", nearbyCities: [nc("Dover","dover","delaware")] },
  "dover": { name: "Dover", state: "DE", county: "Kent", heroContent: "Dover's state capital homes and mid-Atlantic climate create varied plumbing emergency needs throughout the year.", nearbyCities: [nc("Wilmington","wilmington","delaware")] },
});

addCities("MT", {
  "billings": { name: "Billings", state: "MT", county: "Yellowstone", heroContent: "Billings' extreme Montana winters and remote location make emergency plumbing for frozen pipes an essential service.", nearbyCities: [nc("Missoula","missoula","montana")] },
  "missoula": { name: "Missoula", state: "MT", county: "Missoula", heroContent: "Missoula's mountain valley location and harsh winters create constant demand for emergency plumbing from frozen pipe repair.", nearbyCities: [nc("Billings","billings","montana"), nc("Great Falls","great-falls","montana")] },
  "great-falls": { name: "Great Falls", state: "MT", county: "Cascade", heroContent: "Great Falls' location on the Missouri River and brutal Montana winters mean plumbing emergencies from frozen pipes are a way of life.", nearbyCities: [nc("Missoula","missoula","montana"), nc("Billings","billings","montana")] },
});

addCities("SD", {
  "sioux-falls": { name: "Sioux Falls", state: "SD", county: "Minnehaha", heroContent: "Sioux Falls' harsh Great Plains winters and growing population create steady demand for emergency plumbing from frozen pipe repair.", nearbyCities: [nc("Rapid City","rapid-city","south-dakota")] },
  "rapid-city": { name: "Rapid City", state: "SD", county: "Pennington", heroContent: "Rapid City's Black Hills location and extreme temperature swings create plumbing challenges from frozen pipes to seasonal water heater failures.", nearbyCities: [nc("Sioux Falls","sioux-falls","south-dakota")] },
});

addCities("ND", {
  "fargo": { name: "Fargo", state: "ND", county: "Cass", heroContent: "Fargo regularly sees some of the coldest temperatures in the nation, making frozen and burst pipes the most common plumbing emergency.", nearbyCities: [nc("Bismarck","bismarck","north-dakota"), nc("Grand Forks","grand-forks","north-dakota")] },
  "bismarck": { name: "Bismarck", state: "ND", county: "Burleigh", heroContent: "Bismarck's capital city location and extreme North Dakota winters create constant demand for emergency plumbing service.", nearbyCities: [nc("Fargo","fargo","north-dakota")] },
  "grand-forks": { name: "Grand Forks", state: "ND", county: "Grand Forks", heroContent: "Grand Forks' university community and extreme cold — often dropping below -20F — make frozen pipes a top plumbing emergency.", nearbyCities: [nc("Fargo","fargo","north-dakota")] },
});

addCities("AK", {
  "anchorage": { name: "Anchorage", state: "AK", county: "Anchorage", heroContent: "Anchorage's subarctic climate and permafrost challenges make plumbing one of the most critical home systems, with frozen pipe emergencies extremely common.", nearbyCities: [] },
  "fairbanks": { name: "Fairbanks", state: "AK", county: "Fairbanks North Star", heroContent: "Fairbanks experiences some of the most extreme cold in the US, with temperatures dropping below -40F, making plumbing protection and emergency repair essential.", nearbyCities: [] },
  "juneau": { name: "Juneau", state: "AK", county: "Juneau", heroContent: "Juneau's remote capital city location and heavy rainfall create unique plumbing challenges from drainage issues to winter freeze damage.", nearbyCities: [] },
});

addCities("VT", {
  "burlington": { name: "Burlington", state: "VT", county: "Chittenden", heroContent: "Burlington's Lake Champlain winters and older New England homes create constant demand for emergency plumbing from frozen pipe repair.", nearbyCities: [nc("South Burlington","south-burlington","vermont")] },
  "south-burlington": { name: "South Burlington", state: "VT", county: "Chittenden", heroContent: "South Burlington's growing suburbs and Vermont winters mean plumbing emergencies from frozen pipes and aging systems are common.", nearbyCities: [nc("Burlington","burlington","vermont")] },
});

addCities("WY", {
  "cheyenne": { name: "Cheyenne", state: "WY", county: "Laramie", heroContent: "Cheyenne's high plains elevation and extreme winter winds create plumbing challenges from frozen pipes to wind-chill-stressed water systems.", nearbyCities: [nc("Casper","casper","wyoming"), nc("Laramie","laramie","wyoming")] },
  "casper": { name: "Casper", state: "WY", county: "Natrona", heroContent: "Casper's central Wyoming location and harsh winters mean plumbing emergencies from frozen pipes are a constant homeowner concern.", nearbyCities: [nc("Cheyenne","cheyenne","wyoming")] },
  "laramie": { name: "Laramie", state: "WY", county: "Albany", heroContent: "Laramie's university town at 7,200 feet elevation faces extreme cold that makes frozen pipe prevention and emergency repair critical.", nearbyCities: [nc("Cheyenne","cheyenne","wyoming")] },
});

addCities("DC", {
  "washington": { name: "Washington", state: "DC", county: "District of Columbia", heroContent: "Washington DC's historic row homes and century-old infrastructure make burst pipes and sewer backups among the most common plumbing emergencies in the nation's capital.", nearbyCities: [nc("Alexandria","alexandria","virginia"), nc("Rockville","rockville","maryland"), nc("Baltimore","baltimore","maryland")] },
});

// ============================================================================
// Helper functions
// ============================================================================

import { getStateBySlug, getStateByAbbr, STATES_DATA } from "./states-data";

export function getAllCityParams(): { state: string; city: string }[] {
  const params: { state: string; city: string }[] = [];
  for (const [stateAbbr, cities] of Object.entries(CITY_DATA)) {
    const stateInfo = getStateByAbbr(stateAbbr);
    if (!stateInfo) continue;
    for (const citySlug of Object.keys(cities)) {
      params.push({ state: stateInfo.slug, city: citySlug });
    }
  }
  return params;
}

export function getCityData(stateSlug: string, citySlug: string): CityInfo | null {
  const stateInfo = getStateBySlug(stateSlug);
  if (!stateInfo) return null;
  return CITY_DATA[stateInfo.abbreviation]?.[citySlug] || null;
}

export function getCitiesForState(stateSlug: string): { slug: string; info: CityInfo }[] {
  const stateInfo = getStateBySlug(stateSlug);
  if (!stateInfo) return [];
  const cities = CITY_DATA[stateInfo.abbreviation] || {};
  return Object.entries(cities).map(([slug, info]) => ({ slug, info }));
}

export function getStatesWithCities(): string[] {
  return Object.keys(CITY_DATA).filter(
    (abbr) => Object.keys(CITY_DATA[abbr]).length > 0
  );
}

export function getTotalCityCount(): number {
  return Object.values(CITY_DATA).reduce(
    (sum, cities) => sum + Object.keys(cities).length,
    0
  );
}
