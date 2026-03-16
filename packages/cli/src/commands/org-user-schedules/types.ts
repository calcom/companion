import type { GetScheduleOutput20240611, GetSchedulesOutput20240611 } from "../../generated/types.gen";

export type OrgUserSchedule = GetSchedulesOutput20240611["data"][number];
export type OrgUserScheduleDetail = GetScheduleOutput20240611["data"];
