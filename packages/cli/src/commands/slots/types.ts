import type {
  GetReservedSlotOutput20240904,
  ReserveSlotOutput20240904,
  SlotsController20240904GetAvailableSlotsResponse,
} from "../../generated/types.gen";

export type ReservedSlot = ReserveSlotOutput20240904;
export type GetReservedSlotResponse = GetReservedSlotOutput20240904["data"];

export type SlotsData = SlotsController20240904GetAvailableSlotsResponse;
