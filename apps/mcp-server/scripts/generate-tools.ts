#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SPEC_PATH = resolve(ROOT, "openapi-v2.json");
const TOOLS_DIR = resolve(ROOT, "src", "tools");

interface OpenAPISpec {
  paths: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any> };
}

const DEPRECATED_TAGS = new Set([
  "Deprecated: Platform OAuth Clients",
  "Deprecated: Platform / Managed Users",
  "Deprecated: Platform / Webhooks",
]);

const SKIP = new Set([
  "GET /v2/bookings",
  "GET /v2/bookings/{bookingUid}",
  "POST /v2/bookings",
  "POST /v2/bookings/{bookingUid}/reschedule",
  "POST /v2/bookings/{bookingUid}/cancel",
  "POST /v2/bookings/{bookingUid}/confirm",
  "GET /v2/event-types",
  "GET /v2/event-types/{eventTypeId}",
  "POST /v2/event-types",
  "PATCH /v2/event-types/{eventTypeId}",
  "DELETE /v2/event-types/{eventTypeId}",
  "GET /v2/schedules",
  "GET /v2/schedules/{scheduleId}",
  "POST /v2/schedules",
  "PATCH /v2/schedules/{scheduleId}",
  "DELETE /v2/schedules/{scheduleId}",
  "GET /v2/slots",
  "GET /v2/calendars",
  "GET /v2/calendars/busy-times",
  "GET /v2/webhooks",
  "POST /v2/webhooks",
  "DELETE /v2/webhooks/{webhookId}",
  "GET /v2/me",
  "PATCH /v2/me",
  "GET /v2/conferencing/{app}/oauth/callback",
  "GET /v2/calendars/{calendar}/save",
  "GET /v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/oauth/callback",
  "GET /v2/organizations/{orgId}/teams/{teamId}/stripe/save",
]);

const EXISTING_FILES = new Set([
  "bookings",
  "calendars",
  "event-types",
  "schedules",
  "availability",
  "webhooks",
  "users",
]);

// Explicit endpoint -> tool name + file mapping
const MAP: Record<string, { t: string; f: string }> = {
  "POST /v2/api-keys/refresh": { t: "refresh_api_key", f: "api-keys" },
  "GET /v2/bookings/by-seat/{seatUid}": { t: "get_booking_by_seat", f: "bookings" },
  "GET /v2/bookings/{bookingUid}/attendees": { t: "get_booking_attendees", f: "bookings" },
  "POST /v2/bookings/{bookingUid}/attendees": { t: "add_booking_attendee", f: "bookings" },
  "GET /v2/bookings/{bookingUid}/attendees/{attendeeId}": { t: "get_booking_attendee", f: "bookings" },
  "GET /v2/bookings/{bookingUid}/calendar-links": { t: "get_booking_calendar_links", f: "bookings" },
  "GET /v2/bookings/{bookingUid}/conferencing-sessions": { t: "get_booking_conferencing_sessions", f: "bookings" },
  "POST /v2/bookings/{bookingUid}/decline": { t: "decline_booking", f: "bookings" },
  "POST /v2/bookings/{bookingUid}/guests": { t: "add_booking_guests", f: "bookings" },
  "PATCH /v2/bookings/{bookingUid}/location": { t: "update_booking_location", f: "bookings" },
  "POST /v2/bookings/{bookingUid}/mark-absent": { t: "mark_booking_absent", f: "bookings" },
  "POST /v2/bookings/{bookingUid}/reassign": { t: "reassign_booking", f: "bookings" },
  "POST /v2/bookings/{bookingUid}/reassign/{userId}": { t: "reassign_booking_to_user", f: "bookings" },
  "GET /v2/bookings/{bookingUid}/recordings": { t: "get_booking_recordings", f: "bookings" },
  "GET /v2/bookings/{bookingUid}/references": { t: "get_booking_references", f: "bookings" },
  "GET /v2/bookings/{bookingUid}/transcripts": { t: "get_booking_transcripts", f: "bookings" },
  "GET /v2/calendars/connections": { t: "get_calendar_connections", f: "calendars" },
  "GET /v2/calendars/connections/{connectionId}/events": { t: "get_connection_events", f: "calendars" },
  "POST /v2/calendars/connections/{connectionId}/events": { t: "create_connection_event", f: "calendars" },
  "GET /v2/calendars/connections/{connectionId}/events/{eventId}": { t: "get_connection_event", f: "calendars" },
  "PATCH /v2/calendars/connections/{connectionId}/events/{eventId}": { t: "update_connection_event", f: "calendars" },
  "DELETE /v2/calendars/connections/{connectionId}/events/{eventId}": { t: "delete_connection_event", f: "calendars" },
  "GET /v2/calendars/connections/{connectionId}/freebusy": { t: "get_connection_freebusy", f: "calendars" },
  "GET /v2/calendars/ics-feed/check": { t: "check_ics_feed", f: "calendars" },
  "POST /v2/calendars/ics-feed/save": { t: "save_ics_feed", f: "calendars" },
  "GET /v2/calendars/{calendar}/check": { t: "check_calendar_connection", f: "calendars" },
  "GET /v2/calendars/{calendar}/connect": { t: "get_calendar_connect_url", f: "calendars" },
  "POST /v2/calendars/{calendar}/credentials": { t: "save_calendar_credentials", f: "calendars" },
  "POST /v2/calendars/{calendar}/disconnect": { t: "disconnect_calendar", f: "calendars" },
  "GET /v2/calendars/{calendar}/event/{eventUid}": { t: "get_calendar_event", f: "calendars" },
  "PATCH /v2/calendars/{calendar}/event/{eventUid}": { t: "update_calendar_event", f: "calendars" },
  "GET /v2/calendars/{calendar}/events": { t: "list_calendar_events", f: "calendars" },
  "POST /v2/calendars/{calendar}/events": { t: "create_calendar_event", f: "calendars" },
  "GET /v2/calendars/{calendar}/events/{eventUid}": { t: "get_calendar_event_by_uid", f: "calendars" },
  "PATCH /v2/calendars/{calendar}/events/{eventUid}": { t: "update_calendar_event_by_uid", f: "calendars" },
  "DELETE /v2/calendars/{calendar}/events/{eventUid}": { t: "delete_calendar_event", f: "calendars" },
  "GET /v2/calendars/{calendar}/freebusy": { t: "get_calendar_freebusy", f: "calendars" },
  "GET /v2/conferencing": { t: "get_conferencing_apps", f: "conferencing" },
  "GET /v2/conferencing/default": { t: "get_default_conferencing", f: "conferencing" },
  "POST /v2/conferencing/{app}/connect": { t: "connect_conferencing_app", f: "conferencing" },
  "POST /v2/conferencing/{app}/default": { t: "set_default_conferencing", f: "conferencing" },
  "DELETE /v2/conferencing/{app}/disconnect": { t: "disconnect_conferencing_app", f: "conferencing" },
  "GET /v2/conferencing/{app}/oauth/auth-url": { t: "get_conferencing_auth_url", f: "conferencing" },
  "PUT /v2/destination-calendars": { t: "update_destination_calendars", f: "destination-calendars" },
  "POST /v2/event-types/{eventTypeId}/private-links": { t: "create_event_type_private_link", f: "event-types" },
  "GET /v2/event-types/{eventTypeId}/private-links": { t: "get_event_type_private_links", f: "event-types" },
  "PATCH /v2/event-types/{eventTypeId}/private-links/{linkId}": { t: "update_event_type_private_link", f: "event-types" },
  "DELETE /v2/event-types/{eventTypeId}/private-links/{linkId}": { t: "delete_event_type_private_link", f: "event-types" },
  "POST /v2/event-types/{eventTypeId}/webhooks": { t: "create_event_type_webhook", f: "event-types" },
  "GET /v2/event-types/{eventTypeId}/webhooks": { t: "get_event_type_webhooks", f: "event-types" },
  "DELETE /v2/event-types/{eventTypeId}/webhooks": { t: "delete_all_event_type_webhooks", f: "event-types" },
  "PATCH /v2/event-types/{eventTypeId}/webhooks/{webhookId}": { t: "update_event_type_webhook", f: "event-types" },
  "GET /v2/event-types/{eventTypeId}/webhooks/{webhookId}": { t: "get_event_type_webhook", f: "event-types" },
  "DELETE /v2/event-types/{eventTypeId}/webhooks/{webhookId}": { t: "delete_event_type_webhook", f: "event-types" },
  "GET /v2/auth/oauth2/clients/{clientId}": { t: "get_oauth_client", f: "oauth" },
  "POST /v2/auth/oauth2/token": { t: "exchange_oauth_token", f: "oauth" },
  "GET /v2/schedules/default": { t: "get_default_schedule", f: "schedules" },
  "POST /v2/selected-calendars": { t: "add_selected_calendar", f: "selected-calendars" },
  "DELETE /v2/selected-calendars": { t: "remove_selected_calendar", f: "selected-calendars" },
  "POST /v2/slots/reservations": { t: "reserve_slot", f: "availability" },
  "GET /v2/slots/reservations/{uid}": { t: "get_slot_reservation", f: "availability" },
  "PATCH /v2/slots/reservations/{uid}": { t: "update_slot_reservation", f: "availability" },
  "DELETE /v2/slots/reservations/{uid}": { t: "delete_slot_reservation", f: "availability" },
  "GET /v2/stripe/check": { t: "check_stripe_connection", f: "stripe" },
  "GET /v2/stripe/connect": { t: "get_stripe_connect_url", f: "stripe" },
  "GET /v2/stripe/save": { t: "save_stripe_credentials", f: "stripe" },
  "POST /v2/routing-forms/{routingFormId}/calculate-slots": { t: "calculate_routing_form_slots", f: "routing-forms" },
  "PATCH /v2/webhooks/{webhookId}": { t: "update_webhook", f: "webhooks" },
  "GET /v2/webhooks/{webhookId}": { t: "get_webhook", f: "webhooks" },
  "GET /v2/verified-resources/emails": { t: "get_verified_emails", f: "verified-resources" },
  "POST /v2/verified-resources/emails/verification-code/request": { t: "request_email_verification", f: "verified-resources" },
  "POST /v2/verified-resources/emails/verification-code/verify": { t: "verify_email", f: "verified-resources" },
  "GET /v2/verified-resources/emails/{id}": { t: "get_verified_email", f: "verified-resources" },
  "GET /v2/verified-resources/phones": { t: "get_verified_phones", f: "verified-resources" },
  "POST /v2/verified-resources/phones/verification-code/request": { t: "request_phone_verification", f: "verified-resources" },
  "POST /v2/verified-resources/phones/verification-code/verify": { t: "verify_phone", f: "verified-resources" },
  "GET /v2/verified-resources/phones/{id}": { t: "get_verified_phone", f: "verified-resources" },
  "POST /v2/teams": { t: "create_team", f: "teams" },
  "GET /v2/teams": { t: "get_teams", f: "teams" },
  "GET /v2/teams/{teamId}": { t: "get_team", f: "teams" },
  "PATCH /v2/teams/{teamId}": { t: "update_team", f: "teams" },
  "DELETE /v2/teams/{teamId}": { t: "delete_team", f: "teams" },
  "GET /v2/teams/{teamId}/bookings": { t: "get_team_bookings", f: "teams" },
  "POST /v2/teams/{teamId}/event-types": { t: "create_team_event_type", f: "teams" },
  "GET /v2/teams/{teamId}/event-types": { t: "get_team_event_types", f: "teams" },
  "GET /v2/teams/{teamId}/event-types/{eventTypeId}": { t: "get_team_event_type", f: "teams" },
  "PATCH /v2/teams/{teamId}/event-types/{eventTypeId}": { t: "update_team_event_type", f: "teams" },
  "DELETE /v2/teams/{teamId}/event-types/{eventTypeId}": { t: "delete_team_event_type", f: "teams" },
  "POST /v2/teams/{teamId}/event-types/{eventTypeId}/create-phone-call": { t: "create_team_phone_call", f: "teams" },
  "POST /v2/teams/{teamId}/event-types/{eventTypeId}/webhooks": { t: "create_team_event_type_webhook", f: "teams" },
  "GET /v2/teams/{teamId}/event-types/{eventTypeId}/webhooks": { t: "get_team_event_type_webhooks", f: "teams" },
  "DELETE /v2/teams/{teamId}/event-types/{eventTypeId}/webhooks": { t: "delete_all_team_event_type_webhooks", f: "teams" },
  "PATCH /v2/teams/{teamId}/event-types/{eventTypeId}/webhooks/{webhookId}": { t: "update_team_event_type_webhook", f: "teams" },
  "GET /v2/teams/{teamId}/event-types/{eventTypeId}/webhooks/{webhookId}": { t: "get_team_event_type_webhook", f: "teams" },
  "DELETE /v2/teams/{teamId}/event-types/{eventTypeId}/webhooks/{webhookId}": { t: "delete_team_event_type_webhook", f: "teams" },
  "POST /v2/teams/{teamId}/invite": { t: "create_team_invite", f: "teams" },
  "POST /v2/teams/{teamId}/memberships": { t: "create_team_membership", f: "teams" },
  "GET /v2/teams/{teamId}/memberships": { t: "get_team_memberships", f: "teams" },
  "GET /v2/teams/{teamId}/memberships/{membershipId}": { t: "get_team_membership", f: "teams" },
  "PATCH /v2/teams/{teamId}/memberships/{membershipId}": { t: "update_team_membership", f: "teams" },
  "DELETE /v2/teams/{teamId}/memberships/{membershipId}": { t: "delete_team_membership", f: "teams" },
  "GET /v2/teams/{teamId}/schedules": { t: "get_team_schedules", f: "teams" },
  "GET /v2/teams/{teamId}/verified-resources/emails": { t: "get_team_verified_emails", f: "teams" },
  "POST /v2/teams/{teamId}/verified-resources/emails/verification-code/request": { t: "request_team_email_verification", f: "teams" },
  "POST /v2/teams/{teamId}/verified-resources/emails/verification-code/verify": { t: "verify_team_email", f: "teams" },
  "GET /v2/teams/{teamId}/verified-resources/emails/{id}": { t: "get_team_verified_email", f: "teams" },
  "GET /v2/teams/{teamId}/verified-resources/phones": { t: "get_team_verified_phones", f: "teams" },
  "POST /v2/teams/{teamId}/verified-resources/phones/verification-code/request": { t: "request_team_phone_verification", f: "teams" },
  "POST /v2/teams/{teamId}/verified-resources/phones/verification-code/verify": { t: "verify_team_phone", f: "teams" },
  "GET /v2/teams/{teamId}/verified-resources/phones/{id}": { t: "get_team_verified_phone", f: "teams" },
  // Organizations
  "GET /v2/organizations/{orgId}/attributes": { t: "get_org_attributes", f: "organizations/attributes" },
  "POST /v2/organizations/{orgId}/attributes": { t: "create_org_attribute", f: "organizations/attributes" },
  "GET /v2/organizations/{orgId}/attributes/{attributeId}": { t: "get_org_attribute", f: "organizations/attributes" },
  "PATCH /v2/organizations/{orgId}/attributes/{attributeId}": { t: "update_org_attribute", f: "organizations/attributes" },
  "DELETE /v2/organizations/{orgId}/attributes/{attributeId}": { t: "delete_org_attribute", f: "organizations/attributes" },
  "POST /v2/organizations/{orgId}/attributes/options/{userId}": { t: "assign_org_attribute_to_user", f: "organizations/attributes" },
  "GET /v2/organizations/{orgId}/attributes/options/{userId}": { t: "get_org_user_attribute_options", f: "organizations/attributes" },
  "DELETE /v2/organizations/{orgId}/attributes/options/{userId}/{attributeOptionId}": { t: "unassign_org_attribute_from_user", f: "organizations/attributes" },
  "GET /v2/organizations/{orgId}/attributes/slugs/{attributeSlug}/options/assigned": { t: "get_org_attribute_options_by_slug", f: "organizations/attributes" },
  "POST /v2/organizations/{orgId}/attributes/{attributeId}/options": { t: "create_org_attribute_option", f: "organizations/attributes" },
  "GET /v2/organizations/{orgId}/attributes/{attributeId}/options": { t: "get_org_attribute_options", f: "organizations/attributes" },
  "GET /v2/organizations/{orgId}/attributes/{attributeId}/options/assigned": { t: "get_org_attribute_assigned_options", f: "organizations/attributes" },
  "DELETE /v2/organizations/{orgId}/attributes/{attributeId}/options/{optionId}": { t: "delete_org_attribute_option", f: "organizations/attributes" },
  "PATCH /v2/organizations/{orgId}/attributes/{attributeId}/options/{optionId}": { t: "update_org_attribute_option", f: "organizations/attributes" },
  "GET /v2/organizations/{orgId}/bookings": { t: "get_org_bookings", f: "organizations/bookings" },
  "POST /v2/organizations/{orgId}/delegation-credentials": { t: "create_org_delegation_credential", f: "organizations/delegation-credentials" },
  "PATCH /v2/organizations/{orgId}/delegation-credentials/{credentialId}": { t: "update_org_delegation_credential", f: "organizations/delegation-credentials" },
  "GET /v2/organizations/{orgId}/memberships": { t: "get_org_memberships", f: "organizations/memberships" },
  "POST /v2/organizations/{orgId}/memberships": { t: "create_org_membership", f: "organizations/memberships" },
  "GET /v2/organizations/{orgId}/memberships/{membershipId}": { t: "get_org_membership", f: "organizations/memberships" },
  "DELETE /v2/organizations/{orgId}/memberships/{membershipId}": { t: "delete_org_membership", f: "organizations/memberships" },
  "PATCH /v2/organizations/{orgId}/memberships/{membershipId}": { t: "update_org_membership", f: "organizations/memberships" },
  "POST /v2/organizations/{orgId}/organizations": { t: "create_managed_org", f: "organizations/managed-orgs" },
  "GET /v2/organizations/{orgId}/organizations": { t: "get_managed_orgs", f: "organizations/managed-orgs" },
  "GET /v2/organizations/{orgId}/organizations/{managedOrganizationId}": { t: "get_managed_org", f: "organizations/managed-orgs" },
  "PATCH /v2/organizations/{orgId}/organizations/{managedOrganizationId}": { t: "update_managed_org", f: "organizations/managed-orgs" },
  "DELETE /v2/organizations/{orgId}/organizations/{managedOrganizationId}": { t: "delete_managed_org", f: "organizations/managed-orgs" },
  "POST /v2/organizations/{orgId}/roles": { t: "create_org_role", f: "organizations/roles" },
  "GET /v2/organizations/{orgId}/roles": { t: "get_org_roles", f: "organizations/roles" },
  "GET /v2/organizations/{orgId}/roles/{roleId}": { t: "get_org_role", f: "organizations/roles" },
  "PATCH /v2/organizations/{orgId}/roles/{roleId}": { t: "update_org_role", f: "organizations/roles" },
  "DELETE /v2/organizations/{orgId}/roles/{roleId}": { t: "delete_org_role", f: "organizations/roles" },
  "POST /v2/organizations/{orgId}/roles/{roleId}/permissions": { t: "add_org_role_permissions", f: "organizations/roles" },
  "GET /v2/organizations/{orgId}/roles/{roleId}/permissions": { t: "get_org_role_permissions", f: "organizations/roles" },
  "PUT /v2/organizations/{orgId}/roles/{roleId}/permissions": { t: "replace_org_role_permissions", f: "organizations/roles" },
  "DELETE /v2/organizations/{orgId}/roles/{roleId}/permissions": { t: "remove_org_role_permissions", f: "organizations/roles" },
  "DELETE /v2/organizations/{orgId}/roles/{roleId}/permissions/{permission}": { t: "remove_org_role_permission", f: "organizations/roles" },
  "GET /v2/organizations/{orgId}/routing-forms": { t: "get_org_routing_forms", f: "organizations/routing-forms" },
  "GET /v2/organizations/{orgId}/routing-forms/{routingFormId}/responses": { t: "get_org_routing_form_responses", f: "organizations/routing-forms" },
  "POST /v2/organizations/{orgId}/routing-forms/{routingFormId}/responses": { t: "create_org_routing_form_response", f: "organizations/routing-forms" },
  "PATCH /v2/organizations/{orgId}/routing-forms/{routingFormId}/responses/{responseId}": { t: "update_org_routing_form_response", f: "organizations/routing-forms" },
  "GET /v2/organizations/{orgId}/schedules": { t: "get_org_schedules", f: "organizations/schedules" },
  "GET /v2/organizations/{orgId}/teams": { t: "get_org_teams", f: "organizations/teams" },
  "POST /v2/organizations/{orgId}/teams": { t: "create_org_team", f: "organizations/teams" },
  "GET /v2/organizations/{orgId}/teams/me": { t: "get_org_teams_membership", f: "organizations/teams" },
  "GET /v2/organizations/{orgId}/teams/event-types": { t: "get_org_all_team_event_types", f: "organizations/teams" },
  "GET /v2/organizations/{orgId}/teams/{teamId}": { t: "get_org_team", f: "organizations/teams" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}": { t: "delete_org_team", f: "organizations/teams" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}": { t: "update_org_team", f: "organizations/teams" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/bookings": { t: "get_org_team_bookings", f: "organizations/team-bookings" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/bookings/{bookingUid}/references": { t: "get_org_team_booking_references", f: "organizations/team-bookings" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/conferencing": { t: "get_org_team_conferencing_apps", f: "organizations/team-conferencing" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/conferencing/default": { t: "get_org_team_default_conferencing", f: "organizations/team-conferencing" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/connect": { t: "connect_org_team_conferencing_app", f: "organizations/team-conferencing" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/default": { t: "set_org_team_default_conferencing", f: "organizations/team-conferencing" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/disconnect": { t: "disconnect_org_team_conferencing_app", f: "organizations/team-conferencing" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/oauth/auth-url": { t: "get_org_team_conferencing_auth_url", f: "organizations/team-conferencing" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/event-types": { t: "create_org_team_event_type", f: "organizations/team-event-types" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/event-types": { t: "get_org_team_event_types", f: "organizations/team-event-types" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}": { t: "get_org_team_event_type", f: "organizations/team-event-types" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}": { t: "update_org_team_event_type", f: "organizations/team-event-types" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}": { t: "delete_org_team_event_type", f: "organizations/team-event-types" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/create-phone-call": { t: "create_org_team_phone_call", f: "organizations/team-event-types" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links": { t: "create_org_team_et_private_link", f: "organizations/team-event-types" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links": { t: "get_org_team_et_private_links", f: "organizations/team-event-types" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links/{linkId}": { t: "update_org_team_et_private_link", f: "organizations/team-event-types" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links/{linkId}": { t: "delete_org_team_et_private_link", f: "organizations/team-event-types" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/invite": { t: "create_org_team_invite", f: "organizations/team-invite" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/memberships": { t: "get_org_team_memberships", f: "organizations/team-memberships" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/memberships": { t: "create_org_team_membership", f: "organizations/team-memberships" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/memberships/{membershipId}": { t: "get_org_team_membership", f: "organizations/team-memberships" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/memberships/{membershipId}": { t: "delete_org_team_membership", f: "organizations/team-memberships" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}/memberships/{membershipId}": { t: "update_org_team_membership", f: "organizations/team-memberships" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/roles": { t: "create_org_team_role", f: "organizations/team-roles" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/roles": { t: "get_org_team_roles", f: "organizations/team-roles" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}": { t: "get_org_team_role", f: "organizations/team-roles" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}": { t: "update_org_team_role", f: "organizations/team-roles" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}": { t: "delete_org_team_role", f: "organizations/team-roles" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions": { t: "add_org_team_role_permissions", f: "organizations/team-roles" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions": { t: "get_org_team_role_permissions", f: "organizations/team-roles" },
  "PUT /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions": { t: "replace_org_team_role_permissions", f: "organizations/team-roles" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions": { t: "remove_org_team_role_permissions", f: "organizations/team-roles" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions/{permission}": { t: "remove_org_team_role_permission", f: "organizations/team-roles" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/routing-forms": { t: "get_org_team_routing_forms", f: "organizations/team-routing-forms" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/routing-forms/{routingFormId}/responses": { t: "get_org_team_routing_form_responses", f: "organizations/team-routing-forms" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/routing-forms/{routingFormId}/responses": { t: "create_org_team_routing_form_response", f: "organizations/team-routing-forms" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}/routing-forms/{routingFormId}/responses/{responseId}": { t: "update_org_team_routing_form_response", f: "organizations/team-routing-forms" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/schedules": { t: "get_org_team_schedules", f: "organizations/team-schedules" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/users/{userId}/schedules": { t: "get_org_team_user_schedules", f: "organizations/team-schedules" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/stripe/check": { t: "check_org_team_stripe", f: "organizations/team-stripe" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/stripe/connect": { t: "get_org_team_stripe_connect_url", f: "organizations/team-stripe" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails": { t: "get_org_team_verified_emails", f: "organizations/team-verified-resources" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails/verification-code/request": { t: "request_org_team_email_verification", f: "organizations/team-verified-resources" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails/verification-code/verify": { t: "verify_org_team_email", f: "organizations/team-verified-resources" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails/{id}": { t: "get_org_team_verified_email", f: "organizations/team-verified-resources" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones": { t: "get_org_team_verified_phones", f: "organizations/team-verified-resources" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones/verification-code/request": { t: "request_org_team_phone_verification", f: "organizations/team-verified-resources" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones/verification-code/verify": { t: "verify_org_team_phone", f: "organizations/team-verified-resources" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones/{id}": { t: "get_org_team_verified_phone", f: "organizations/team-verified-resources" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/workflows": { t: "get_org_team_workflows", f: "organizations/team-workflows" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/workflows": { t: "create_org_team_workflow", f: "organizations/team-workflows" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/workflows/routing-form": { t: "get_org_team_rf_workflows", f: "organizations/team-workflows" },
  "POST /v2/organizations/{orgId}/teams/{teamId}/workflows/routing-form": { t: "create_org_team_rf_workflow", f: "organizations/team-workflows" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}": { t: "get_org_team_workflow", f: "organizations/team-workflows" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}": { t: "update_org_team_workflow", f: "organizations/team-workflows" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}": { t: "delete_org_team_workflow", f: "organizations/team-workflows" },
  "GET /v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}/routing-form": { t: "get_org_team_rf_workflow", f: "organizations/team-workflows" },
  "PATCH /v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}/routing-form": { t: "update_org_team_rf_workflow", f: "organizations/team-workflows" },
  "DELETE /v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}/routing-form": { t: "delete_org_team_rf_workflow", f: "organizations/team-workflows" },
  "GET /v2/organizations/{orgId}/users": { t: "get_org_users", f: "organizations/users" },
  "POST /v2/organizations/{orgId}/users": { t: "create_org_user", f: "organizations/users" },
  "PATCH /v2/organizations/{orgId}/users/{userId}": { t: "update_org_user", f: "organizations/users" },
  "DELETE /v2/organizations/{orgId}/users/{userId}": { t: "delete_org_user", f: "organizations/users" },
  "GET /v2/organizations/{orgId}/users/{userId}/bookings": { t: "get_org_user_bookings", f: "organizations/user-bookings" },
  "GET /v2/organizations/{orgId}/ooo": { t: "get_org_ooo", f: "organizations/user-ooo" },
  "GET /v2/organizations/{orgId}/users/{userId}/ooo": { t: "get_org_user_ooo", f: "organizations/user-ooo" },
  "POST /v2/organizations/{orgId}/users/{userId}/ooo": { t: "create_org_user_ooo", f: "organizations/user-ooo" },
  "PATCH /v2/organizations/{orgId}/users/{userId}/ooo/{oooId}": { t: "update_org_user_ooo", f: "organizations/user-ooo" },
  "DELETE /v2/organizations/{orgId}/users/{userId}/ooo/{oooId}": { t: "delete_org_user_ooo", f: "organizations/user-ooo" },
  "POST /v2/organizations/{orgId}/users/{userId}/schedules": { t: "create_org_user_schedule", f: "organizations/user-schedules" },
  "GET /v2/organizations/{orgId}/users/{userId}/schedules": { t: "get_org_user_schedules", f: "organizations/user-schedules" },
  "GET /v2/organizations/{orgId}/users/{userId}/schedules/{scheduleId}": { t: "get_org_user_schedule", f: "organizations/user-schedules" },
  "PATCH /v2/organizations/{orgId}/users/{userId}/schedules/{scheduleId}": { t: "update_org_user_schedule", f: "organizations/user-schedules" },
  "DELETE /v2/organizations/{orgId}/users/{userId}/schedules/{scheduleId}": { t: "delete_org_user_schedule", f: "organizations/user-schedules" },
  "GET /v2/organizations/{orgId}/webhooks": { t: "get_org_webhooks", f: "organizations/webhooks" },
  "POST /v2/organizations/{orgId}/webhooks": { t: "create_org_webhook", f: "organizations/webhooks" },
  "GET /v2/organizations/{orgId}/webhooks/{webhookId}": { t: "get_org_webhook", f: "organizations/webhooks" },
  "DELETE /v2/organizations/{orgId}/webhooks/{webhookId}": { t: "delete_org_webhook", f: "organizations/webhooks" },
  "PATCH /v2/organizations/{orgId}/webhooks/{webhookId}": { t: "update_org_webhook", f: "organizations/webhooks" },
};

// ── Helpers ───────────────────────────────────────────────
function resolveRef(spec: OpenAPISpec, ref: string): any {
  const parts = ref.replace("#/", "").split("/");
  let c: any = spec;
  for (const p of parts) c = c?.[p];
  return c || { type: "object" };
}

function flat(spec: OpenAPISpec, s: any): any {
  if (!s) return { type: "object" };
  if (s.$ref) return flat(spec, resolveRef(spec, s.$ref));
  if (s.allOf) {
    const m: any = { type: "object", properties: {}, required: [] };
    for (const sub of s.allOf) {
      const f = flat(spec, sub);
      Object.assign(m.properties, f.properties || {});
      m.required.push(...(f.required || []));
    }
    return m;
  }
  if (s.oneOf || s.anyOf) {
    const v = s.oneOf || s.anyOf;
    if (v.length > 0) return flat(spec, v[0]);
  }
  return s;
}

function cc(s: string): string {
  return s.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
}

function fnName(t: string): string {
  return t
    .split("_")
    .map((w: string, i: number) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("");
}

function esc(d: string): string {
  return d
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .trim()
    .slice(0, 200);
}

function pathParams(path: string): string[] {
  return (path.match(/\{([^}]+)\}/g) || []).map((m: string) => m.slice(1, -1));
}

function apiPath(path: string): string {
  const a = path.replace(/^\/v2\//, "");
  const ps = pathParams(path);
  if (ps.length === 0) return `"${a}"`;
  let e = a;
  for (const p of ps) e = e.replace(`{${p}}`, `\${params.${cc(p)}}`);
  return `\`${e}\``;
}

function zodType(spec: OpenAPISpec, s: any, d?: string): string {
  const f2 = flat(spec, s);
  let r = "";
  if (f2.enum) {
    r = `z.enum([${f2.enum.map((v: any) => (typeof v === "string" ? `"${v}"` : String(v))).join(", ")}])`;
  } else if (f2.type === "string") {
    r = "z.string()";
    if (f2.format === "email") r = "z.string().email()";
    if (f2.format === "uri" || f2.format === "url") r = "z.string().url()";
  } else if (f2.type === "integer") {
    r = "z.number().int()";
  } else if (f2.type === "number") {
    r = "z.number()";
  } else if (f2.type === "boolean") {
    r = "z.boolean()";
  } else if (f2.type === "array") {
    r = `z.array(${f2.items ? zodType(spec, f2.items) : "z.unknown()"})`;
  } else if (f2.type === "object" && f2.properties) {
    const ps2 = Object.entries(f2.properties).map(([k, v]: any) => {
      const fv = flat(spec, v);
      const pz = zodType(spec, fv);
      const ir = f2.required?.includes(k);
      const dd = fv.description ? `.describe("${esc(fv.description)}")` : "";
      return `    ${k}: ${pz}${ir ? "" : ".optional()"}${dd}`;
    });
    r = `z.object({\n${ps2.join(",\n")},\n  })`;
  } else {
    r = "z.record(z.unknown())";
  }
  if (d && !r.includes(".describe(")) r += `.describe("${esc(d)}")`;
  return r;
}

function tsType(spec: OpenAPISpec, s: any): string {
  const f2 = flat(spec, s);
  if (f2.enum) return f2.enum.map((v: any) => (typeof v === "string" ? `"${v}"` : String(v))).join(" | ");
  if (f2.type === "string") return "string";
  if (f2.type === "integer" || f2.type === "number") return "number";
  if (f2.type === "boolean") return "boolean";
  if (f2.type === "array") return `${f2.items ? tsType(spec, f2.items) : "unknown"}[]`;
  if (f2.type === "object" && f2.properties) {
    const ps2 = Object.entries(f2.properties).map(([k, v]: any) => {
      const ir = f2.required?.includes(k);
      return `${k}${ir ? "" : "?"}: ${tsType(spec, v)}`;
    });
    return `{ ${ps2.join("; ")} }`;
  }
  return "Record<string, unknown>";
}

interface ToolInfo {
  toolName: string;
  funcName: string;
  schemaName: string;
  method: string;
  path: string;
  summary: string;
  file: string;
  pathParams: { name: string; camel: string; type: string }[];
  queryParams: { name: string; camel: string; required: boolean; schema: any; desc: string }[];
  bodyProps: { name: string; required: boolean; schema: any; desc: string }[];
}

function extract(spec: OpenAPISpec): ToolInfo[] {
  const tools: ToolInfo[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [ml, op] of Object.entries(methods as Record<string, any>)) {
      const method = ml.toUpperCase();
      const key = `${method} ${path}`;
      if (SKIP.has(key)) continue;
      if (op.tags?.some((t: string) => DEPRECATED_TAGS.has(t))) continue;
      const def = MAP[key];
      if (!def) {
        console.warn(`UNMAPPED: ${key}`);
        continue;
      }
      const pps = pathParams(path).map((name: string) => {
        const pd = (op.parameters || []).find((p: any) => p.in === "path" && p.name === name);
        const type = pd?.schema?.type === "integer" || pd?.schema?.type === "number" ? "number" : "string";
        return { name, camel: cc(name), type };
      });
      const qps: ToolInfo["queryParams"] = [];
      for (const p of op.parameters || []) {
        if (p.in === "query") {
          qps.push({
            name: p.name,
            camel: cc(p.name),
            required: p.required || false,
            schema: p.schema || { type: "string" },
            desc: p.description || "",
          });
        }
      }
      let bps: ToolInfo["bodyProps"] = [];
      if (op.requestBody?.content?.["application/json"]?.schema) {
        const bs = flat(spec, op.requestBody.content["application/json"].schema);
        if (bs.properties) {
          bps = Object.entries(bs.properties).map(([n, s]: any) => ({
            name: n,
            required: bs.required?.includes(n) || false,
            schema: flat(spec, s),
            desc: s.description || "",
          }));
        }
      }
      tools.push({
        toolName: def.t,
        funcName: fnName(def.t),
        schemaName: `${fnName(def.t)}Schema`,
        method,
        path,
        summary: op.summary || "",
        file: def.f,
        pathParams: pps,
        queryParams: qps,
        bodyProps: bps,
      });
    }
  }
  return tools;
}

function genTool(spec: OpenAPISpec, t: ToolInfo): string {
  let c = "";
  const sfs: string[] = [];
  for (const p of t.pathParams) {
    sfs.push(`  ${p.camel}: ${p.type === "number" ? "z.number().int()" : "z.string()"}.describe("${p.name}"),`);
  }
  for (const p of t.queryParams) {
    let zz = zodType(spec, p.schema, p.desc);
    if (!p.required && !zz.includes(".optional()")) zz += ".optional()";
    if (p.desc && !zz.includes(".describe(")) zz += `.describe("${esc(p.desc)}")`;
    sfs.push(`  ${p.camel}: ${zz},`);
  }
  for (const p of t.bodyProps) {
    let zz = zodType(spec, p.schema, p.desc);
    if (!p.required && !zz.includes(".optional()")) zz += ".optional()";
    if (p.desc && !zz.includes(".describe(")) zz += `.describe("${esc(p.desc)}")`;
    sfs.push(`  ${p.name}: ${zz},`);
  }

  if (sfs.length === 0) {
    c += `export const ${t.schemaName} = {};\n\n`;
  } else {
    c += `export const ${t.schemaName} = {\n${sfs.join("\n")}\n};\n\n`;
  }

  const tps: string[] = [];
  for (const p of t.pathParams) tps.push(`${p.camel}: ${p.type}`);
  for (const p of t.queryParams) tps.push(`${p.camel}${p.required ? "" : "?"}: ${tsType(spec, p.schema)}`);
  for (const p of t.bodyProps) tps.push(`${p.name}${p.required ? "" : "?"}: ${tsType(spec, p.schema)}`);

  const hp = tps.length > 0;
  c += hp
    ? `export async function ${t.funcName}(params: {\n  ${tps.join(";\n  ")};\n}) {\n`
    : `export async function ${t.funcName}() {\n`;

  c += "  try {\n";
  const apath = apiPath(t.path);

  if (t.method === "GET" || (t.method === "DELETE" && t.queryParams.length > 0)) {
    if (t.queryParams.length > 0) {
      c += "    const qp: Record<string, string | number | boolean | undefined> = {};\n";
      for (const p of t.queryParams) {
        c += p.required
          ? `    qp["${p.name}"] = params.${p.camel};\n`
          : `    if (params.${p.camel} !== undefined) qp["${p.name}"] = params.${p.camel};\n`;
      }
      c += `    const data = await calApi(${apath}${t.method === "DELETE" ? ', { method: "DELETE", params: qp }' : ", { params: qp }"});\n`;
    } else {
      c += `    const data = await calApi(${apath});\n`;
    }
  } else if (t.method === "DELETE") {
    c += `    const data = await calApi(${apath}, { method: "DELETE" });\n`;
  } else {
    if (t.bodyProps.length > 0) {
      c += "    const body: Record<string, unknown> = {};\n";
      for (const p of t.bodyProps) {
        c += p.required
          ? `    body.${p.name} = params.${p.name};\n`
          : `    if (params.${p.name} !== undefined) body.${p.name} = params.${p.name};\n`;
      }
      c += `    const data = await calApi(${apath}, { method: "${t.method}", body });\n`;
    } else {
      c += `    const data = await calApi(${apath}, { method: "${t.method}", body: {} });\n`;
    }
  }

  c += "    return ok(data);\n  } catch (err) {\n";
  c += `    return handleError("${t.toolName}", err);\n  }\n}\n`;
  return c;
}

function fileHeader(file: string): string {
  const ip = file.startsWith("organizations/") ? "../../utils" : "../utils";
  return `import { z } from "zod";
import { calApi } from "${ip}/api-client.js";
import { CalApiError } from "${ip}/errors.js";

function handleError(
  tag: string,
  err: unknown
): { content: { type: "text"; text: string }[]; isError: true } {
  if (err instanceof CalApiError) {
    console.error(\`[\${tag}] \${err.status}: \${err.message}\`);
    return {
      content: [{ type: "text", text: \`Error \${err.status}: \${err.message}\` }],
      isError: true,
    };
  }
  throw err;
}

function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
`;
}

function genTest(tools: ToolInfo[], file: string): string {
  const ip = file.startsWith("organizations/") ? "../../utils" : "../utils";
  const bn = file.includes("/") ? file.split("/").pop()! : file;
  const imps = tools.flatMap((t: ToolInfo) => [t.funcName, t.schemaName]);

  let c = `import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "${ip}/errors.js";

vi.mock("${ip}/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "${ip}/api-client.js";
import {
  ${imps.join(",\n  ")},
} from "./${bn}.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });
`;

  for (const t of tools) {
    const sp: Record<string, unknown> = {};
    for (const p of t.pathParams) sp[p.camel] = p.type === "number" ? 1 : "test-id";
    for (const p of t.queryParams) {
      if (p.required) sp[p.camel] = "test";
    }
    for (const p of t.bodyProps) {
      if (p.required) {
        const tp = p.schema.type;
        sp[p.name] =
          tp === "integer" || tp === "number" ? 1 : tp === "boolean" ? true : tp === "array" ? [] : tp === "object" ? {} : "test";
      }
    }
    const ps = Object.keys(sp).length > 0 ? JSON.stringify(sp) : "";

    c += `
describe("${t.funcName}", () => {
  it("exports ${t.schemaName}", () => { expect(${t.schemaName}).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await ${t.funcName}(${ps});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await ${t.funcName}(${ps});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
`;
  }
  return c;
}

// ── Main ─────────────────────────────────────────────────
const spec: OpenAPISpec = JSON.parse(readFileSync(SPEC_PATH, "utf-8"));
const tools = extract(spec);

// Group by file
const byFile: Record<string, ToolInfo[]> = {};
for (const t of tools) {
  if (!byFile[t.file]) byFile[t.file] = [];
  byFile[t.file].push(t);
}

// Check for duplicates
const names = new Set<string>();
for (const t of tools) {
  if (names.has(t.toolName)) {
    console.error(`DUPLICATE: ${t.toolName}`);
    process.exit(1);
  }
  names.add(t.toolName);
}

// Generate files
for (const [file, ft] of Object.entries(byFile)) {
  const isEx = EXISTING_FILES.has(file);
  const fp = resolve(TOOLS_DIR, `${file}.ts`);
  const tp = resolve(TOOLS_DIR, `${file}.test.ts`);
  mkdirSync(dirname(fp), { recursive: true });

  if (isEx) {
    // Append to existing files
    const ex = readFileSync(fp, "utf-8");
    let app = "\n// ── New tools (generated) ──\n";
    for (const t of ft) app += "\n" + genTool(spec, t);
    writeFileSync(fp, ex + app, "utf-8");

    // Append tests
    const exT = readFileSync(tp, "utf-8");
    const ni = ft.flatMap((t: ToolInfo) => [t.funcName, t.schemaName]);
    let at = `\n// ── Tests for new tools ──\nimport {\n  ${ni.join(",\n  ")},\n} from "./${file}.js";\n`;
    for (const t of ft) {
      const sp: Record<string, unknown> = {};
      for (const p of t.pathParams) sp[p.camel] = p.type === "number" ? 1 : "test-id";
      for (const p of t.queryParams) {
        if (p.required) sp[p.camel] = "test";
      }
      for (const p of t.bodyProps) {
        if (p.required) {
          const tp2 = p.schema.type;
          sp[p.name] =
            tp2 === "integer" || tp2 === "number" ? 1 : tp2 === "boolean" ? true : tp2 === "array" ? [] : tp2 === "object" ? {} : "test";
        }
      }
      const ps = Object.keys(sp).length > 0 ? JSON.stringify(sp) : "";
      at += `
describe("${t.funcName}", () => {
  it("exports ${t.schemaName}", () => { expect(${t.schemaName}).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await ${t.funcName}(${ps});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await ${t.funcName}(${ps});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
`;
    }
    writeFileSync(tp, exT + at, "utf-8");
  } else {
    // Create new files
    let code = fileHeader(file);
    for (const t of ft) code += "\n" + genTool(spec, t);
    writeFileSync(fp, code, "utf-8");
    writeFileSync(tp, genTest(ft, file), "utf-8");
  }
  console.log(`${isEx ? "Extended" : "Created"} ${file}.ts (${ft.length} tools)`);
}

// Organizations barrel export
const orgFiles = Object.keys(byFile).filter((f: string) => f.startsWith("organizations/"));
if (orgFiles.length > 0) {
  const barrel = orgFiles
    .map((f: string) => `export * from "./${f.replace("organizations/", "")}.js";`)
    .join("\n") + "\n";
  writeFileSync(resolve(TOOLS_DIR, "organizations", "index.ts"), barrel, "utf-8");
  console.log("Created organizations/index.ts");
}

// Print import/registration code for index.ts
console.log("\n// ── IMPORTS for index.ts ──");
const importsBySource: Record<string, string[]> = {};
for (const t of tools) {
  const src = t.file.startsWith("organizations/")
    ? "./tools/organizations/index.js"
    : `./tools/${t.file}.js`;
  if (!importsBySource[src]) importsBySource[src] = [];
  importsBySource[src].push(t.schemaName, t.funcName);
}
for (const [src, ims] of Object.entries(importsBySource)) {
  console.log(`import {\n  ${ims.join(",\n  ")},\n} from "${src}";`);
}

console.log("\n// ── REGISTRATIONS for index.ts ──");
for (const t of tools) {
  console.log(`  server.tool("${t.toolName}", "${esc(t.summary)}", ${t.schemaName}, ${t.funcName});`);
}

console.log(`\nTotal: ${tools.length} new tools generated`);
