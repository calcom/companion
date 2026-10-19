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

/** An accepted member of a team, as the hosts picker lists them. */
export interface TeamMember {
  userId: number;
  name: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
}

type MembershipsResponse = {
  status: string;
  data: {
    userId: number;
    accepted: boolean;
    user: { name?: string; username?: string; email: string; avatarUrl?: string };
  }[];
};

/**
 * Get a team's accepted members. Needs the team admin role (else 403) and the
 * TEAM_MEMBERSHIP_READ scope.
 */
export async function getTeamMembers(teamId: number): Promise<TeamMember[]> {
  const response = await makeRequest<MembershipsResponse>(
    `/teams/${teamId}/memberships?take=250`,
    {},
    "2024-06-14"
  );
  return (Array.isArray(response?.data) ? response.data : [])
    .filter((membership) => membership.accepted)
    .map((membership) => ({
      userId: membership.userId,
      name: membership.user.name ?? "",
      username: membership.user.username ?? null,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl ?? null,
    }));
}
