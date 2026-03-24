import type {
  CreateTeamEventTypeOutput,
  GetTeamEventTypeOutput,
  GetTeamEventTypesOutput,
  TeamEventTypeOutput20240614,
  UpdateTeamEventTypeOutput,
} from "../../generated/types.gen";

export type TeamEventType = TeamEventTypeOutput20240614;
export type TeamEventTypeList = GetTeamEventTypesOutput["data"];
export type TeamEventTypeGetResponse = GetTeamEventTypeOutput["data"];
export type TeamEventTypeCreateResponse = CreateTeamEventTypeOutput["data"];
export type TeamEventTypeUpdateResponse = UpdateTeamEventTypeOutput["data"];
