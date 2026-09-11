# Booking notifications in chat

Implements the Companion side of [PRO-39](https://linear.app/calcom/issue/PRO-39/add-chat-push-delivery-endpoint-and-notify-commands) and [Cal.com PR #7210](https://github.com/calcom/cal/pull/7210).

After connecting Cal.com with `/cal link` in Slack or `/link` in Telegram, use `/cal notify on|off` or `/notify on|off`. Telegram only accepts notification commands in private chats. Enabling registers that verified chat identity; disabling removes that destination. Neither operation changes Cal.com's per-event preferences. Once a chat uses these commands, the legacy Cal.com webhook stops sending DMs there, including after opt-out. Existing shared-channel webhook notifications remain separate. Notifications follow those preferences for booking requested, confirmed, rescheduled, cancelled, rejected, location changed, and payment received. Hosts do not receive payment reminders.

## Configuration and activation

- `CALCOM_DELIVERY_SECRET` must match Cal.com's `CALCOM_CHAT_DELIVERY_SECRET`. An empty secret disables the receiver.
- `CALCOM_CHAT_LINK_SECRET` must match the same variable in Cal.com. Use a separate random secret for linking.
- Configure Cal.com's `CHAT_APP_URL` to the actual Companion deployment serving `/api/notifications/deliver`; do not assume an example hostname is deployed.
- Slack uses the existing encrypted workspace installation and its `chat:write` permission. No AI bot or agent initializes in the delivery route.
- Telegram requires its bot token and `TELEGRAM_WEBHOOK_SECRET_TOKEN`, configured both in Companion and on Telegram's webhook. Add `notify - Turn booking notifications on or off` in BotFather's command list.
- Use durable Redis with persistence and **no eviction**. Delivery claims must survive restarts and remain for eight days. Losing these keys can allow duplicate delivery. The in-memory Chat SDK adapter cannot provide this guarantee.
- Cal.com and Companion clocks must be synchronized: signatures allow five minutes of clock skew, while subscription generations are compared against the start of the local linking operation.

Keep Cal.com's chat feature flag off until both services and secrets are deployed. Test in a non-production environment with the flag enabled, then validate one Slack workspace and one Telegram DM, including opt-out and a repeated delivery. Resolve the separate Cal.com Trigger.dev OOM investigation before production activation. To roll back, disable the Cal.com flag and clear Companion's delivery secret. Existing bot conversations and mobile notifications are unaffected.

## Delivery contract

The endpoint accepts contract version 2. Cal.com signs `${timestamp}.${rawBody}` with HMAC-SHA256 and sends `x-cal-timestamp` and `x-cal-signature`. A shared-secret header alone is insufficient. Requests are limited to 128 KiB and 100 unique recipients, with four recipients processed concurrently and no new sends started after six seconds. Provider sends time out after four seconds and never retry internally.

Each destination includes its Cal.com user ID, subscription ID, subscription `updatedAt` as `linkedAt`, and Slack workspace when applicable. The signed sender supplies the subscription snapshot; Companion checks the current OAuth account, local opt-in state and OAuth generation, and rejects subscription generations older than the latest opt-in. Cal.com's link-completion API returns no subscription ID/version, so Companion does not invent or infer an exact version from that response. Cal.com remains responsible for checking that the subscription and event preferences are current before dispatch.

Linking first records a pending destination, creates a Cal.com OAuth-authenticated single-use intent, then completes it with a separately signed assertion of the platform-verified identity. Only a successful completion activates the local binding. Concurrent older commands cannot activate a newer command's binding. Pending delivery is retryable; opt-out and an OAuth account change fail closed. If linking fails, rerun the command. A message whose provider send has already begun cannot be recalled by opting out.

The response is `{ results: [...] }`, with `identifier`, Slack `teamId`, `outcome`, `success`, and `invalidIdentifier` for each destination. Outcomes are:

- `delivered`: provider acknowledged acceptance; replay returns the recorded result.
- `retryable`: no message was sent, or the provider explicitly rate-limited the attempt. Redis honors the retry delay.
- `invalid`: disconnected/relinked destination or definitive invalid-recipient response; Cal.com may remove the matching subscription generation.
- `unknown`: a send may have happened, the claimed process crashed, persistence failed after sending, or the same key arrived with a changed payload. Automatic resend is prohibited.

Claims atomically record `unknown` **before** the provider call and retain the outcome for eight days. Requests older than seven days are not delivered. Claims contain hashes and delivery state, not booking contents. Redis bindings retain account IDs, generation timestamps and opt-out state without expiry, so a legacy webhook cannot silently re-enable an opted-out chat; unlinking removes the account and generation fields while keeping an opt-out tombstone without Cal.com account fields. OAuth tokens remain in the existing encrypted linking store. Outgoing booking details go only to the selected Slack/Telegram destination, with plain-text rendering, disabled previews, and HTTPS buttons. Long content is truncated into one message rather than partially sending multiple messages.

## Tests

From the repository root:

```sh
bun run --filter @calcom/chat typecheck
bun run --filter @calcom/chat test:notifications
NOTIFICATION_TEST_REDIS_URL=redis://localhost:6379 LOG_LEVEL=silent bun run --filter @calcom/chat test:notifications
```

Use an isolated Redis database for the last command. CI runs both the contract tests and the real Redis/signed HTTP tests. Provider responses are simulated; live Slack and Telegram delivery is a deployment validation step.
