export interface CalendarConnection {
  connectionId: string;
  type: "google" | "office365" | "apple";
  email: string | null;
}

export interface ConnectionsResponse {
  status: string;
  data: {
    connections: CalendarConnection[];
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
  isAllDay?: boolean;
  status?: string;
  location?: string;
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  htmlLink?: string;
}

export interface EventResponse {
  status: string;
  data: CalendarEvent;
}

export interface EventListResponse {
  status: string;
  data: CalendarEvent[];
}

export interface BusyTime {
  start: string;
  end: string;
  source?: string;
}

export interface BusyTimesResponse {
  status: string;
  data: BusyTime[];
}
