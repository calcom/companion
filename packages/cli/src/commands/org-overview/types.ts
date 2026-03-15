import type {
  GetSchedulesOutput20240611,
  ScheduleOutput20240611,
  UserOooOutputDto,
  UserOoosOutputResponseDto,
} from "../../generated/types.gen";

export type OrgOooEntry = UserOooOutputDto;
export type OrgOooListResponse = UserOoosOutputResponseDto;

export type OrgSchedule = ScheduleOutput20240611;
export type OrgSchedulesResponse = GetSchedulesOutput20240611;
