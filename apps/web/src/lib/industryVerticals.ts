// Shared industry verticals list - used in onboarding and business profile
// This must match the database industry_verticals table

export const INDUSTRY_VERTICALS = [
  "Accounting & Finance",
  "Advertising & Marketing",
  "Aerospace & Defense",
  "Agriculture & Farming",
  "Automotive",
  "Banking & Financial Services",
  "Biotechnology & Pharmaceuticals",
  "Construction & Engineering",
  "Consulting & Professional Services",
  "Consumer Goods & Retail",
  "E-commerce",
  "Education & Training",
  "Energy & Utilities",
  "Entertainment & Media",
  "Environmental Services",
  "Food & Beverage",
  "Government & Public Sector",
  "Healthcare & Medical",
  "Hospitality & Tourism",
  "Human Resources & Staffing",
  "Information Technology",
  "Insurance",
  "Legal Services",
  "Logistics & Transportation",
  "Manufacturing",
  "Non-Profit & NGO",
  "Real Estate & Property",
  "Restaurants & Food Service",
  "SaaS & Software",
  "Sports & Recreation",
  "Telecommunications",
  "Travel & Leisure",
  "Other",
] as const;

export type IndustryVertical = typeof INDUSTRY_VERTICALS[number];

// Match an industry guess to the closest vertical
export function matchIndustryVertical(guess: string): IndustryVertical | null {
  if (!guess) return null;
  
  const lowerGuess = guess.toLowerCase();
  
  // Exact match
  const exact = INDUSTRY_VERTICALS.find(v => v.toLowerCase() === lowerGuess);
  if (exact) return exact;
  
  // Partial match
  const partial = INDUSTRY_VERTICALS.find(v => 
    v.toLowerCase().includes(lowerGuess) || lowerGuess.includes(v.toLowerCase())
  );
  if (partial) return partial;
  
  // Alias matching
  const aliases: Record<string, IndustryVertical> = {
    "tech": "Information Technology",
    "software": "SaaS & Software",
    "saas": "SaaS & Software",
    "health": "Healthcare & Medical",
    "medical": "Healthcare & Medical",
    "finance": "Accounting & Finance",
    "banking": "Banking & Financial Services",
    "fintech": "Banking & Financial Services",
    "marketing": "Advertising & Marketing",
    "ecommerce": "E-commerce",
    "education": "Education & Training",
    "travel": "Travel & Leisure",
    "hospitality": "Hospitality & Tourism",
    "real estate": "Real Estate & Property",
    "legal": "Legal Services",
    "law": "Legal Services",
    "consulting": "Consulting & Professional Services",
    "restaurant": "Restaurants & Food Service",
    "food": "Food & Beverage",
  };
  
  for (const [alias, vertical] of Object.entries(aliases)) {
    if (lowerGuess.includes(alias)) return vertical;
  }
  
  return null;
}
