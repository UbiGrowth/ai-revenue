// Pickleball-specific placeholder descriptions for AI image generation
export const PICKLEBALL_CONTEXTS = {
  "Hotels & Resorts": "luxury resort pickleball courts with palm trees and ocean view",
  "Multifamily Real Estate": "modern apartment community pickleball amenity center",
  "Pickleball Clubs & Country Clubs": "premium indoor pickleball facility with professional courts",
  "Entertainment Venues": "vibrant entertainment venue with neon-lit pickleball courts",
  "Physical Therapy": "therapeutic pickleball session at rehabilitation center",
  "Corporate Offices & Co-Working Spaces": "corporate wellness pickleball team building event",
  "Education": "school gymnasium pickleball class with students",
  "Gyms": "fitness center dedicated pickleball training area",
} as const;

// Generate unique placeholder based on campaign context
export const getCampaignPlaceholder = (
  assetType: string,
  vertical?: string,
  campaignName?: string
): string => {
  // Use unique identifiers to ensure different placeholder per campaign
  const seed = campaignName ? hashString(campaignName) : Date.now();
  const variants = getPlaceholderVariants(assetType);
  const variantIndex = seed % variants.length;
  return variants[variantIndex];
};

// Simple hash function for consistent seeding
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Get placeholder variants by asset type - ALL pickleball-specific images
const getPlaceholderVariants = (assetType: string): string[] => {
  // Pickleball-specific Unsplash images
  const pickleballImages = [
    "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80", // Pickleball paddle and ball
    "https://images.unsplash.com/photo-1612534847738-b3af9bc31f0e?w=800&q=80", // Pickleball court
    "https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=800&q=80", // Outdoor sports court
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", // Recreation facility
  ];

  switch (assetType) {
    case "video":
      return [
        "/placeholders/pickleball-video.jpg",
        pickleballImages[0],
        pickleballImages[1],
      ];
    case "email":
      return [
        "/placeholders/pickleball-email.jpg",
        pickleballImages[2],
        pickleballImages[0],
      ];
    case "landing_page":
    case "website":
      return [
        "/placeholders/pickleball-landing.jpg",
        pickleballImages[1],
        pickleballImages[3],
      ];
    case "voice":
      return [
        "/placeholders/pickleball-social.jpg",
        pickleballImages[3],
        pickleballImages[2],
      ];
    default:
      return [
        "/placeholders/pickleball-social.jpg",
        pickleballImages[0],
      ];
  }
};

// Legacy function for backward compatibility
export const getAssetPlaceholder = (assetType: string): string => {
  return getCampaignPlaceholder(assetType);
};
