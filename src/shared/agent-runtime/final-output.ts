export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

export type FinalOutputSpec =
  | { kind: "text" }
  | {
      kind: "json_schema";
      name: string;
      schema: JsonObject;
      /**
       * Optional adapter hint for legacy CLI transports that only accept a
       * schema file path. The schema object remains the contract.
       */
      schemaPath?: string;
    };

export type FinalOutputResult =
  | { kind: "text"; text: string }
  | {
      kind: "json_schema";
      name: string;
      text: string;
      value: JsonValue;
    };

export function finalTextOutput(text: string): FinalOutputResult {
  return { kind: "text", text };
}

export function parseJsonSchemaFinalOutputText(
  spec: Extract<FinalOutputSpec, { kind: "json_schema" }>,
  text: string,
): FinalOutputResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (err: unknown) {
    throw new Error(
      `structured output for ${spec.name} was not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return finalJsonSchemaOutput(spec, text, parsed);
}

export function finalJsonSchemaOutput(
  spec: Extract<FinalOutputSpec, { kind: "json_schema" }>,
  text: string,
  value: unknown,
): FinalOutputResult {
  if (!isJsonValue(value)) {
    throw new Error(`structured output for ${spec.name} was not JSON-compatible`);
  }
  return {
    kind: "json_schema",
    name: spec.name,
    text,
    value,
  };
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item));
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every((item) =>
    isJsonValue(item),
  );
}
