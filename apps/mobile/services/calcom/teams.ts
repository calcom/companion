/**
 * Team functions for Cal.com API (`/v2/teams`)
 */

import type { Team } from "../types";

import { makeRequest } from "./request";

/**
 * Get the teams the authenticated user is a member of.
 */
export async function getTeams(): Promise<Team[]> {
  const response = await makeRequest<{ status: string; data: Team[] }>("/teams", {}, "2024-06-14");
  return Array.isArray(response?.data) ? response.data : [];
}
