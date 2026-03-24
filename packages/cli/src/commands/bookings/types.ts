import type {
  BookingAttendeesController20240813AddAttendeeResponse,
  BookingGuestsController20240813AddGuestsResponse,
  BookingLocationController20240813UpdateBookingLocationResponse,
  BookingReferencesOutput20240813,
  BookingsController20240813CancelBookingResponse,
  BookingsController20240813ConfirmBookingResponse,
  BookingsController20240813DeclineBookingResponse,
  BookingsController20240813MarkNoShowResponse,
  BookingsController20240813ReassignBookingResponse,
  CalendarLinksOutput20240813,
  CreateBookingOutput20240813,
  GetBookingOutput20240813,
  GetBookingRecordingsOutput,
  GetBookingsOutput20240813,
  GetBookingTranscriptsOutput,
  GetBookingVideoSessionsOutput,
  RescheduleBookingOutput20240813,
} from "../../generated/types.gen";

export type Booking = GetBookingsOutput20240813["data"][number];
export type BookingList = GetBookingsOutput20240813["data"];
export type BookingResponse = GetBookingOutput20240813["data"];
export type CreateBookingResponse = CreateBookingOutput20240813["data"];
export type RescheduleBookingResponse = RescheduleBookingOutput20240813["data"];
export type BookingStatus = "upcoming" | "past" | "cancelled" | "recurring" | "unconfirmed";
export type BookingRecordings = GetBookingRecordingsOutput["data"];
export type BookingTranscripts = GetBookingTranscriptsOutput["data"];
export type BookingReferences = BookingReferencesOutput20240813["data"];
export type CalendarLinks = CalendarLinksOutput20240813["data"];
export type VideoSessions = GetBookingVideoSessionsOutput["data"];

export type BookingActionResponse =
  | BookingsController20240813CancelBookingResponse
  | BookingsController20240813ConfirmBookingResponse
  | BookingsController20240813DeclineBookingResponse
  | BookingsController20240813ReassignBookingResponse
  | BookingsController20240813MarkNoShowResponse
  | BookingAttendeesController20240813AddAttendeeResponse
  | BookingGuestsController20240813AddGuestsResponse
  | BookingLocationController20240813UpdateBookingLocationResponse;
