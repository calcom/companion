type CurrentUser = {
  id?: string | number;
  email?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractCurrentUser(data: unknown): CurrentUser | undefined {
  const user = isRecord(data) && isRecord(data.data) ? data.data : data;
  if (!isRecord(user)) return undefined;

  const id = typeof user.id === "string" || typeof user.id === "number" ? user.id : undefined;
  const email = typeof user.email === "string" ? user.email : undefined;

  return id !== undefined || email !== undefined ? { id, email } : undefined;
}

function idEq(a: unknown, b: unknown): boolean {
  return a !== undefined && b !== undefined && String(a) === String(b);
}

function emailEq(a: unknown, b: string | undefined): boolean {
  return typeof a === "string" && b !== undefined && a.toLowerCase() === b.toLowerCase();
}

function isPersonMatch(person: unknown, currentUser: CurrentUser): boolean {
  if (!isRecord(person)) return false;

  return idEq(person.id, currentUser.id) || emailEq(person.email, currentUser.email);
}

function isParticipatingBooking(booking: unknown, currentUser: CurrentUser): boolean {
  if (!isRecord(booking)) return false;

  const isOrganizer =
    isPersonMatch(booking.user, currentUser) || isPersonMatch(booking.organizer, currentUser);
  const isHost =
    Array.isArray(booking.hosts) && booking.hosts.some((host) => isPersonMatch(host, currentUser));
  const isAttendee =
    Array.isArray(booking.attendees) &&
    booking.attendees.some((attendee) => isPersonMatch(attendee, currentUser));

  return isOrganizer || isHost || isAttendee;
}

function filterBookingsArray(bookings: unknown[], currentUser: CurrentUser): unknown[] {
  return bookings.filter((booking) => isParticipatingBooking(booking, currentUser));
}

export function filterBookingsForCurrentUser(data: unknown, currentUser: CurrentUser | undefined): unknown {
  if (!currentUser) return data;

  if (Array.isArray(data)) {
    return filterBookingsArray(data, currentUser);
  }

  if (!isRecord(data)) return data;

  if (Array.isArray(data.bookings)) {
    return { ...data, bookings: filterBookingsArray(data.bookings, currentUser) };
  }

  if (Array.isArray(data.items)) {
    return { ...data, items: filterBookingsArray(data.items, currentUser) };
  }

  if (Array.isArray(data.data)) {
    return { ...data, data: filterBookingsArray(data.data, currentUser) };
  }

  if (isRecord(data.data)) {
    if (Array.isArray(data.data.bookings)) {
      return {
        ...data,
        data: { ...data.data, bookings: filterBookingsArray(data.data.bookings, currentUser) },
      };
    }

    if (Array.isArray(data.data.items)) {
      return {
        ...data,
        data: { ...data.data, items: filterBookingsArray(data.data.items, currentUser) },
      };
    }
  }

  return data;
}
