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
}): Promise<Array<{ start: string }>> {
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
    return response;
  }
  if (response?.data && !Array.isArray(response.data)) {
    return Object.values(response.data).flat();
  }
  if (response?.data && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}
