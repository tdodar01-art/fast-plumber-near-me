export interface BusinessAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  full?: string;
}

export interface ReviewSignal {
  count: number;
  avgRating: number;
  topQuote: string;
}

export interface BusinessSynthesis {
  strengths: string[];
  weaknesses: string[];
  redFlags: string[];
  badges: string[];
  reviewCount: number;
  summary?: string;
  servicesMentioned?: Record<string, ReviewSignal>;
}

export interface BusinessReview {
  id: string;
  businessId: string;
  source: string;
  rating: number;
  text: string;
  authorName?: string;
  publishedAt?: string;
}

export interface Business {
  id: string;
  businessName: string;
  phone: string;
  website: string | null;
  email: string | null;
  address: BusinessAddress;
  serviceCities: string[];
  services: string[];
  isActive: boolean;
  synthesis?: BusinessSynthesis | null;
}

export interface BusinessLead {
  id: string;
  businessId: string;
  businessName: string;
  businessPhone: string;
  city: string;
  state: string;
  citySlug: string;
  pageUrl: string;
  clickType: "call" | "website" | "directions";
  source: string;
}
