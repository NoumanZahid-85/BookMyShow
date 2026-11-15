/** Tickets the customer opened on this device, kept in the browser so they work as a local wallet. */
export interface SavedTicket {
  ticket_id: string;
  movie_title: string;
  cinema_name: string;
  start_time: string | null;
  seat_ids: string[];
  saved_at: string;
}

const KEY = "bms_tickets";

export function loadSavedTickets(): SavedTicket[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Adds or refreshes one ticket, newest first. */
export function saveTicket(ticket: Omit<SavedTicket, "saved_at">) {
  const rest = loadSavedTickets().filter((t) => t.ticket_id !== ticket.ticket_id);
  localStorage.setItem(KEY, JSON.stringify([{ ...ticket, saved_at: new Date().toISOString() }, ...rest]));
}

export function removeSavedTicket(ticketId: string) {
  localStorage.setItem(KEY, JSON.stringify(loadSavedTickets().filter((t) => t.ticket_id !== ticketId)));
}
