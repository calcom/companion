/**
 * Checks mock responses against Cal.com's API v2 contract (docs/api-reference/v2/openapi.json,
 * the same file packages/cli generates its client from).
 *
 * OpenAPI 3.0 schemas are converted for Ajv: `nullable` becomes a null type, `oneOf` becomes
 * `anyOf` (the spec's unions overlap: a recurring booking is also a valid plain booking), and
 * OpenAPI-only keywords are ignored.
 *
 * Artefacts of the spec generator (NestJS decorators) are normalised, because production's real
 * responses don't match them either (checked against calcom/cal's output classes):
 * - A bare `type: object` (no properties) is how the generator renders `Object` and unions such as
 *   `boolean | null` (`forwardParamsSuccessRedirect`) or `true` (booking fields' `isDefault`), so
 *   it accepts any value.
 * - `pattern: "TIME_FORMAT_HH_MM"` is a constant's name, not a regex; it's checked as HH:MM.
 * - An array-level `enum` next to `items.enum` (schedule `days`) is dropped; items keep theirs.
 * - `SCHEMA_OVERRIDES` lists the few properties whose generated schema is plainly wrong.
 */
import Ajv, { type ValidateFunction } from "ajv";

type Schema = { [key: string]: unknown };

interface OpenApiSpec {
  paths: Record<
    string,
    Record<
      string,
      { responses?: Record<string, { content?: Record<string, { schema?: Schema }> }> }
    >
  >;
  components: { schemas: Record<string, Schema> };
}

const TIME_PATTERNS: Record<string, string> = { TIME_FORMAT_HH_MM: "^([01]\\d|2[0-3]):[0-5]\\d$" };
/**
 * Properties whose generated schema contradicts the source type, by schema name.
 * In packages/platform/types/event-types/event-types_2024_06_14/outputs/event-type.output.ts:
 * - `bookingWindow` is one window object or `{ disabled: true }`; the spec says it's an array.
 * - `seats` is `Seats_2024_06_14 | Disabled_2024_06_14`; the spec leaves out `{ disabled: true }`.
 */
const ANY_OBJECT: Schema = { type: "object", additionalProperties: true };
const SCHEMA_OVERRIDES: Record<string, Record<string, Schema>> = {
  EventTypeOutput_2024_06_14: { bookingWindow: ANY_OBJECT, seats: ANY_OBJECT },
};

function isBareObject(schema: Schema): boolean {
  return (
    schema.type === "object" && !schema.properties && !schema.additionalProperties && !schema.$ref
  );
}

function applyOverrides(schemas: Record<string, Schema>): Record<string, Schema> {
  const out = { ...schemas };
  for (const [name, properties] of Object.entries(SCHEMA_OVERRIDES)) {
    const schema = out[name];
    if (!schema?.properties) continue;
    out[name] = { ...schema, properties: { ...(schema.properties as Schema), ...properties } };
  }
  return out;
}

function convert(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(convert);
  if (!node || typeof node !== "object") return node;
  const source = { ...(node as Schema) };
  if (isBareObject(source)) delete source.type;
  if (typeof source.pattern === "string" && /^[A-Z0-9_]+$/.test(source.pattern)) {
    if (TIME_PATTERNS[source.pattern]) source.pattern = TIME_PATTERNS[source.pattern];
    else delete source.pattern;
  }
  if (source.type === "array" && source.enum && source.items) delete source.enum;
  const out: Schema = {};
  for (const [key, value] of Object.entries(source)) {
    if (
      [
        "nullable",
        "discriminator",
        "example",
        "examples",
        "xml",
        "externalDocs",
        "deprecated",
      ].includes(key)
    )
      continue;
    if (key === "$ref" && typeof value === "string") {
      out.$ref = value.replace("#/components/schemas/", "openapi#/components/schemas/");
      continue;
    }
    if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(
        Object.entries(value as Schema).map(([property, schema]) => [property, convert(schema)])
      );
      continue;
    }
    out[key === "oneOf" ? "anyOf" : key] = convert(value);
  }
  if (source.nullable === true) {
    if (typeof out.type === "string") out.type = [out.type, "null"];
    else if (Array.isArray(out.type)) out.type = [...out.type, "null"];
    if (Array.isArray(out.enum)) out.enum = [...out.enum, null];
    if (!("type" in out)) return { anyOf: [out, { type: "null" }] };
  }
  return out;
}

export interface ContractCheck {
  /** The spec path for a concrete request path, e.g. /v2/bookings/{bookingUid}. */
  match(path: string, method: string): string | null;
  /** Errors for a response body, or [] when it matches. null when the spec has no schema. */
  validate(path: string, method: string, status: number, body: unknown): string[] | null;
}

export function createContractCheck(spec: OpenApiSpec): ContractCheck {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: false,
    allowUnionTypes: true,
  });
  ajv.addSchema({
    $id: "openapi",
    components: { schemas: convert(applyOverrides(spec.components.schemas)) },
  });
  const compiled = new Map<string, ValidateFunction>();
  const templates = Object.keys(spec.paths).map((template) => ({
    template,
    pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, "[^/]+")}$`),
    // Literal segments beat parameters (/bookings/{uid}/cancel over /bookings/{uid}/{x}).
    weight: template.split("/").filter((segment) => !segment.startsWith("{")).length,
  }));

  const match = (path: string, method: string) => {
    const candidates = templates
      .filter(
        ({ template, pattern }) => pattern.test(path) && spec.paths[template][method.toLowerCase()]
      )
      .sort((a, b) => b.weight - a.weight);
    return candidates[0]?.template ?? null;
  };

  return {
    match,
    validate(path, method, status, body) {
      const template = match(path, method);
      if (!template) return null;
      const response = spec.paths[template][method.toLowerCase()].responses?.[String(status)];
      const schema = response?.content?.["application/json"]?.schema;
      if (!schema) return null;
      const key = `${method} ${template} ${status}`;
      let validator = compiled.get(key);
      if (!validator) {
        validator = ajv.compile(convert(schema) as Schema);
        compiled.set(key, validator);
      }
      if (validator(body)) return [];
      return (validator.errors ?? []).map(
        (error) =>
          `${error.instancePath || "(root)"} ${error.message ?? ""} ${JSON.stringify(error.params)}`
      );
    },
  };
}
