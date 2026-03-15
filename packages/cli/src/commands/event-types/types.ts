import type {
  CreateEventTypeOutput20240614,
  DeleteEventTypeOutput20240614,
  GetEventTypeOutput20240614,
  GetEventTypesOutput20240614,
  UpdateEventTypeOutput20240614,
} from "../../generated/types.gen";

// List endpoint returns only user event types
export type EventType = GetEventTypesOutput20240614["data"][number];
export type EventTypeList = GetEventTypesOutput20240614["data"];

// Get-by-ID can return user OR team event types
export type EventTypeResponse = GetEventTypeOutput20240614["data"];
export type CreateEventTypeResponse = CreateEventTypeOutput20240614["data"];
export type UpdateEventTypeResponse = UpdateEventTypeOutput20240614["data"];
export type DeleteEventTypeResponse = DeleteEventTypeOutput20240614["data"];
