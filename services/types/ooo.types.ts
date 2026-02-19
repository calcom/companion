export type OutOfOfficeReason = "unspecified" | "vacation" | "travel" | "sick" | "public_holiday";

export interface OutOfOfficeEntry {
  id: number;
  uuid: string;
  userId: number;
  start: string;
  end: string;
  notes?: string;
  reason?: OutOfOfficeReason;
  toUserId?: number;
  toUser?: {
    id: number;
    username?: string;
    name?: string;
    email?: string;
  };
}

export interface GetOutOfOfficeEntriesResponse {
  status: "success" | "error";
  data: OutOfOfficeEntry[];
}

export interface GetOutOfOfficeEntryResponse {
  status: "success" | "error";
  data: OutOfOfficeEntry;
}

export interface CreateOutOfOfficeEntryInput {
  start: string;
  end: string;
  notes?: string;
  reason?: OutOfOfficeReason;
  toUserId?: number;
}

export interface UpdateOutOfOfficeEntryInput {
  start?: string;
  end?: string;
  notes?: string;
  reason?: OutOfOfficeReason;
  toUserId?: number;
}
