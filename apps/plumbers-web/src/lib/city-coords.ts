/**
 * Approximate city center coordinates for geolocation matching.
 * Only major cities need coordinates — users get matched to the nearest one.
 * Format: "stateAbbr:citySlug" -> [lat, lng]
 */

const COORDS: Record<string, [number, number]> = {
  // Alabama
  "AL:birmingham": [33.52, -86.80], "AL:huntsville": [34.73, -86.59], "AL:montgomery": [32.37, -86.30],
  "AL:mobile": [30.69, -88.04], "AL:tuscaloosa": [33.21, -87.57], "AL:hoover": [33.41, -86.81],
  "AL:dothan": [31.22, -85.39], "AL:auburn": [32.61, -85.49], "AL:decatur": [34.61, -86.98],
  "AL:florence": [34.80, -87.68], "AL:gadsden": [34.01, -86.01],
  // Alaska
  "AK:anchorage": [61.22, -149.90], "AK:fairbanks": [64.84, -147.72], "AK:juneau": [58.30, -134.42],
  "AK:wasilla": [61.58, -149.44],
  // Arizona
  "AZ:phoenix": [33.45, -112.07], "AZ:tucson": [32.22, -110.97], "AZ:mesa": [33.42, -111.83],
  "AZ:chandler": [33.30, -111.84], "AZ:gilbert": [33.35, -111.79], "AZ:glendale": [33.54, -112.19],
  "AZ:scottsdale": [33.49, -111.93], "AZ:tempe": [33.43, -111.94], "AZ:peoria": [33.58, -112.24],
  "AZ:surprise": [33.63, -112.37], "AZ:yuma": [32.69, -114.62], "AZ:flagstaff": [35.20, -111.65],
  "AZ:lake-havasu-city": [34.48, -114.32], "AZ:prescott": [34.54, -112.47],
  "AZ:sierra-vista": [31.55, -110.30], "AZ:casa-grande": [32.88, -111.76],
  // Arkansas
  "AR:little-rock": [34.75, -92.29], "AR:fort-smith": [35.39, -94.40], "AR:fayetteville": [36.06, -94.16],
  "AR:springdale": [36.19, -94.13], "AR:jonesboro": [35.84, -90.70], "AR:conway": [35.09, -92.44],
  "AR:rogers": [36.33, -94.12], "AR:bentonville": [36.37, -94.21], "AR:hot-springs": [34.50, -93.06],
  // California
  "CA:alameda": [37.77, -122.24], "CA:los-angeles": [34.05, -118.24], "CA:san-diego": [32.72, -117.16], "CA:san-jose": [37.34, -121.89],
  "CA:san-francisco": [37.77, -122.42], "CA:fresno": [36.74, -119.77], "CA:sacramento": [38.58, -121.49],
  "CA:long-beach": [33.77, -118.19], "CA:oakland": [37.80, -122.27], "CA:bakersfield": [35.37, -119.02],
  "CA:anaheim": [33.84, -117.91], "CA:santa-ana": [33.75, -117.87], "CA:riverside": [33.95, -117.40],
  "CA:stockton": [37.96, -121.29], "CA:irvine": [33.68, -117.83], "CA:chula-vista": [32.64, -117.08],
  "CA:fremont": [37.55, -121.99], "CA:san-bernardino": [34.11, -117.29], "CA:modesto": [37.64, -120.99],
  "CA:fontana": [34.09, -117.44], "CA:moreno-valley": [33.94, -117.23], "CA:glendale": [34.14, -118.26],
  "CA:huntington-beach": [33.66, -117.99], "CA:santa-clarita": [34.39, -118.54],
  "CA:oceanside": [33.20, -117.38], "CA:rancho-cucamonga": [34.11, -117.59], "CA:ontario": [34.06, -117.65],
  "CA:santa-rosa": [38.44, -122.71], "CA:elk-grove": [38.41, -121.37], "CA:corona": [33.88, -117.57],
  "CA:lancaster": [34.70, -118.14], "CA:palmdale": [34.58, -118.12], "CA:salinas": [36.68, -121.66],
  "CA:pomona": [34.06, -117.75], "CA:hayward": [37.67, -122.08], "CA:escondido": [33.12, -117.09],
  "CA:sunnyvale": [37.37, -122.04], "CA:torrance": [33.84, -118.34], "CA:pasadena": [34.15, -118.14],
  "CA:roseville": [38.75, -121.29], "CA:concord": [37.98, -122.03], "CA:simi-valley": [34.27, -118.78],
  "CA:victorville": [34.54, -117.29], "CA:vallejo": [38.10, -122.26], "CA:berkeley": [37.87, -122.27],
  "CA:carlsbad": [33.16, -117.35], "CA:fairfield": [38.25, -122.04], "CA:murrieta": [33.55, -117.21],
  "CA:temecula": [33.49, -117.15], "CA:santa-maria": [34.95, -120.44], "CA:redding": [40.59, -122.39],
  "CA:chico": [39.73, -121.84], "CA:visalia": [36.33, -119.29], "CA:napa": [38.30, -122.29],
  "CA:santa-cruz": [36.97, -122.03], "CA:san-luis-obispo": [35.28, -120.66], "CA:san-leandro": [37.73, -122.16],
  // Colorado
  "CO:denver": [39.74, -104.99], "CO:colorado-springs": [38.83, -104.82], "CO:aurora": [39.73, -104.83],
  "CO:fort-collins": [40.59, -105.08], "CO:lakewood": [39.70, -105.08], "CO:thornton": [39.87, -104.97],
  "CO:arvada": [39.80, -105.09], "CO:westminster": [39.84, -105.04], "CO:pueblo": [38.25, -104.61],
  "CO:boulder": [40.01, -105.27], "CO:greeley": [40.42, -104.71], "CO:longmont": [40.17, -105.10],
  "CO:loveland": [40.40, -105.07], "CO:grand-junction": [39.07, -108.55],
  "CO:castle-rock": [39.37, -104.86], "CO:broomfield": [39.92, -105.09],
  // Connecticut
  "CT:bridgeport": [41.18, -73.19], "CT:new-haven": [41.31, -72.92], "CT:stamford": [41.05, -73.54],
  "CT:hartford": [41.76, -72.68], "CT:waterbury": [41.56, -73.04], "CT:norwalk": [41.12, -73.41],
  "CT:danbury": [41.40, -73.45], "CT:new-britain": [41.66, -72.78], "CT:meriden": [41.54, -72.81],
  // Delaware
  "DE:wilmington": [39.74, -75.55], "DE:dover": [39.16, -75.52], "DE:newark": [39.68, -75.75],
  // DC
  "DC:washington": [38.91, -77.04],
  // Florida
  "FL:jacksonville": [30.33, -81.66], "FL:miami": [25.76, -80.19], "FL:tampa": [27.95, -82.46],
  "FL:orlando": [28.54, -81.38], "FL:st-petersburg": [27.77, -82.64], "FL:hialeah": [25.86, -80.28],
  "FL:tallahassee": [30.44, -84.28], "FL:fort-lauderdale": [26.12, -80.14],
  "FL:port-st-lucie": [27.27, -80.35], "FL:cape-coral": [26.56, -81.95],
  "FL:pembroke-pines": [26.01, -80.34], "FL:hollywood": [26.01, -80.15],
  "FL:gainesville": [29.65, -82.32], "FL:coral-springs": [26.27, -80.27],
  "FL:clearwater": [27.97, -82.77], "FL:palm-bay": [28.03, -80.59],
  "FL:west-palm-beach": [26.72, -80.05], "FL:lakeland": [28.04, -81.95],
  "FL:boca-raton": [26.36, -80.08], "FL:miami-beach": [25.79, -80.13],
  "FL:fort-myers": [26.64, -81.87], "FL:kissimmee": [28.29, -81.41],
  "FL:melbourne": [28.08, -80.61], "FL:daytona-beach": [29.21, -81.02],
  "FL:sarasota": [27.34, -82.53], "FL:pensacola": [30.42, -87.22],
  "FL:panama-city": [30.16, -85.66], "FL:naples": [26.14, -81.79],
  "FL:ocala": [29.19, -82.14], "FL:bradenton": [27.50, -82.57],
  // Georgia
  "GA:atlanta": [33.75, -84.39], "GA:columbus": [32.46, -84.99], "GA:augusta": [33.47, -81.97],
  "GA:savannah": [32.08, -81.09], "GA:athens": [33.95, -83.38], "GA:sandy-springs": [33.93, -84.37],
  "GA:roswell": [34.02, -84.36], "GA:acworth": [34.07, -84.68], "GA:macon": [32.84, -83.63], "GA:marietta": [33.95, -84.55],
  "GA:alpharetta": [34.08, -84.29], "GA:valdosta": [30.83, -83.28],
  // Hawaii
  "HI:honolulu": [21.31, -157.86], "HI:pearl-city": [21.40, -157.97], "HI:hilo": [19.72, -155.08],
  "HI:kailua": [21.40, -157.74], "HI:kahului": [20.89, -156.47],
  // Idaho
  "ID:boise": [43.62, -116.21], "ID:meridian": [43.61, -116.39], "ID:nampa": [43.54, -116.56],
  "ID:idaho-falls": [43.49, -112.03], "ID:pocatello": [42.86, -112.45],
  "ID:coeur-dalene": [47.68, -116.78], "ID:twin-falls": [42.56, -114.46],
  // Illinois
  "IL:chicago": [41.88, -87.63], "IL:aurora": [41.76, -88.32], "IL:naperville": [41.75, -88.15],
  "IL:joliet": [41.53, -88.08], "IL:rockford": [42.27, -89.09], "IL:elgin": [42.04, -88.28],
  "IL:springfield": [39.78, -89.65], "IL:peoria": [40.69, -89.59], "IL:champaign": [40.12, -88.24],
  "IL:schaumburg": [42.03, -88.08], "IL:bolingbrook": [41.70, -88.07],
  "IL:arlington-heights": [42.09, -87.98], "IL:evanston": [42.04, -87.69],
  "IL:crystal-lake": [42.24, -88.32], "IL:wheaton": [41.87, -88.11],
  "IL:downers-grove": [41.79, -88.01], "IL:plainfield": [41.63, -88.20],
  "IL:bloomington": [40.48, -88.99], "IL:normal": [40.51, -88.99],
  "IL:decatur": [39.84, -88.95], "IL:belleville": [38.52, -90.00],
  // Seinfeld Plan priority cities (northern IL suburbs)
  "IL:mchenry": [42.33, -88.27], "IL:algonquin": [42.17, -88.29], "IL:lake-in-the-hills": [42.18, -88.33],
  "IL:huntley": [42.17, -88.43], "IL:woodstock": [42.31, -88.45], "IL:cary": [42.21, -88.24],
  "IL:marengo": [42.25, -88.61], "IL:harvard": [42.42, -88.61], "IL:carpentersville": [42.12, -88.26],
  "IL:south-elgin": [41.99, -88.29], "IL:st-charles": [41.91, -88.31], "IL:geneva": [41.89, -88.32],
  "IL:batavia": [41.85, -88.31],
  // Additional IL cities
  "IL:des-plaines": [42.03, -87.88], "IL:orland-park": [41.63, -87.85], "IL:tinley-park": [41.57, -87.78],
  "IL:oak-lawn": [41.71, -87.76], "IL:berwyn": [41.85, -87.79], "IL:mount-prospect": [42.07, -87.94],
  "IL:hoffman-estates": [42.04, -88.12], "IL:oak-park": [41.89, -87.78], "IL:palatine": [42.11, -88.03],
  "IL:waukegan": [42.36, -87.84], "IL:cicero": [41.85, -87.76], "IL:calumet-city": [41.62, -87.53],
  "IL:buffalo-grove": [42.15, -87.96], "IL:glenview": [42.07, -87.79], "IL:lombard": [41.88, -88.01],
  "IL:bartlett": [41.99, -88.19], "IL:hanover-park": [41.98, -88.15], "IL:streamwood": [42.03, -88.18],
  "IL:carol-stream": [41.91, -88.13], "IL:addison": [41.93, -88.01], "IL:gurnee": [42.37, -87.90],
  "IL:round-lake": [42.35, -88.10], "IL:mundelein": [42.27, -88.00], "IL:vernon-hills": [42.22, -87.97],
  "IL:libertyville": [42.28, -87.95], "IL:lake-zurich": [42.20, -88.09], "IL:wauconda": [42.26, -88.14],
  "IL:island-lake": [42.28, -88.19], "IL:fox-lake": [42.40, -88.18],
  // Indiana
  "IN:indianapolis": [39.77, -86.16], "IN:fort-wayne": [41.08, -85.14],
  "IN:evansville": [37.97, -87.56], "IN:south-bend": [41.68, -86.25],
  "IN:carmel": [39.98, -86.12], "IN:fishers": [39.96, -86.01],
  "IN:bloomington": [39.17, -86.53], "IN:hammond": [41.58, -87.50],
  "IN:lafayette": [40.42, -86.88], "IN:muncie": [40.19, -85.39],
  "IN:terre-haute": [39.47, -87.41], "IN:kokomo": [40.49, -86.13],
  // Iowa
  "IA:des-moines": [41.59, -93.62], "IA:cedar-rapids": [42.01, -91.64],
  "IA:davenport": [41.52, -90.58], "IA:sioux-city": [42.50, -96.40],
  "IA:iowa-city": [41.66, -91.53], "IA:waterloo": [42.49, -92.34],
  "IA:ames": [42.03, -93.62], "IA:council-bluffs": [41.26, -95.86],
  "IA:dubuque": [42.50, -90.66],
  // Kansas
  "KS:wichita": [37.69, -97.34], "KS:overland-park": [38.98, -94.67],
  "KS:kansas-city": [39.11, -94.63], "KS:olathe": [38.88, -94.82],
  "KS:topeka": [39.05, -95.68], "KS:lawrence": [38.97, -95.24],
  "KS:manhattan": [39.18, -96.57], "KS:salina": [38.84, -97.61],
  // Kentucky
  "KY:louisville": [38.25, -85.76], "KY:lexington": [38.04, -84.50],
  "KY:bowling-green": [36.99, -86.44], "KY:owensboro": [37.77, -87.11],
  "KY:covington": [39.08, -84.51], "KY:richmond": [37.75, -84.29],
  "KY:florence": [38.99, -84.63], "KY:hopkinsville": [36.87, -87.49],
  // Louisiana
  "LA:new-orleans": [29.95, -90.07], "LA:baton-rouge": [30.45, -91.19],
  "LA:shreveport": [32.53, -93.75], "LA:lafayette": [30.22, -92.02],
  "LA:lake-charles": [30.23, -93.22], "LA:bossier-city": [32.52, -93.73],
  "LA:monroe": [32.51, -92.12], "LA:alexandria": [31.31, -92.45],
  // Maine
  "ME:portland": [43.66, -70.26], "ME:lewiston": [44.10, -70.21], "ME:bangor": [44.80, -68.77],
  "ME:augusta": [44.31, -69.78],
  // Maryland
  "MD:baltimore": [39.29, -76.61], "MD:columbia": [39.20, -76.86], "MD:germantown": [39.17, -77.27],
  "MD:silver-spring": [38.99, -77.03], "MD:frederick": [39.41, -77.41],
  "MD:rockville": [39.08, -77.15], "MD:bethesda": [38.98, -77.10], "MD:bowie": [38.94, -76.73],
  "MD:annapolis": [38.97, -76.50], "MD:hagerstown": [39.64, -77.72], "MD:salisbury": [38.36, -75.60], "MD:aberdeen": [39.25, -76.68],
  // Massachusetts
  "MA:boston": [42.36, -71.06], "MA:worcester": [42.26, -71.80], "MA:springfield": [42.10, -72.59],
  "MA:lowell": [42.63, -71.32], "MA:cambridge": [42.37, -71.11], "MA:new-bedford": [41.64, -70.93],
  "MA:brockton": [42.08, -71.02], "MA:quincy": [42.25, -71.00], "MA:lynn": [42.47, -70.95],
  "MA:fall-river": [41.70, -71.16], "MA:newton": [42.34, -71.21],
  // Michigan
  "MI:detroit": [42.33, -83.05], "MI:grand-rapids": [42.96, -85.66],
  "MI:warren": [42.49, -83.03], "MI:sterling-heights": [42.58, -83.03],
  "MI:ann-arbor": [42.28, -83.74], "MI:lansing": [42.73, -84.56],
  "MI:dearborn": [42.32, -83.18], "MI:livonia": [42.37, -83.35],
  "MI:troy": [42.61, -83.15], "MI:kalamazoo": [42.29, -85.59],
  "MI:flint": [43.01, -83.69], "MI:saginaw": [43.42, -83.95],
  "MI:traverse-city": [44.76, -85.62],
  // Minnesota
  "MN:minneapolis": [44.98, -93.27], "MN:st-paul": [44.95, -93.09],
  "MN:rochester": [44.02, -92.47], "MN:duluth": [46.79, -92.10],
  "MN:bloomington": [44.84, -93.30], "MN:brooklyn-park": [45.09, -93.36],
  "MN:plymouth": [45.01, -93.46], "MN:maple-grove": [45.07, -93.46],
  "MN:woodbury": [44.92, -92.96], "MN:st-cloud": [45.56, -94.16],
  "MN:eagan": [44.80, -93.17], "MN:eden-prairie": [44.85, -93.47],
  // Mississippi
  "MS:jackson": [32.30, -90.18], "MS:gulfport": [30.37, -89.09],
  "MS:southaven": [34.97, -90.01], "MS:hattiesburg": [31.33, -89.29],
  "MS:biloxi": [30.40, -88.88], "MS:tupelo": [34.26, -88.70],
  "MS:meridian": [32.36, -88.70], "MS:olive-branch": [34.96, -89.83],
  // Missouri
  "MO:kansas-city": [39.10, -94.58], "MO:st-louis": [38.63, -90.20],
  "MO:springfield": [37.22, -93.29], "MO:columbia": [38.95, -92.33],
  "MO:independence": [39.09, -94.41], "MO:lees-summit": [38.91, -94.38],
  "MO:ofallon": [38.81, -90.70], "MO:st-joseph": [39.77, -94.85],
  "MO:st-charles": [38.78, -90.48], "MO:joplin": [37.08, -94.51],
  "MO:jefferson-city": [38.58, -92.17],
  // Montana
  "MT:billings": [45.78, -108.50], "MT:missoula": [46.87, -114.00],
  "MT:great-falls": [47.50, -111.30], "MT:bozeman": [45.68, -111.04],
  "MT:helena": [46.60, -112.04],
  // Nebraska
  "NE:omaha": [41.26, -95.94], "NE:lincoln": [40.81, -96.70],
  "NE:bellevue": [41.15, -95.89], "NE:grand-island": [40.92, -98.34],
  "NE:kearney": [40.70, -99.08],
  // Nevada
  "NV:las-vegas": [36.17, -115.14], "NV:henderson": [36.04, -114.98],
  "NV:reno": [39.53, -119.81], "NV:north-las-vegas": [36.20, -115.12],
  "NV:sparks": [39.53, -119.75], "NV:carson-city": [39.16, -119.77],
  // New Hampshire
  "NH:manchester": [42.99, -71.45], "NH:nashua": [42.77, -71.47],
  "NH:concord": [43.21, -71.54], "NH:dover": [43.20, -70.87],
  "NH:portsmouth": [43.07, -70.76],
  // New Jersey
  "NJ:newark": [40.74, -74.17], "NJ:jersey-city": [40.73, -74.08],
  "NJ:paterson": [40.92, -74.17], "NJ:elizabeth": [40.66, -74.21],
  "NJ:edison": [40.52, -74.41], "NJ:trenton": [40.22, -74.76],
  "NJ:clifton": [40.86, -74.16], "NJ:camden": [39.93, -75.12],
  "NJ:hoboken": [40.74, -74.03], "NJ:atlantic-city": [39.36, -74.42],
  "NJ:morristown": [40.80, -74.48], "NJ:princeton": [40.35, -74.66],
  // New Mexico
  "NM:albuquerque": [35.08, -106.65], "NM:las-cruces": [32.31, -106.75],
  "NM:rio-rancho": [35.23, -106.66], "NM:santa-fe": [35.69, -105.94],
  "NM:roswell": [33.39, -104.52], "NM:farmington": [36.73, -108.22],
  // New York
  "NY:new-york": [40.71, -74.01], "NY:buffalo": [42.89, -78.88],
  "NY:rochester": [43.16, -77.61], "NY:yonkers": [40.93, -73.90],
  "NY:syracuse": [43.05, -76.15], "NY:albany": [42.65, -73.76],
  "NY:schenectady": [42.81, -73.94], "NY:utica": [43.10, -75.23],
  "NY:binghamton": [42.10, -75.91], "NY:niagara-falls": [43.09, -79.06],
  "NY:ithaca": [42.44, -76.50], "NY:poughkeepsie": [41.70, -73.93],
  "NY:saratoga-springs": [43.08, -73.79],
  // North Carolina
  "NC:charlotte": [35.23, -80.84], "NC:raleigh": [35.78, -78.64],
  "NC:greensboro": [36.07, -79.79], "NC:durham": [35.99, -78.90],
  "NC:winston-salem": [36.10, -80.24], "NC:fayetteville": [35.05, -78.88],
  "NC:cary": [35.79, -78.78], "NC:wilmington": [34.24, -77.95],
  "NC:high-point": [35.96, -80.01], "NC:asheville": [35.60, -82.55],
  "NC:concord": [35.41, -80.58], "NC:greenville": [35.61, -77.37],
  "NC:gastonia": [35.26, -81.19], "NC:jacksonville": [34.75, -77.43],
  // North Dakota
  "ND:fargo": [46.88, -96.79], "ND:bismarck": [46.81, -100.78],
  "ND:grand-forks": [47.93, -97.03], "ND:minot": [48.23, -101.30],
  // Ohio
  "OH:columbus": [39.96, -83.00], "OH:cleveland": [41.50, -81.69],
  "OH:cincinnati": [39.10, -84.51], "OH:toledo": [41.65, -83.54],
  "OH:akron": [41.08, -81.52], "OH:dayton": [39.76, -84.19],
  "OH:canton": [40.80, -81.38], "OH:youngstown": [41.10, -80.65],
  "OH:lorain": [41.45, -82.18], "OH:springfield": [39.92, -83.81],
  "OH:dublin": [40.10, -83.11], "OH:westerville": [40.13, -82.93], "OH:stow": [41.17, -81.44],
  // Oklahoma
  "OK:ardmore": [34.17, -97.13], "OK:oklahoma-city": [35.47, -97.52], "OK:tulsa": [36.15, -95.99],
  "OK:norman": [35.22, -97.44], "OK:broken-arrow": [36.06, -95.79],
  "OK:edmond": [35.65, -97.48], "OK:yukon": [35.51, -97.76], "OK:lawton": [34.61, -98.39],
  "OK:moore": [35.34, -97.49], "OK:enid": [36.40, -97.88],
  "OK:stillwater": [36.12, -97.06],
  // Oregon
  "OR:portland": [45.52, -122.68], "OR:salem": [44.94, -123.04],
  "OR:eugene": [44.05, -123.09], "OR:gresham": [45.50, -122.43],
  "OR:hillsboro": [45.52, -122.99], "OR:beaverton": [45.49, -122.80],
  "OR:bend": [44.06, -121.31], "OR:medford": [42.33, -122.88],
  "OR:corvallis": [44.56, -123.26], "OR:albany": [44.64, -123.11],
  // Pennsylvania
  "PA:philadelphia": [39.95, -75.17], "PA:pittsburgh": [40.44, -80.00],
  "PA:allentown": [40.60, -75.49], "PA:reading": [40.34, -75.93],
  "PA:scranton": [41.41, -75.66], "PA:bethlehem": [40.63, -75.37],
  "PA:lancaster": [40.04, -76.31], "PA:harrisburg": [40.27, -76.88],
  "PA:york": [39.96, -76.73], "PA:erie": [42.13, -80.09],
  "PA:state-college": [40.79, -77.86], "PA:williamsport": [41.24, -77.00],
  "PA:west-chester": [39.96, -75.60],
  // Rhode Island
  "RI:providence": [41.82, -71.41], "RI:warwick": [41.70, -71.42],
  "RI:cranston": [41.78, -71.43], "RI:pawtucket": [41.88, -71.38],
  "RI:newport": [41.49, -71.31],
  // South Carolina
  "SC:charleston": [32.78, -79.93], "SC:columbia": [34.00, -81.03],
  "SC:north-charleston": [32.85, -80.00], "SC:mount-pleasant": [32.79, -79.86],
  "SC:rock-hill": [34.93, -81.03], "SC:aiken": [33.56, -81.72], "SC:greenville": [34.85, -82.40],
  "SC:summerville": [33.02, -80.18], "SC:myrtle-beach": [33.69, -78.89],
  "SC:spartanburg": [34.95, -81.93], "SC:florence": [34.20, -79.76],
  // South Dakota
  "SD:sioux-falls": [43.55, -96.73], "SD:rapid-city": [44.08, -103.23],
  "SD:aberdeen": [45.46, -98.49], "SD:brookings": [44.31, -96.80],
  // Tennessee
  "TN:nashville": [36.16, -86.78], "TN:memphis": [35.15, -90.05],
  "TN:knoxville": [35.96, -83.92], "TN:chattanooga": [35.05, -85.31],
  "TN:clarksville": [36.53, -87.36], "TN:murfreesboro": [35.85, -86.39],
  "TN:franklin": [35.93, -86.87], "TN:jackson": [35.61, -88.81],
  "TN:johnson-city": [36.31, -82.35], "TN:kingsport": [36.55, -82.56],
  // Texas
  "TX:houston": [29.76, -95.37], "TX:san-antonio": [29.42, -98.49],
  "TX:dallas": [32.78, -96.80], "TX:austin": [30.27, -97.74],
  "TX:fort-worth": [32.76, -97.33], "TX:el-paso": [31.76, -106.49],
  "TX:arlington": [32.74, -97.11], "TX:corpus-christi": [27.80, -97.40],
  "TX:plano": [33.02, -96.70], "TX:laredo": [27.51, -99.51],
  "TX:lubbock": [33.58, -101.85], "TX:garland": [32.91, -96.64],
  "TX:irving": [32.81, -96.95], "TX:amarillo": [35.22, -101.83],
  "TX:frisco": [33.15, -96.82], "TX:mckinney": [33.20, -96.62],
  "TX:pasadena": [29.69, -95.21], "TX:killeen": [31.12, -97.73],
  "TX:mcallen": [26.20, -98.23], "TX:midland": [31.99, -102.08],
  "TX:denton": [33.21, -97.13], "TX:waco": [31.55, -97.15],
  "TX:round-rock": [30.51, -97.68], "TX:abilene": [32.45, -99.73],
  "TX:beaumont": [30.09, -94.10], "TX:tyler": [32.35, -95.30],
  "TX:sugar-land": [29.62, -95.64], "TX:odessa": [31.85, -102.35],
  "TX:college-station": [30.63, -96.33], "TX:pearland": [29.56, -95.29],
  "TX:the-woodlands": [30.17, -95.50], "TX:conroe": [30.31, -95.46],
  "TX:new-braunfels": [29.70, -98.12], "TX:pflugerville": [30.44, -97.62],
  "TX:cedar-park": [30.51, -97.82], "TX:georgetown": [30.63, -97.68],
  "TX:katy": [29.79, -95.82], "TX:galveston": [29.30, -94.79],
  "TX:brownsville": [25.90, -97.50], "TX:harlingen": [26.19, -97.70],
  // Utah
  "UT:salt-lake-city": [40.76, -111.89], "UT:west-valley-city": [40.69, -112.00],
  "UT:provo": [40.23, -111.66], "UT:west-jordan": [40.61, -111.94],
  "UT:orem": [40.30, -111.70], "UT:sandy": [40.57, -111.88],
  "UT:ogden": [41.22, -111.97], "UT:st-george": [37.10, -113.58],
  "UT:layton": [41.06, -111.97], "UT:logan": [41.74, -111.83],
  // Vermont
  "VT:burlington": [44.48, -73.21], "VT:south-burlington": [44.47, -73.17],
  "VT:rutland": [43.61, -72.97], "VT:montpelier": [44.26, -72.58],
  // Virginia
  "VA:virginia-beach": [36.85, -75.98], "VA:norfolk": [36.85, -76.29],
  "VA:chesapeake": [36.77, -76.29], "VA:richmond": [37.54, -77.44],
  "VA:newport-news": [37.09, -76.47], "VA:alexandria": [38.80, -77.05],
  "VA:hampton": [37.03, -76.35], "VA:roanoke": [37.27, -79.94],
  "VA:lynchburg": [37.41, -79.14], "VA:charlottesville": [38.03, -78.48],
  "VA:harrisonburg": [38.45, -78.87], "VA:fredericksburg": [38.30, -77.46],
  "VA:woodbridge": [38.66, -77.25], "VA:ashburn": [39.04, -77.49],
  "VA:reston": [38.97, -77.34], "VA:fairfax": [38.85, -77.31],
  // Washington
  "WA:seattle": [47.61, -122.33], "WA:spokane": [47.66, -117.43],
  "WA:tacoma": [47.25, -122.44], "WA:vancouver": [45.64, -122.66],
  "WA:bellevue": [47.61, -122.20], "WA:kent": [47.38, -122.23],
  "WA:everett": [47.98, -122.20], "WA:renton": [47.48, -122.22],
  "WA:federal-way": [47.32, -122.31], "WA:kirkland": [47.68, -122.21],
  "WA:bellingham": [48.76, -122.49], "WA:kennewick": [46.21, -119.17],
  "WA:redmond": [47.67, -122.12], "WA:olympia": [47.04, -122.90],
  "WA:bremerton": [47.57, -122.63],
  // West Virginia
  "WV:charleston": [38.35, -81.63], "WV:huntington": [38.42, -82.45],
  "WV:morgantown": [39.63, -79.96], "WV:parkersburg": [39.27, -81.56],
  "WV:wheeling": [40.06, -80.72],
  // Wisconsin
  "WI:milwaukee": [43.04, -87.91], "WI:madison": [43.07, -89.40],
  "WI:green-bay": [44.51, -88.02], "WI:kenosha": [42.58, -87.82],
  "WI:racine": [42.73, -87.78], "WI:appleton": [44.26, -88.42],
  "WI:waukesha": [43.01, -88.23], "WI:eau-claire": [44.81, -91.50],
  "WI:oshkosh": [44.02, -88.54], "WI:janesville": [42.68, -89.02],
  "WI:la-crosse": [43.80, -91.24], "WI:sheboygan": [43.75, -87.71],
  "WI:wausau": [44.96, -89.63],
  // Wyoming
  "WY:cheyenne": [41.14, -104.82], "WY:casper": [42.87, -106.31],
  "WY:laramie": [41.31, -105.59], "WY:gillette": [44.29, -105.50],
  "WY:rock-springs": [41.59, -109.22], "WY:jackson": [43.48, -110.76],
};

import { CITY_LIST } from "./city-list";
import { STATES_DATA } from "./states-data";

export interface CityCoord {
  name: string;
  state: string;
  stateSlug: string;
  citySlug: string;
  lat: number;
  lng: number;
}

export function getCityCoordBySlug(stateAbbr: string, citySlug: string): [number, number] | null {
  const key = `${stateAbbr}:${citySlug}`;
  return COORDS[key] || null;
}

export function getCityCoords(): CityCoord[] {
  const result: CityCoord[] = [];

  for (const city of CITY_LIST) {
    const key = `${city.state}:${city.citySlug}`;
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
