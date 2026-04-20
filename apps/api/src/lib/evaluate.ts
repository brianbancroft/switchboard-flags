import type {
  FeatureFlagConfig,
  FeatureFlagRule,
  JsonValue,
} from "../db/schema.js";
import { isValueCompatibleWithFlagType } from "./contracts.js";

function valuesEqual(left: JsonValue, right: JsonValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function coerceNumber(value: JsonValue) {
  return typeof value === "number" ? value : null;
}

export function matchesRule(
  actualValue: JsonValue | undefined,
  rule: FeatureFlagRule
): boolean {
  if (actualValue === undefined) {
    return false;
  }

  switch (rule.operator) {
    case "eq":
      return valuesEqual(actualValue, rule.value);
    case "ne":
      return !valuesEqual(actualValue, rule.value);
    case "in":
      return Array.isArray(rule.value)
        ? rule.value.some((candidate) => valuesEqual(candidate, actualValue))
        : false;
    case "not_in":
      return Array.isArray(rule.value)
        ? !rule.value.some((candidate) => valuesEqual(candidate, actualValue))
        : false;
    case "lt": {
      const actual = coerceNumber(actualValue);
      const expected = coerceNumber(rule.value);
      return actual !== null && expected !== null && actual < expected;
    }
    case "lte": {
      const actual = coerceNumber(actualValue);
      const expected = coerceNumber(rule.value);
      return actual !== null && expected !== null && actual <= expected;
    }
    case "gt": {
      const actual = coerceNumber(actualValue);
      const expected = coerceNumber(rule.value);
      return actual !== null && expected !== null && actual > expected;
    }
    case "gte": {
      const actual = coerceNumber(actualValue);
      const expected = coerceNumber(rule.value);
      return actual !== null && expected !== null && actual >= expected;
    }
    case "contains":
      return typeof actualValue === "string" && typeof rule.value === "string"
        ? actualValue.includes(rule.value)
        : Array.isArray(actualValue)
          ? actualValue.some((item) => valuesEqual(item, rule.value))
          : false;
    case "starts_with":
      return typeof actualValue === "string" && typeof rule.value === "string"
        ? actualValue.startsWith(rule.value)
        : false;
    case "ends_with":
      return typeof actualValue === "string" && typeof rule.value === "string"
        ? actualValue.endsWith(rule.value)
        : false;
    default:
      return false;
  }
}

export function evaluateFlagValue(input: {
  config: FeatureFlagConfig;
  overrideValue?: JsonValue;
  attributes: Record<string, JsonValue>;
}) {
  if (
    input.overrideValue !== undefined &&
    isValueCompatibleWithFlagType(input.overrideValue, input.config.type)
  ) {
    return {
      value: input.overrideValue,
      source: "override" as const,
      ruleMatched: false,
      matchedRule: null,
    };
  }

  const matchedRule =
    input.config.rules.find((rule) =>
      matchesRule(input.attributes[rule.attribute], rule)
    ) ?? null;

  if (!matchedRule) {
    return {
      value: input.config.defaultValue,
      source: "default" as const,
      ruleMatched: false,
      matchedRule: null,
    };
  }

  if (input.config.type === "boolean") {
    return {
      value: true,
      source: "rule" as const,
      ruleMatched: true,
      matchedRule,
    };
  }

  return {
    value: input.config.defaultValue,
    source: "rule" as const,
    ruleMatched: true,
    matchedRule,
  };
}
