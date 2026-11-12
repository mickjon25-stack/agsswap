import type { Intent, ListingStatus } from "./constants";

export type PlanId = "free" | "hobby" | "ranch";

export type Profile = {
  id: string;
  display_name: string;
  email: string | null;
  city: string;
  zip: string;
  bio: string;
  company: string;
  role: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_ranch: boolean;
  profile_complete: boolean;
  subscribed: boolean;
  stripe_customer_id?: string | null;
  plan?: PlanId | string;
  plan_status?: string;
  plan_period_end?: string | null;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  poster_id: string;
  title: string;
  category: string;
  intent: Intent | string;
  condition: string;
  description: string;
  looking_for: string;
  price: number;
  city: string;
  zip: string;
  pickup_ok: boolean;
  shipping_ok: boolean;
  fast_window_hours: number;
  scrap_bound: boolean;
  status: ListingStatus | string;
  reject_reason: string;
  approved_at: string | null;
  expires_at: string | null;
  bumped_at?: string | null;
  created_at: string;
  updated_at: string;
  listing_photos?: ListingPhoto[];
  profiles?: Pick<Profile, "id" | "display_name" | "avatar_url" | "city" | "company" | "is_ranch"> | null;
};

export type ListingPhoto = {
  id: string;
  listing_id: string;
  storage_path: string;
  public_url: string | null;
  sort_order: number;
  created_at: string;
};

export type Offer = {
  id: string;
  listing_id: string;
  from_user_id: string;
  offered_listing_id: string | null;
  message: string;
  status: string;
  created_at: string;
};

export type Thread = {
  id: string;
  listing_id: string | null;
  offer_id: string | null;
  participant_a: string | null;
  participant_b: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  listing_id: string | null;
  reported_user_id: string | null;
  reason: string;
  details: string;
  status: string;
  created_at: string;
};
