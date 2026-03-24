export type BookingStatus = "accepted" | "pending" | "cancelled" | "rejected";

export interface Booking {
  id: number;
  uid: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  start?: string;
  end?: string;
  eventTypeId: number;
  eventType?: {
    id: number;
    title: string;
    slug: string;
  };
  hosts?: Array<{
    id?: number | string;
    name?: string;
    email?: string;
    username?: string;
    timeZone?: string;
  }>;
  user?: {
    id: number;
    email: string;
    name: string;
    timeZone: string;
  };
  attendees?: Array<{
    id?: number | string;
    email: string;
    name: string;
    timeZone: string;
    noShow?: boolean;
    absent?: boolean;
  }>;
  status: BookingStatus;
  paid?: boolean;
  rescheduled?: boolean;
  location?: string;
  cancellationReason?: string;
  rejectionReason?: string;
  guests?: string[];
  absentHost?: boolean;
  duration?: number;
  meetingUrl?: string;
}
