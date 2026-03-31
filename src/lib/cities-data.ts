/**
 * Static city data used for build-time generation.
 * This is the source of truth for generateStaticParams and metadata.
 * Once Firestore is connected, city pages can also be fetched dynamically.
 */

export interface CityInfo {
  name: string;
  state: string;
  county: string;
  heroContent: string;
  nearbyCities: { name: string; slug: string }[];
}

export const CITY_DATA: Record<string, CityInfo> = {
  // --- McHenry County (original) ---
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
      "Lake in the Hills is a vibrant community in McHenry County with many homes built in the 1990s and 2000s. As these homes age, plumbing issues become more common. Our verified plumbers in Lake in the Hills are confirmed available for emergency calls.",
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
      "Huntley has been one of the fastest-growing communities in the Chicago suburbs. With rapid development comes a need for reliable emergency plumbing services. Our verified plumbers can be there when you need them.",
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
      "Woodstock, the McHenry County seat and home of the famous Groundhog Day square, has many historic homes with aging plumbing systems. Our verified emergency plumbers serving Woodstock are available 24/7.",
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
      "Cary is a charming village nestled along the Fox River in McHenry County. With many homes dating back several decades, plumbing emergencies can strike without warning. Our verified Cary plumbers are just a call away.",
    nearbyCities: [
      { name: "Crystal Lake", slug: "crystal-lake-il" },
      { name: "Algonquin", slug: "algonquin-il" },
      { name: "Lake in the Hills", slug: "lake-in-the-hills-il" },
    ],
  },
  "marengo-il": {
    name: "Marengo",
    state: "IL",
    county: "McHenry",
    heroContent:
      "Marengo is a small but growing community in western McHenry County. With many older homes and rural properties, plumbing emergencies can be especially stressful. Our verified emergency plumbers serve the Marengo area.",
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
      "Harvard sits at the northern edge of McHenry County near the Wisconsin border. Our AI-verified plumbers serving Harvard are confirmed to respond to emergency calls.",
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
      "Carpentersville is a diverse community along the Fox River. Plumbing emergencies don't discriminate by neighborhood. Our verified plumbers serving Carpentersville are ready 24/7.",
    nearbyCities: [
      { name: "Algonquin", slug: "algonquin-il" },
      { name: "Elgin", slug: "elgin-il" },
      { name: "South Elgin", slug: "south-elgin-il" },
    ],
  },

  // --- Kane County ---
  "elgin-il": {
    name: "Elgin",
    state: "IL",
    county: "Kane",
    heroContent:
      "Elgin is one of the largest cities in the Fox Valley, with a diverse housing stock from historic Victorian homes to modern developments. Find a verified emergency plumber in Elgin who will actually answer your call.",
    nearbyCities: [
      { name: "South Elgin", slug: "south-elgin-il" },
      { name: "Carpentersville", slug: "carpentersville-il" },
      { name: "St. Charles", slug: "st-charles-il" },
    ],
  },
  "south-elgin-il": {
    name: "South Elgin",
    state: "IL",
    county: "Kane",
    heroContent:
      "South Elgin is a growing community along the Fox River in Kane County. Our verified emergency plumbers are ready to respond.",
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
      "St. Charles is a picturesque Fox River community with historic homes and modern developments alike. Our verified St. Charles plumbers are confirmed available for emergency service.",
    nearbyCities: [
      { name: "Geneva", slug: "geneva-il" },
      { name: "Batavia", slug: "batavia-il" },
      { name: "South Elgin", slug: "south-elgin-il" },
      { name: "North Aurora", slug: "north-aurora-il" },
    ],
  },
  "geneva-il": {
    name: "Geneva",
    state: "IL",
    county: "Kane",
    heroContent:
      "Geneva is a charming Fox River community known for its historic Third Street shopping district. Our verified emergency plumbers serving Geneva are tested for fast response times.",
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
      "Batavia, the oldest city in Kane County, features homes spanning over a century of construction. Our AI-verified plumbers serving Batavia are ready to handle everything from burst pipes to sewer line failures.",
    nearbyCities: [
      { name: "Geneva", slug: "geneva-il" },
      { name: "Aurora", slug: "aurora-il" },
      { name: "St. Charles", slug: "st-charles-il" },
      { name: "North Aurora", slug: "north-aurora-il" },
      { name: "Warrenville", slug: "warrenville-il" },
    ],
  },
  "aurora-il": {
    name: "Aurora",
    state: "IL",
    county: "Kane",
    heroContent:
      "Aurora is the second-largest city in Illinois, spanning four counties with a vast range of housing. From older east-side homes to new construction on the far west side, plumbing emergencies are a constant. Find verified emergency plumbers in Aurora who will actually answer your call.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "North Aurora", slug: "north-aurora-il" },
      { name: "Batavia", slug: "batavia-il" },
      { name: "Montgomery", slug: "montgomery-il" },
      { name: "Oswego", slug: "oswego-il" },
      { name: "Plainfield", slug: "plainfield-il" },
    ],
  },
  "north-aurora-il": {
    name: "North Aurora",
    state: "IL",
    county: "Kane",
    heroContent:
      "North Aurora is a growing Kane County village with a mix of established and new construction. As homes age, plumbing issues become more common. Our verified emergency plumbers serving North Aurora are tested for fast response times.",
    nearbyCities: [
      { name: "Aurora", slug: "aurora-il" },
      { name: "Batavia", slug: "batavia-il" },
      { name: "Montgomery", slug: "montgomery-il" },
      { name: "Oswego", slug: "oswego-il" },
    ],
  },
  "montgomery-il": {
    name: "Montgomery",
    state: "IL",
    county: "Kane",
    heroContent:
      "Montgomery straddles the Fox River in Kane and Kendall counties with a growing residential base. Water heater failures, frozen pipes, and drain emergencies require fast response. Our verified Montgomery plumbers are ready to help.",
    nearbyCities: [
      { name: "Aurora", slug: "aurora-il" },
      { name: "Oswego", slug: "oswego-il" },
      { name: "North Aurora", slug: "north-aurora-il" },
      { name: "Plainfield", slug: "plainfield-il" },
    ],
  },

  // --- DuPage County ---
  "naperville-il": {
    name: "Naperville",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Naperville is consistently ranked as one of the best places to live in Illinois, but even great cities have plumbing emergencies. From the historic downtown to newer communities along Route 59, our directory connects you with verified plumbers ready to respond.",
    nearbyCities: [
      { name: "Aurora", slug: "aurora-il" },
      { name: "Wheaton", slug: "wheaton-il" },
      { name: "Lisle", slug: "lisle-il" },
      { name: "Bolingbrook", slug: "bolingbrook-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
      { name: "Warrenville", slug: "warrenville-il" },
      { name: "Plainfield", slug: "plainfield-il" },
    ],
  },
  "wheaton-il": {
    name: "Wheaton",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Wheaton is the DuPage County seat, home to beautiful neighborhoods and a vibrant downtown. Many homes have older plumbing prone to emergencies, especially during winter freezes. Our verified plumbers are confirmed responsive to emergency calls in Wheaton.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Glen Ellyn", slug: "glen-ellyn-il" },
      { name: "Lombard", slug: "lombard-il" },
      { name: "Warrenville", slug: "warrenville-il" },
      { name: "Lisle", slug: "lisle-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
    ],
  },
  "downers-grove-il": {
    name: "Downers Grove",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Downers Grove is a classic DuPage County suburb with tree-lined streets and homes dating from the early 1900s to present day. Older plumbing systems mean more emergencies — burst pipes, sewer backups, and water heater failures. Our verified plumbers are ready.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Lombard", slug: "lombard-il" },
      { name: "Lisle", slug: "lisle-il" },
      { name: "Westmont", slug: "westmont-il" },
      { name: "Woodridge", slug: "woodridge-il" },
      { name: "Wheaton", slug: "wheaton-il" },
    ],
  },
  "lombard-il": {
    name: "Lombard",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Lombard is a well-established DuPage County village with housing stock spanning several decades. Aging pipes, drain issues, and water heater problems are everyday realities. Our verified Lombard plumbers are tested for responsiveness.",
    nearbyCities: [
      { name: "Downers Grove", slug: "downers-grove-il" },
      { name: "Glen Ellyn", slug: "glen-ellyn-il" },
      { name: "Villa Park", slug: "villa-park-il" },
      { name: "Wheaton", slug: "wheaton-il" },
      { name: "Glendale Heights", slug: "glendale-heights-il" },
    ],
  },
  "lisle-il": {
    name: "Lisle",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Lisle is a charming village along the East Branch of the DuPage River. With a mix of older homes and corporate campuses, plumbing emergencies can strike alike. Our verified plumbers in Lisle are ready to respond.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
      { name: "Wheaton", slug: "wheaton-il" },
      { name: "Warrenville", slug: "warrenville-il" },
      { name: "Woodridge", slug: "woodridge-il" },
    ],
  },
  "glen-ellyn-il": {
    name: "Glen Ellyn",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Glen Ellyn is a sought-after DuPage County village with many historic homes and mature neighborhoods. Older plumbing systems mean burst pipes, drain backups, and water heater failures are common concerns. Find verified emergency plumbers ready to help.",
    nearbyCities: [
      { name: "Wheaton", slug: "wheaton-il" },
      { name: "Lombard", slug: "lombard-il" },
      { name: "Glendale Heights", slug: "glendale-heights-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
    ],
  },
  "warrenville-il": {
    name: "Warrenville",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Warrenville is a small but vibrant DuPage County city surrounded by forest preserves. Our verified plumbers serving Warrenville are confirmed to answer emergency calls.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Wheaton", slug: "wheaton-il" },
      { name: "Lisle", slug: "lisle-il" },
      { name: "Batavia", slug: "batavia-il" },
    ],
  },
  "woodridge-il": {
    name: "Woodridge",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Woodridge is a friendly village in DuPage and Will counties with homes from the 1970s-2000s. Our verified emergency plumbers in Woodridge are tested for responsiveness and availability.",
    nearbyCities: [
      { name: "Bolingbrook", slug: "bolingbrook-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
      { name: "Lisle", slug: "lisle-il" },
      { name: "Naperville", slug: "naperville-il" },
    ],
  },
  "villa-park-il": {
    name: "Villa Park",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Villa Park is a welcoming DuPage County village with affordable housing and established neighborhoods. Older plumbing systems can lead to unexpected emergencies. Our verified plumbers serving Villa Park are confirmed responsive.",
    nearbyCities: [
      { name: "Lombard", slug: "lombard-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
      { name: "Glendale Heights", slug: "glendale-heights-il" },
      { name: "Elk Grove Village", slug: "elk-grove-village-il" },
    ],
  },
  "westmont-il": {
    name: "Westmont",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Westmont is a compact DuPage County village known for its dining scene and convenient location. Our verified Westmont plumbers are tested for availability.",
    nearbyCities: [
      { name: "Downers Grove", slug: "downers-grove-il" },
      { name: "Clarendon Hills", slug: "clarendon-hills-il" },
      { name: "Lombard", slug: "lombard-il" },
    ],
  },
  "glendale-heights-il": {
    name: "Glendale Heights",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Glendale Heights is a diverse DuPage County village with a range of housing types. Our verified plumbers are ready to respond to emergencies here.",
    nearbyCities: [
      { name: "Glen Ellyn", slug: "glen-ellyn-il" },
      { name: "Lombard", slug: "lombard-il" },
      { name: "Villa Park", slug: "villa-park-il" },
      { name: "Elk Grove Village", slug: "elk-grove-village-il" },
    ],
  },
  "clarendon-hills-il": {
    name: "Clarendon Hills",
    state: "IL",
    county: "DuPage",
    heroContent:
      "Clarendon Hills is a charming, tight-knit DuPage County village with beautiful older homes. Historic plumbing systems mean emergencies like burst pipes and sewer backups are a real concern. Our verified plumbers are confirmed available.",
    nearbyCities: [
      { name: "Westmont", slug: "westmont-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
      { name: "Lombard", slug: "lombard-il" },
    ],
  },

  // --- Will County ---
  "bolingbrook-il": {
    name: "Bolingbrook",
    state: "IL",
    county: "Will",
    heroContent:
      "Bolingbrook is a large suburb in Will County with homes ranging from the 1960s to brand new construction. Aging pipes, sump pump failures, and water heater emergencies are common issues. Our verified plumbers serving Bolingbrook are ready to respond around the clock.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Woodridge", slug: "woodridge-il" },
      { name: "Plainfield", slug: "plainfield-il" },
      { name: "Lockport", slug: "lockport-il" },
      { name: "Lemont", slug: "lemont-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
    ],
  },
  "plainfield-il": {
    name: "Plainfield",
    state: "IL",
    county: "Will",
    heroContent:
      "Plainfield has exploded with growth over the past two decades, bringing thousands of new homes now aging into their first major plumbing issues. From water heater replacements to sewer line problems, our verified plumbers in Plainfield are a call away.",
    nearbyCities: [
      { name: "Naperville", slug: "naperville-il" },
      { name: "Joliet", slug: "joliet-il" },
      { name: "Bolingbrook", slug: "bolingbrook-il" },
      { name: "Oswego", slug: "oswego-il" },
      { name: "Aurora", slug: "aurora-il" },
      { name: "Shorewood", slug: "shorewood-il" },
    ],
  },
  "joliet-il": {
    name: "Joliet",
    state: "IL",
    county: "Will",
    heroContent:
      "Joliet is the largest city in Will County, with a diverse housing stock from historic stone homes to modern subdivisions. Plumbing emergencies don't wait — find a verified emergency plumber in Joliet who will actually pick up the phone.",
    nearbyCities: [
      { name: "Plainfield", slug: "plainfield-il" },
      { name: "Lockport", slug: "lockport-il" },
      { name: "Shorewood", slug: "shorewood-il" },
      { name: "Bolingbrook", slug: "bolingbrook-il" },
    ],
  },
  "lockport-il": {
    name: "Lockport",
    state: "IL",
    county: "Will",
    heroContent:
      "Lockport is a historic Will County city along the Des Plaines River with charming older homes and newer subdivisions. Aging plumbing means emergency calls are common. Find verified plumbers in Lockport ready to respond.",
    nearbyCities: [
      { name: "Joliet", slug: "joliet-il" },
      { name: "Plainfield", slug: "plainfield-il" },
      { name: "Bolingbrook", slug: "bolingbrook-il" },
      { name: "Lemont", slug: "lemont-il" },
      { name: "Shorewood", slug: "shorewood-il" },
    ],
  },
  "shorewood-il": {
    name: "Shorewood",
    state: "IL",
    county: "Will",
    heroContent:
      "Shorewood is a growing Will County village near Joliet with many newer homes along the DuPage River. Even newer construction can experience plumbing emergencies. Our verified plumbers serving Shorewood are ready 24/7.",
    nearbyCities: [
      { name: "Joliet", slug: "joliet-il" },
      { name: "Plainfield", slug: "plainfield-il" },
      { name: "Lockport", slug: "lockport-il" },
    ],
  },

  // --- Kendall County ---
  "oswego-il": {
    name: "Oswego",
    state: "IL",
    county: "Kendall",
    heroContent:
      "Oswego has grown rapidly along the Fox River, with many newer homes starting to experience their first plumbing issues. Whether it's a water heater failure or a frozen pipe in winter, our verified Oswego plumbers are confirmed responsive.",
    nearbyCities: [
      { name: "Aurora", slug: "aurora-il" },
      { name: "Plainfield", slug: "plainfield-il" },
      { name: "Montgomery", slug: "montgomery-il" },
      { name: "Naperville", slug: "naperville-il" },
    ],
  },

  // --- Cook County ---
  "schaumburg-il": {
    name: "Schaumburg",
    state: "IL",
    county: "Cook",
    heroContent:
      "Schaumburg is a major suburban hub in Cook County with thousands of homes and businesses. Plumbing emergencies demand fast response. Our verified Schaumburg plumbers are tested for responsiveness.",
    nearbyCities: [
      { name: "Arlington Heights", slug: "arlington-heights-il" },
      { name: "Elk Grove Village", slug: "elk-grove-village-il" },
      { name: "Wheaton", slug: "wheaton-il" },
    ],
  },
  "arlington-heights-il": {
    name: "Arlington Heights",
    state: "IL",
    county: "Cook",
    heroContent:
      "Arlington Heights is one of the largest villages in Illinois, with a mix of mid-century homes and newer developments. Our verified plumbers in Arlington Heights are ready 24/7.",
    nearbyCities: [
      { name: "Schaumburg", slug: "schaumburg-il" },
      { name: "Elk Grove Village", slug: "elk-grove-village-il" },
    ],
  },
  "lemont-il": {
    name: "Lemont",
    state: "IL",
    county: "Cook/Will",
    heroContent:
      "Lemont sits along the Des Plaines River and the historic Illinois & Michigan Canal, with homes ranging from historic limestone buildings to modern developments. Our verified plumbers are ready.",
    nearbyCities: [
      { name: "Bolingbrook", slug: "bolingbrook-il" },
      { name: "Lockport", slug: "lockport-il" },
      { name: "Downers Grove", slug: "downers-grove-il" },
    ],
  },
  "highland-park-il": {
    name: "Highland Park",
    state: "IL",
    county: "Lake",
    heroContent:
      "Highland Park is an affluent North Shore community in Lake County with a mix of historic estates and modern homes. Premium properties deserve premium plumbing service. Our verified emergency plumbers are confirmed responsive.",
    nearbyCities: [],
  },
  "lyons-il": {
    name: "Lyons",
    state: "IL",
    county: "Cook",
    heroContent:
      "Lyons is a village in Cook County's western suburbs with a mix of residential and commercial properties. Plumbing emergencies in older buildings need fast professional response. Our verified plumbers are ready.",
    nearbyCities: [],
  },
  "elk-grove-village-il": {
    name: "Elk Grove Village",
    state: "IL",
    county: "Cook",
    heroContent:
      "Elk Grove Village has thriving residential neighborhoods alongside one of the largest industrial parks in the US. Whether residential or commercial, plumbing emergencies need fast response. Our verified plumbers are ready to help.",
    nearbyCities: [
      { name: "Glendale Heights", slug: "glendale-heights-il" },
      { name: "Villa Park", slug: "villa-park-il" },
      { name: "Schaumburg", slug: "schaumburg-il" },
    ],
  },
};

export function getAllCitySlugs(): string[] {
  return Object.keys(CITY_DATA);
}
