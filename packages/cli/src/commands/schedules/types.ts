import type { GetScheduleOutput20240611, GetSchedulesOutput20240611 } from "../../generated/types.gen";

export type Schedule = GetSchedulesOutput20240611["data"][number];
export type ScheduleDetail = GetScheduleOutput20240611["data"];
