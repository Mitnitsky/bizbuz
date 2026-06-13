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
    case "between": {
      if (typeof fieldValue !== "number" || typeof condition.value !== "string")
        return false;
      const [minStr, maxStr] = condition.value.split(",");
      const min = Number(minStr);
      const max = Number(maxStr);
      if (isNaN(min) || isNaN(max)) return false;
      return fieldValue >= min && fieldValue <= max;
    }
    default:
      return false;
  }
}

function ruleSpecificity(rule: Rule): number {
  if (!rule.conditions) return 0;
  let score = rule.conditions.length;
  for (const c of rule.conditions) {
    if (c.operator === "equals") score += 0.5;
    if (c.operator === "between") score += 0.3;
  }
  return score;
}

export function evaluateRules(
  txn: Transaction,
  rules: Rule[]
): RuleResult | null {
  let best: RuleResult | null = null;
  let bestScore = -1;

  for (const rule of rules) {
    if (!rule.conditions || rule.conditions.length === 0) {
      continue;
    }

    const allMatch = rule.conditions.every((condition) =>
      evaluateCondition(txn, condition)
    );

    if (allMatch && rule.action_category) {
      const score = ruleSpecificity(rule);
      if (score > bestScore) {
        best = {
          ruleId: rule.id,
          category: rule.action_category,
          overrideDescription: rule.action_override_description || "",
        };
        bestScore = score;
      }
    }
  }

  return best;
}
