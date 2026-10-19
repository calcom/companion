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

/** The API's largest page size for memberships. */
const MEMBERSHIPS_PAGE_SIZE = 250;

/**
 * Get a team's accepted members. Needs the team admin role (else 403) and the
 * TEAM_MEMBERSHIP_READ scope. Pages through `skip` until a short page, since one page caps at
 * 250 and a bigger team would otherwise lose hosts from the picker.
 */
export async function getTeamMembers(teamId: number): Promise<TeamMember[]> {
  const seen = new Set<number>();
  const members: TeamMember[] = [];
  for (let skip = 0; ; skip += MEMBERSHIPS_PAGE_SIZE) {
    const response = await makeRequest<MembershipsResponse>(
      `/teams/${teamId}/memberships?take=${MEMBERSHIPS_PAGE_SIZE}&skip=${skip}`,
      {},
      "2024-06-14"
    );
    const page = Array.isArray(response?.data) ? response.data : [];
    const fresh = page.filter((membership) => !seen.has(membership.userId));
    for (const membership of fresh) {
      seen.add(membership.userId);
      if (!membership.accepted) continue;
      members.push({
        userId: membership.userId,
        name: membership.user.name ?? "",
        username: membership.user.username ?? null,
        email: membership.user.email,
        avatarUrl: membership.user.avatarUrl ?? null,
      });
    }
    // A short page is the last. A full page with nobody new means `skip` wasn't honoured, so
    // stop rather than loop forever.
    if (page.length < MEMBERSHIPS_PAGE_SIZE || fresh.length === 0) return members;
  }
}
