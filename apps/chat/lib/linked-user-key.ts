export function linkedUserKey(teamId: string, userId: string): string {
  return `calcom:user:${teamId}:${userId}`;
}
