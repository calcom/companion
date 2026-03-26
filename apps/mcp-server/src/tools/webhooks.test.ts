import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getWebhooks,
  createWebhook,
  deleteWebhook,
  getWebhooksSchema,
  createWebhookSchema,
  deleteWebhookSchema,
} from "./webhooks.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("webhooks schemas", () => {
  it("exports empty getWebhooksSchema", () => {
    expect(getWebhooksSchema).toEqual({});
  });

  it("exports createWebhookSchema with required fields", () => {
    expect(createWebhookSchema.subscriberUrl).toBeDefined();
    expect(createWebhookSchema.triggers).toBeDefined();
  });

  it("has optional active and payloadTemplate", () => {
    expect(createWebhookSchema.active).toBeDefined();
    expect(createWebhookSchema.payloadTemplate).toBeDefined();
  });

  it("exports deleteWebhookSchema", () => {
    expect(deleteWebhookSchema.webhookId).toBeDefined();
  });
});

describe("getWebhooks", () => {
  it("returns list of webhooks", async () => {
    mockCalApi.mockResolvedValueOnce({ webhooks: [{ id: "wh-1" }] });

    const result = await getWebhooks();

    expect(mockCalApi).toHaveBeenCalledWith("webhooks");
    expect(JSON.parse(result.content[0].text)).toHaveProperty("webhooks");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));

    const result = await getWebhooks();

    expect(result).toHaveProperty("isError", true);
  });
});

describe("createWebhook", () => {
  it("sends POST with required fields", async () => {
    mockCalApi.mockResolvedValueOnce({ id: "wh-new" });

    await createWebhook({
      subscriberUrl: "https://example.com/hook",
      triggers: ["BOOKING_CREATED", "BOOKING_CANCELLED"],
    });

    expect(mockCalApi).toHaveBeenCalledWith("webhooks", {
      method: "POST",
      body: {
        subscriberUrl: "https://example.com/hook",
        triggers: ["BOOKING_CREATED", "BOOKING_CANCELLED"],
      },
    });
  });

  it("includes optional active flag", async () => {
    mockCalApi.mockResolvedValueOnce({ id: "wh-2" });

    await createWebhook({
      subscriberUrl: "https://example.com/hook",
      triggers: ["BOOKING_CREATED"],
      active: false,
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toHaveProperty("active", false);
  });

  it("includes optional payloadTemplate", async () => {
    mockCalApi.mockResolvedValueOnce({ id: "wh-3" });

    await createWebhook({
      subscriberUrl: "https://example.com/hook",
      triggers: ["BOOKING_CREATED"],
      payloadTemplate: '{"event": "{{trigger}}"}',
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toHaveProperty("payloadTemplate");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Invalid URL", {}));

    const result = await createWebhook({
      subscriberUrl: "not-a-url",
      triggers: [],
    });

    expect(result).toHaveProperty("isError", true);
  });
});

describe("deleteWebhook", () => {
  it("sends DELETE request", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await deleteWebhook({ webhookId: "wh-to-delete" });

    expect(mockCalApi).toHaveBeenCalledWith("webhooks/wh-to-delete", { method: "DELETE" });
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));

    const result = await deleteWebhook({ webhookId: "nonexistent" });

    expect(result).toHaveProperty("isError", true);
  });
});

// ── Tests for new tools ──
import {
  updateWebhook,
  updateWebhookSchema,
  getWebhook,
  getWebhookSchema,
} from "./webhooks.js";

describe("updateWebhook", () => {
  it("exports updateWebhookSchema", () => { expect(updateWebhookSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateWebhook({"webhookId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateWebhook({"webhookId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getWebhook", () => {
  it("exports getWebhookSchema", () => { expect(getWebhookSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getWebhook({"webhookId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getWebhook({"webhookId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
