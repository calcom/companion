/**
 * Query Hooks Index
 *
 * Central export point for all React Query hooks.
 * Import hooks from this file for clean imports:
 *
 * @example
 * ```tsx
 * import { useBookings, useEventTypes, useSchedules } from '../hooks';
 * ```
 */

// Re-export query keys for advanced use cases
export { queryKeys } from "@/config/cache.config";
// Re-export query context utilities
export { useQueryContext } from "@/contexts/QueryContext";
// UI State Management hooks
export {
  type BookingFilter,
  type BookingFilterOption,
  useActiveBookingFilter,
} from "./useActiveBookingFilter";
export { useBookingActionModals } from "./useBookingActionModals";
export { useBookingActions } from "./useBookingActions";
// Bookings hooks
export {
  type Booking,
  type BookingFilters,
  useBookingByUid,
  useBookings,
  useCancelBooking,
  useConfirmBooking,
  useDeclineBooking,
  useInvalidateBookings,
  usePrefetchBookings,
  useRescheduleBooking,
} from "./useBookings";
export {
  useApproveAllCalEventRegistrations,
  useCalEventMessages,
  useCalEventRoster,
  useDecideCalEventRegistration,
  useInviteCalEventGuests,
  useSendCalEventMessage,
} from "./useCalEventGuests";
// Cal Events hooks
export {
  type CalEvent,
  isForbiddenError,
  useAddCalEventLocation,
  useCalEvent,
  useCalEventCoHosts,
  useCalEventCoverImage,
  useCalEventLocations,
  useCalEvents,
  useCancelCalEvent,
  useChangeCalEventCoHosts,
  useCreateCalEvent,
  useDeleteCalEvent,
  useInvalidateCalEvents,
  usePublishCalEvent,
  useRemoveCalEventLocation,
  useRestartCalEvents,
  useUpdateCalEvent,
  useUpdateCalEventLocation,
  useUploadCalEventPersonAvatar,
} from "./useCalEvents";
// Event Types hooks
export {
  type CreateEventTypeInput,
  type EventType,
  useCreateEventType,
  useDeleteEventType,
  useDuplicateEventType,
  useEventTypeById,
  useEventTypes,
  useInvalidateEventTypes,
  usePrefetchEventTypes,
  useUpdateEventType,
} from "./useEventTypes";
// Schedules (Availability) hooks
export {
  type CreateScheduleInput,
  type Schedule,
  type UpdateScheduleInput,
  useCreateSchedule,
  useDeleteSchedule,
  useDuplicateSchedule,
  useInvalidateSchedules,
  usePrefetchSchedules,
  useScheduleById,
  useSchedules,
  useSetScheduleAsDefault,
  useUpdateSchedule,
} from "./useSchedules";
// Teams hooks
export { type Team, type TeamMember, useTeamMembers, useTeams } from "./useTeams";
// Toast hook
export { type ToastState, type ToastType, useToast } from "./useToast";
// User Preferences hooks
export {
  getRouteFromPreference,
  LANDING_PAGE_OPTIONS,
  type LandingPage,
  type LandingPageOption,
  type UserPreferences,
  useUserPreferences,
} from "./useUserPreferences";
// User Profile hooks
export {
  type UpdateUserProfileInput,
  type UserProfile,
  useInvalidateUserProfile,
  usePrefetchUserProfile,
  useUpdateUserProfile,
  useUsername,
  useUserProfile,
} from "./useUserProfile";
// Widget sync hook
export { useWidgetSync } from "./useWidgetSync";
