import type {
  GetBookingsOutput20240813,
  OrganizationsBookingsControllerGetAllOrgTeamBookingsResponse,
  OrganizationsUsersBookingsControllerGetOrganizationUserBookingsResponses,
} from "../../generated/types.gen";

export type OrgBooking = GetBookingsOutput20240813["data"][number];
export type OrgBookingList = GetBookingsOutput20240813["data"];
export type OrgBookingsResponse = OrganizationsBookingsControllerGetAllOrgTeamBookingsResponse;
export type OrgUserBookingsResponse = OrganizationsUsersBookingsControllerGetOrganizationUserBookingsResponses;
export type BookingStatus = "upcoming" | "past" | "cancelled" | "recurring" | "unconfirmed";
export type SortOrder = "asc" | "desc";
