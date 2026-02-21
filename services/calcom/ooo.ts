import type {
  CreateOutOfOfficeEntryInput,
  GetOutOfOfficeEntriesResponse,
  GetOutOfOfficeEntryResponse,
  OutOfOfficeEntry,
  UpdateOutOfOfficeEntryInput,
} from "../types/ooo.types";

import { makeRequest } from "./request";

export async function getOutOfOfficeEntries(filters?: {
  skip?: number;
  take?: number;
  sortStart?: "asc" | "desc";
  sortEnd?: "asc" | "desc";
}): Promise<OutOfOfficeEntry[]> {
  const params = new URLSearchParams();

  if (filters?.skip !== undefined) {
    params.append("skip", filters.skip.toString());
  }
  if (filters?.take !== undefined) {
    params.append("take", filters.take.toString());
  }
  if (filters?.sortStart) {
    params.append("sortStart", filters.sortStart);
  }
  if (filters?.sortEnd) {
    params.append("sortEnd", filters.sortEnd);
  }

  const queryString = params.toString();
  const endpoint = `/me/out-of-office${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await makeRequest<GetOutOfOfficeEntriesResponse>(endpoint, {
      headers: {
        "cal-api-version": "2024-08-13",
      },
    });

    if (response?.data) {
      return response.data;
    }

    return [];
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      console.warn("OOO endpoint not available - user-level API v2 endpoints needed");
      return [];
    }
    throw error;
  }
}

export async function createOutOfOfficeEntry(
  input: CreateOutOfOfficeEntryInput
): Promise<OutOfOfficeEntry> {
  const response = await makeRequest<GetOutOfOfficeEntryResponse>(
    "/me/out-of-office",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify(input),
    },
    "2024-08-13"
  );

  if (response?.data) {
    return response.data;
  }

  throw new Error("Invalid response from create OOO API");
}

export async function updateOutOfOfficeEntry(
  oooId: number,
  input: UpdateOutOfOfficeEntryInput
): Promise<OutOfOfficeEntry> {
  const response = await makeRequest<GetOutOfOfficeEntryResponse>(
    `/me/out-of-office/${oooId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify(input),
    },
    "2024-08-13"
  );

  if (response?.data) {
    return response.data;
  }

  throw new Error("Invalid response from update OOO API");
}

export async function deleteOutOfOfficeEntry(oooId: number): Promise<OutOfOfficeEntry> {
  const response = await makeRequest<GetOutOfOfficeEntryResponse>(
    `/me/out-of-office/${oooId}`,
    {
      method: "DELETE",
      headers: {
        "cal-api-version": "2024-08-13",
      },
    },
    "2024-08-13"
  );

  if (response?.data) {
    return response.data;
  }

  throw new Error("Invalid response from delete OOO API");
}
