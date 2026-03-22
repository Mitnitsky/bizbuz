interface RuleCondition {
  field: string;
  operator: string;
  value: unknown;
}

interface Rule {
  id: string;
  conditions?: RuleCondition[];
  action_category?: string;
  action_override_description?: string;
  [key: string]: unknown;
}

interface RuleResult {
  ruleId: string;
  category: string;
  overrideDescription: string;
}

interface Transaction {
  [key: string]: unknown;
}

function evaluateCondition(
  txn: Transaction,
  condition: RuleCondition
): boolean {
  const fieldValue = txn[condition.field];

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "not_equals":
      return fieldValue !== condition.value;
    case "contains":
      return (
        typeof fieldValue === "string" &&
        typeof condition.value === "string" &&
        fieldValue.toLowerCase().includes(condition.value.toLowerCase())
      );
    case "starts_with":
      return (
        typeof fieldValue === "string" &&
        typeof condition.value === "string" &&
        fieldValue.toLowerCase().startsWith(condition.value.toLowerCase())
      );
    case "greater_than":
      return (
        typeof fieldValue === "number" &&
        typeof condition.value === "number" &&
        fieldValue > condition.value
      );
    case "less_than":
      return (
        typeof fieldValue === "number" &&
        typeof condition.value === "number" &&
        fieldValue < condition.value
      );
    case "not_in":
      return (
        typeof fieldValue === "string" &&
        typeof condition.value === "string" &&
        !condition.value.split(",").map((v) => v.trim()).includes(fieldValue)
      );
    default:
      return false;
  }
}

export function evaluateRules(
  txn: Transaction,
  rules: Rule[]
): RuleResult | null {
  for (const rule of rules) {
    if (!rule.conditions || rule.conditions.length === 0) {
      continue;
    }

    const allMatch = rule.conditions.every((condition) =>
      evaluateCondition(txn, condition)
    );

    if (allMatch && rule.action_category) {
      return {
        ruleId: rule.id,
        category: rule.action_category,
        overrideDescription: rule.action_override_description || "",
      };
    }
  }

  return null;
}
