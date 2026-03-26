import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgTeamWorkflows,
  getOrgTeamWorkflowsSchema,
  createOrgTeamWorkflow,
  createOrgTeamWorkflowSchema,
  getOrgTeamRfWorkflows,
  getOrgTeamRfWorkflowsSchema,
  createOrgTeamRfWorkflow,
  createOrgTeamRfWorkflowSchema,
  getOrgTeamWorkflow,
  getOrgTeamWorkflowSchema,
  updateOrgTeamWorkflow,
  updateOrgTeamWorkflowSchema,
  deleteOrgTeamWorkflow,
  deleteOrgTeamWorkflowSchema,
  getOrgTeamRfWorkflow,
  getOrgTeamRfWorkflowSchema,
  updateOrgTeamRfWorkflow,
  updateOrgTeamRfWorkflowSchema,
  deleteOrgTeamRfWorkflow,
  deleteOrgTeamRfWorkflowSchema,
} from "./team-workflows.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgTeamWorkflows", () => {
  it("exports getOrgTeamWorkflowsSchema", () => { expect(getOrgTeamWorkflowsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamWorkflows({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamWorkflows({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgTeamWorkflow", () => {
  it("exports createOrgTeamWorkflowSchema", () => { expect(createOrgTeamWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamWorkflow({"orgId":1,"teamId":1,"name":"test","activation":{},"trigger":{},"steps":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamWorkflow({"orgId":1,"teamId":1,"name":"test","activation":{},"trigger":{},"steps":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamRfWorkflows", () => {
  it("exports getOrgTeamRfWorkflowsSchema", () => { expect(getOrgTeamRfWorkflowsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamRfWorkflows({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamRfWorkflows({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgTeamRfWorkflow", () => {
  it("exports createOrgTeamRfWorkflowSchema", () => { expect(createOrgTeamRfWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamRfWorkflow({"orgId":1,"teamId":1,"name":"test","activation":{},"trigger":{},"steps":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamRfWorkflow({"orgId":1,"teamId":1,"name":"test","activation":{},"trigger":{},"steps":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamWorkflow", () => {
  it("exports getOrgTeamWorkflowSchema", () => { expect(getOrgTeamWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgTeamWorkflow", () => {
  it("exports updateOrgTeamWorkflowSchema", () => { expect(updateOrgTeamWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgTeamWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgTeamWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgTeamWorkflow", () => {
  it("exports deleteOrgTeamWorkflowSchema", () => { expect(deleteOrgTeamWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgTeamWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgTeamWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamRfWorkflow", () => {
  it("exports getOrgTeamRfWorkflowSchema", () => { expect(getOrgTeamRfWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamRfWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamRfWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgTeamRfWorkflow", () => {
  it("exports updateOrgTeamRfWorkflowSchema", () => { expect(updateOrgTeamRfWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgTeamRfWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgTeamRfWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgTeamRfWorkflow", () => {
  it("exports deleteOrgTeamRfWorkflowSchema", () => { expect(deleteOrgTeamRfWorkflowSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgTeamRfWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgTeamRfWorkflow({"orgId":1,"teamId":1,"workflowId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
