export interface City {
  id: string;
  name: string;
  slug: string;
  province: string;
}

export interface Cinema {
  id: string;
  name: string;
  chain?: string;
  city_id: string;
  address: string;
  total_screens: number;
}

export interface Show {
  id: string;
  movie_title: string;
  cinema_id: string;
  screen_number: number;
  start_time: string;
  end_time: string;
  base_price: number;
  total_seats: number;
  available_seats: number;
}

export type SeatTier = "SILVER" | "GOLD" | "PLATINUM";

/** How a seat is drawn on the map. */
export type SeatState = "available" | "selected" | "held" | "taken";

export interface SeatItem {
  seat_id: string;
  row: string;
  number: number;
  tier: SeatTier;
  price: number;
  status?: "AVAILABLE" | "HELD" | "BOOKED" | "BROKEN" | "WHEELCHAIR";
  availability?: "AVAILABLE" | "HELD" | "BOOKED";
  is_mine?: boolean;
}

export interface SeatMapData {
  show_id: string;
  cinema_id: string;
  screen_number: number;
  total_seats: number;
  available_count: number;
  held_count: number;
  booked_count: number;
  seats: SeatItem[];
}

export interface HoldResponse {
  hold_id: string;
  show_id: string;
  seats: string[];
  total_amount: number;
  expires_at: string;
  message?: string;
}

export interface BookingResponse {
  booking_id: string;
  show_id: string;
  user_id: string;
  seat_ids: string[];
  total_amount: number;
  status: string;
  payment_id?: string;
  created_at: string;
}

export interface TicketData {
  ticket_id: string;
  booking_id: string;
  show_id: string;
  user_id: string;
  seat_ids: string[];
  total_amount: number;
  status: string;
  qr_payload: string;
  qr_svg: string;
  created_at: string;
}

export interface VerifyResponse {
  valid: boolean;
  ticket_id: string;
  booking_id: string;
  show_id: string;
  seat_ids: string[];
  message: string;
  scanned_at?: string;
}

export type UserRole = "CUSTOMER" | "ADMIN";

export interface User {
  user_id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

/** One status at a time: a request is loading, ready or failed, never two of them. */
export type Async<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: string };

export interface RankedMovie {
  movie_title: string;
  tickets: number;
  revenue: number;
}

export interface RankedShow extends RankedMovie {
  show_id: string;
  cinema_id: string;
  start_time: string;
}

export interface Rankings {
  days: number;
  movies: RankedMovie[];
  shows: RankedShow[];
}

export interface ShowInput {
  movie_title: string;
  screen_number: number;
  start_time: string;
  end_time: string;
  base_price: number;
}

export interface SalesSummary {
  days: number;
  daily: { date: string; tickets: number; revenue: number; bookings: number }[];
  by_hour: { hour: number; tickets: number }[];
  totals: { tickets: number; revenue: number; bookings: number };
}
