import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Snapshots the exact parameter contract for every endpoint in the OpenAPI spec.
 * Any change to openapi.json — params added/removed, required flag flipped,
 * types changed, request body schema altered — will cause a snapshot diff
 * that must be explicitly reviewed and accepted.
 */

const OPENAPI_PATH = resolve(__dirname, "../../../../docs/api-reference/v2/openapi.json");

interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: {
    type?: string;
    enum?: string[];
    items?: { type?: string };
    default?: unknown;
  };
  description?: string;
}

interface SchemaProperty {
  type?: string;
  enum?: string[];
  items?: { type?: string; $ref?: string };
  $ref?: string;
  description?: string;
  default?: unknown;
  format?: string;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  items?: SchemaObject;
}

interface OpenApiOperation {
  operationId?: string;
  tags?: string[];
  summary?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<
      string,
      {
        schema?: SchemaObject;
      }
    >;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<
        string,
        {
          schema?: SchemaObject;
        }
      >;
    }
  >;
}

interface OpenApiSpec {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

function loadOpenApiSpec(): OpenApiSpec {
  const content = readFileSync(OPENAPI_PATH, "utf-8");
  return JSON.parse(content) as OpenApiSpec;
}

function resolveRefName(ref: string): string {
  const parts = ref.split("/");
  return parts[parts.length - 1];
}

// Resolves one level deep to keep snapshots readable
function resolveSchemaContract(
  schema: SchemaObject | undefined,
  allSchemas: Record<string, SchemaObject>
): object | null {
  if (!schema) return null;

  if (schema.$ref) {
    const name = resolveRefName(schema.$ref);
    const resolved = allSchemas[name];
    if (!resolved) return { $ref: name };
    return resolveSchemaContract(resolved, allSchemas);
  }

  if (schema.allOf) {
    const merged: {
      properties: Record<string, string>;
      required: string[];
    } = { properties: {}, required: [] };

    for (const sub of schema.allOf) {
      const resolved = resolveSchemaContract(sub, allSchemas) as {
        properties?: Record<string, string>;
        required?: string[];
      } | null;
      if (resolved) {
        if (resolved.properties) {
          Object.assign(merged.properties, resolved.properties);
        }
        if (resolved.required) {
          merged.required.push(...resolved.required);
        }
      }
    }
    return {
      properties: merged.properties,
      required: merged.required.sort(),
    };
  }

  if (schema.oneOf) {
    return {
      oneOf: schema.oneOf.map((s) => {
        if (s.$ref) return resolveRefName(s.$ref);
        return resolveSchemaContract(s, allSchemas);
      }),
    };
  }

  if (schema.anyOf) {
    return {
      anyOf: schema.anyOf.map((s) => {
        if (s.$ref) return resolveRefName(s.$ref);
        return resolveSchemaContract(s, allSchemas);
      }),
    };
  }

  const result: Record<string, unknown> = {};

  if (schema.properties) {
    const props: Record<string, string> = {};
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.$ref) {
        props[propName] = resolveRefName(propSchema.$ref);
      } else if (propSchema.type === "array" && propSchema.items) {
        const itemType = propSchema.items.$ref
          ? resolveRefName(propSchema.items.$ref)
          : propSchema.items.type || "unknown";
        props[propName] = `array<${itemType}>`;
      } else if (propSchema.enum) {
        props[propName] = `enum(${propSchema.enum.join("|")})`;
      } else {
        props[propName] = propSchema.type || "unknown";
      }
    }
    result.properties = props;
  }

  if (schema.required) {
    result.required = [...schema.required].sort();
  }

  if (schema.type === "array" && schema.items) {
    if (schema.items.$ref) {
      result.arrayOf = resolveRefName(schema.items.$ref);
    } else {
      result.arrayOf = schema.items.type || "unknown";
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

interface ParameterContract {
  name: string;
  in: string;
  required: boolean;
  type: string | undefined;
  enum?: string[];
}

interface EndpointContract {
  method: string;
  path: string;
  operationId: string;
  tags: string[];
  parameters: ParameterContract[];
  requestBody: object | null;
  responseCodes: string[];
}

function extractEndpointContract(
  method: string,
  path: string,
  operation: OpenApiOperation,
  allSchemas: Record<string, SchemaObject>
): EndpointContract {
  const parameters: ParameterContract[] = (operation.parameters || []).map((p) => {
    const contract: ParameterContract = {
      name: p.name,
      in: p.in,
      required: p.required === true,
      type: p.schema?.type,
    };
    if (p.schema?.enum) {
      contract.enum = p.schema.enum;
    }
    return contract;
  });

  parameters.sort((a, b) => {
    if (a.in !== b.in) return a.in.localeCompare(b.in);
    return a.name.localeCompare(b.name);
  });

  let requestBody: object | null = null;
  if (operation.requestBody?.content) {
    const jsonContent = operation.requestBody.content["application/json"];
    if (jsonContent?.schema) {
      requestBody = resolveSchemaContract(jsonContent.schema, allSchemas);
    }
  }

  const responseCodes = Object.keys(operation.responses || {}).sort();

  return {
    method: method.toUpperCase(),
    path,
    operationId: operation.operationId || "unknown",
    tags: [...(operation.tags || [])].sort(),
    parameters,
    requestBody,
    responseCodes,
  };
}

describe("OpenAPI Endpoint Parameter Contracts", () => {
  const spec = loadOpenApiSpec();
  const allSchemas = spec.components?.schemas || {};

  const contracts: EndpointContract[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation === "object" && operation.operationId) {
        contracts.push(extractEndpointContract(method, path, operation, allSchemas));
      }
    }
  }

  contracts.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });

  it("should match the full endpoint parameter contract snapshot", () => {
    expect(contracts).toMatchSnapshot();
  });

  it("should match the parameter-only snapshot for quick diffing", () => {
    const parameterSummary = contracts.map((c) => ({
      operationId: c.operationId,
      method: c.method,
      path: c.path,
      parameters: c.parameters.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required,
        type: p.type,
        ...(p.enum ? { enum: p.enum } : {}),
      })),
    }));
    expect(parameterSummary).toMatchSnapshot();
  });

  it("should match the request body schema snapshot", () => {
    const bodySummary = contracts
      .filter((c) => c.requestBody !== null)
      .map((c) => ({
        operationId: c.operationId,
        method: c.method,
        path: c.path,
        requestBody: c.requestBody,
      }));
    expect(bodySummary).toMatchSnapshot();
  });

  it("should match the required parameters snapshot", () => {
    const requiredParams = contracts.map((c) => ({
      operationId: c.operationId,
      method: c.method,
      path: c.path,
      requiredParams: c.parameters.filter((p) => p.required).map((p) => p.name),
    }));
    expect(requiredParams).toMatchSnapshot();
  });

  it("should match the component schemas snapshot", () => {
    const schemaContracts: Record<string, object | null> = {};
    for (const [name, schema] of Object.entries(allSchemas)) {
      schemaContracts[name] = resolveSchemaContract(schema, allSchemas);
    }

    const sortedSchemas = Object.fromEntries(
      Object.entries(schemaContracts).sort(([a], [b]) => a.localeCompare(b))
    );
    expect(sortedSchemas).toMatchSnapshot();
  });

  it("should match the tags-to-endpoints mapping snapshot", () => {
    const tagMap: Record<string, string[]> = {};
    for (const c of contracts) {
      for (const tag of c.tags) {
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag].push(`${c.method} ${c.path}`);
      }
    }

    const sortedTagMap = Object.fromEntries(
      Object.entries(tagMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tag, endpoints]) => [tag, endpoints.sort()])
    );
    expect(sortedTagMap).toMatchSnapshot();
  });
});
