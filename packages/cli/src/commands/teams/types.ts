import type {
  BookingReference,
  BookingReferencesOutput20240813,
  CreateTeamMembershipOutput,
  CreateTeamOutput,
  GetTeamEventTypesOutput,
  GetTeamsOutput,
  OrgMeTeamsOutputResponseDto,
  OrgTeamOutputDto,
  TeamEventTypeOutput20240614,
  TeamMembershipOutput,
  TeamOutputDto,
  UpdateTeamMembershipOutput,
  UpdateTeamOutput,
} from "../../generated/types.gen";

export type Team = TeamOutputDto;
export type TeamList = GetTeamsOutput["data"];
export type TeamCreateResponse = CreateTeamOutput["data"];
export type TeamUpdateResponse = UpdateTeamOutput["data"];
export type TeamMembership = TeamMembershipOutput;
// Note: API spec incorrectly shows single object, but endpoint returns array
export type TeamMembershipList = TeamMembershipOutput[];
export type TeamMembershipCreateResponse = CreateTeamMembershipOutput["data"];
export type TeamMembershipUpdateResponse = UpdateTeamMembershipOutput["data"];

// Types for new org-scoped team endpoints
export type OrgTeam = OrgTeamOutputDto;
export type MyTeamsList = OrgMeTeamsOutputResponseDto["data"];
export type TeamEventType = TeamEventTypeOutput20240614;
export type TeamEventTypesList = GetTeamEventTypesOutput["data"];
export type BookingReferenceType = BookingReference;
export type BookingReferencesList = BookingReferencesOutput20240813["data"];

// Booking reference type filter values
export type BookingReferenceFilterType =
  | "google_calendar"
  | "office365_calendar"
  | "daily_video"
  | "google_video"
  | "office365_video"
  | "zoom_video";
