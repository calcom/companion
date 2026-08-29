import { makeRequest } from "./request";

interface SlotsResponse {
  status?: string;
  data?: Record<string, Array<{ start: string }>> | Array<{ start: string }>;
}

export async function getAvailableSlots({
  eventTypeId,
  start,
  end,
  timeZone,
}: {
  eventTypeId: number;
  start: string;
  end: string;
  timeZone: string;
}): Promise<Record<string, Array<{ start: string }>>> {
  const params = new URLSearchParams({
    eventTypeId: String(eventTypeId),
    start,
    end,
    timeZone,
  });
  const response = await makeRequest<SlotsResponse | Array<{ start: string }>>(
    `/slots?${params.toString()}`,
    {
      headers: {
        "cal-api-version": "2024-09-04",
      },
    },
    "2024-09-04"
  );

  if (Array.isArray(response)) {
    return { slots: response };
  }
  if (response?.data && !Array.isArray(response.data)) {
    return response.data;
  }
  if (response?.data && Array.isArray(response.data)) {
    return { slots: response.data };
  }
  return {};
}
