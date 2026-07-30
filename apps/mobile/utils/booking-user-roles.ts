type BookingRoleSubject = {
  user?: {
    id: number;
    email?: string;
  };
  hosts?: Array<{
    id?: number | string;
    email?: string;
  }>;
};

/**
 * Check if the current user is the organizer of the booking.
 */
export function isUserOrganizer(
  booking: BookingRoleSubject,
  userId?: number,
  userEmail?: string
): boolean {
  if (!booking.user) return false;

  if (userId && booking.user.id === userId) return true;
  if (userEmail && booking.user.email?.toLowerCase() === userEmail.toLowerCase()) return true;

  return false;
}

/**
 * Check if the current user is a host of the booking.
 */
export function isUserHost(
  booking: BookingRoleSubject,
  userId?: number,
  userEmail?: string
): boolean {
  if (!booking.hosts || booking.hosts.length === 0) return false;

  return booking.hosts.some((host) => {
    if (userId && host.id !== undefined && String(host.id) === String(userId)) return true;
    if (userEmail && host.email?.toLowerCase() === userEmail.toLowerCase()) return true;
    return false;
  });
}
