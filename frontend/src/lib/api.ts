import {
  AuthResponse,
  Cinema,
  City,
  HoldResponse,
  Rankings,
  SalesSummary,
  SeatMapData,
  Show,
  ShowInput,
  TicketData,
  User,
  VerifyResponse,
} from "@/types";

// Browser goes through the Next.js rewrite proxy; server-side calls hit Nginx directly.
const BASE_URL = typeof window !== "undefined" ? "" : (process.env.API_PROXY_URL ?? "http://localhost:8080");

/** One place for fetch, error parsing and envelope handling. Backend errors look like { error: { message } }. */
async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    cache: "no-store",
    ...rest,
    headers: json === undefined ? headers : { "Content-Type": "application/json", ...headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error?.message || body?.detail || body?.message || `Request failed (${res.status})`);
  }
  return body as T;
}

/** Most catalog and booking endpoints wrap the payload in ApiResponse { data }. */
const data = <T>(path: string, init?: RequestInit & { json?: unknown }) =>
  request<{ data: T }>(path, init).then((r) => r.data);

/* Catalog */
export const fetchCities = () => data<City[]>("/cities");
export const fetchCinemasByCity = (cityId: string) => data<Cinema[]>(`/cinemas/city/${cityId}`);
export const fetchCinema = (cinemaId: string) => data<Cinema>(`/cinemas/${cinemaId}`);
export const fetchShowsByCinema = (cinemaId: string) => data<Show[]>(`/shows/cinema/${cinemaId}`);
export const fetchShow = (showId: string) => data<Show>(`/shows/${showId}`);

/* Booking */
export const fetchSeatMap = (showId: string) => data<SeatMapData>(`/shows/${showId}/seats`);

/* Booking: the backend takes the user from the token, never from the body. */
const signedIn = (token: string) => ({ Authorization: `Bearer ${token}` });

export const holdSeatsApi = (token: string, showId: string, seatIds: string[], idempotencyKey: string) =>
  data<HoldResponse>(`/shows/${showId}/hold`, {
    method: "POST",
    headers: signedIn(token),
    json: { seat_ids: seatIds, idempotency_key: idempotencyKey },
  });

export const releaseSeatsApi = (token: string, showId: string, holdId: string, seatIds: string[]) =>
  data<unknown>(`/shows/${showId}/release`, {
    method: "POST",
    headers: signedIn(token),
    json: { hold_id: holdId, seat_ids: seatIds },
  });

/* Payment */
export const createPaymentSessionApi = (token: string, showId: string, holdId: string) =>
  request<{ payment_id: string; amount: number; checkout_url?: string }>("/payments/create-session", {
    method: "POST",
    headers: signedIn(token),
    json: { show_id: showId, hold_id: holdId, provider: "MOCK" },
  });

export const simulatePaymentApi = (paymentId: string, success: boolean) =>
  request<{ status: string; booking_id?: string }>(`/payments/${paymentId}/simulate`, {
    method: "POST",
    json: { success },
  });

/* Tickets */
export const generateTicketApi = (token: string, bookingId: string) =>
  request<TicketData>(`/tickets/generate/${bookingId}`, { method: "POST", headers: signedIn(token) });

export const fetchTicketApi = (ticketId: string) => request<TicketData>(`/tickets/${ticketId}`);

/** Gate staff only: the backend requires an admin token. */
export const verifyTicketGateApi = (token: string, qrPayload: string, gateId: string) =>
  request<VerifyResponse>("/tickets/verify", {
    method: "POST",
    headers: signedIn(token),
    json: { qr_payload: qrPayload, gate_id: gateId },
  });

/* Auth */
export const loginApi = (email: string, password: string) =>
  request<AuthResponse>("/auth/login", { method: "POST", json: { email, password } });

export const registerApi = (email: string, password: string, fullName: string, phone?: string) =>
  request<AuthResponse>("/auth/register", {
    method: "POST",
    json: { email, password, full_name: fullName, phone: phone || null },
  });

export const fetchMeApi = (token: string) =>
  request<User>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });

/* Rankings */
export const fetchRankings = (days = 7, cityId?: string) =>
  data<Rankings>(`/rankings?days=${days}${cityId ? `&city_id=${cityId}` : ""}`);

/* Admin: plain sales numbers for the dashboard charts */
export const fetchSales = (token: string, days = 7, cinemaId?: string) =>
  data<SalesSummary>(`/admin/sales?days=${days}${cinemaId ? `&cinema_id=${cinemaId}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

/* Admin: show management. The backend checks the admin role on the token. */

export const createShowApi = (token: string, cinemaId: string, show: ShowInput) =>
  data<Show>("/shows", { method: "POST", headers: signedIn(token), json: { ...show, cinema_id: cinemaId, total_seats: 120 } });

export const updateShowApi = (token: string, showId: string, show: Partial<ShowInput>) =>
  data<Show>(`/shows/${showId}`, { method: "PATCH", headers: signedIn(token), json: show });

export const deleteShowApi = (token: string, showId: string) =>
  data<unknown>(`/shows/${showId}`, { method: "DELETE", headers: signedIn(token) });
