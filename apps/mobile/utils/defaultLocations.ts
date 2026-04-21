/**
 * Default location types that are available alongside conferencing apps
 * These match the pattern from packages/app-store/locations.ts
 */

import { getCalAppUrl } from "./region";

export enum DefaultLocationType {
  AttendeeInPerson = "attendeeInPerson",
  InPerson = "inPerson",
  Phone = "phone",
  UserPhone = "userPhone",
  Link = "link",
  Conferencing = "conferencing",
  SomewhereElse = "somewhereElse",
}

export type DefaultLocation = {
  type: DefaultLocationType;
  label: string;
  iconUrl: string;
  category: "in person" | "conferencing" | "other" | "phone";
  organizerInputType?: "text" | "phone" | null;
  organizerInputPlaceholder?: string;
  organizerInputLabel?: string;
  messageForOrganizer?: string;
};

/**
 * Default locations available in Cal.com.
 *
 * Icons are served from `${getCalAppUrl()}/{iconPath}` so the URL follows the
 * user's currently-selected data region (US vs. EU). Consumers should call this
 * getter rather than caching the returned array across region changes.
 */
export function getDefaultLocations(): DefaultLocation[] {
  const appUrl = getCalAppUrl();
  return [
    {
      type: DefaultLocationType.AttendeeInPerson,
      label: "In Person (Attendee Address)",
      iconUrl: `${appUrl}/map-pin-dark.svg`,
      category: "in person",
    },
    {
      type: DefaultLocationType.SomewhereElse,
      label: "Custom Attendee Location",
      iconUrl: `${appUrl}/message-pin.svg`,
      category: "other",
    },
    {
      type: DefaultLocationType.InPerson,
      label: "In Person (Organizer Address)",
      iconUrl: `${appUrl}/map-pin-dark.svg`,
      category: "in person",
      organizerInputType: "text",
      organizerInputPlaceholder: "Enter address or place",
      organizerInputLabel: "Address",
      messageForOrganizer: "Provide an Address or Place",
    },
    {
      type: DefaultLocationType.Link,
      label: "Link Meeting",
      iconUrl: `${appUrl}/link.svg`,
      category: "other",
      organizerInputType: "text",
      organizerInputPlaceholder: "https://meet.example.com/join/123456",
      organizerInputLabel: "Meeting Link",
      messageForOrganizer: "Provide a Meeting Link",
    },
    {
      type: DefaultLocationType.Phone,
      label: "Attendee Phone Number",
      iconUrl: `${appUrl}/phone.svg`,
      category: "phone",
      organizerInputType: null,
      messageForOrganizer: "Cal will ask your invitee to enter a phone number before scheduling.",
    },
    {
      type: DefaultLocationType.UserPhone,
      label: "Phone Call",
      iconUrl: `${appUrl}/phone.svg`,
      category: "phone",
      organizerInputType: "phone",
      organizerInputPlaceholder: "Enter phone number",
      organizerInputLabel: "Phone Number",
      messageForOrganizer: "Provide your phone number with country code",
    },
  ];
}

/**
 * Get icon URL for a default location type
 */
export function getDefaultLocationIconUrl(locationType: string): string | null {
  const location = getDefaultLocations().find((loc) => loc.type === locationType);
  return location ? location.iconUrl : null;
}

/**
 * Check if a location type is a default location (not a conferencing app)
 */
export function isDefaultLocation(locationType: string): boolean {
  return getDefaultLocations().some((loc) => loc.type === locationType);
}
