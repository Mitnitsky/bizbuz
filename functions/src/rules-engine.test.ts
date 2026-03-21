import {evaluateRules} from "./rules-engine";

describe("Rules Engine", () => {
  const rules = [
    {
      id: "rule_001",
      conditions: [
        {field: "description", operator: "contains", value: "הפניקס"},
      ],
      action_category: "Insurance",
      action_override_description: "Phoenix Insurance",
    },
    {
      id: "rule_002",
      conditions: [
        {field: "description", operator: "contains", value: "שופרסל"},
        {field: "chargedAmount", operator: "less_than", value: 0},
      ],
      action_category: "Groceries",
      action_override_description: "Shufersal",
    },
    {
      id: "rule_003",
      conditions: [
        {field: "description", operator: "starts_with", value: "העברה"},
      ],
      action_category: "Transfer",
      action_override_description: "Bank Transfer",
    },
  ];

  test("matches single condition rule", () => {
    const txn = {description: "הפניקס רכב חובה", chargedAmount: -129};
    const result = evaluateRules(txn, rules);
    expect(result).toEqual({
      ruleId: "rule_001",
      category: "Insurance",
      overrideDescription: "Phoenix Insurance",
    });
  });

  test("matches multi-condition rule (AND logic)", () => {
    const txn = {description: "שופרסל דיל סניף 42", chargedAmount: -250};
    const result = evaluateRules(txn, rules);
    expect(result).toEqual({
      ruleId: "rule_002",
      category: "Groceries",
      overrideDescription: "Shufersal",
    });
  });

  test("fails multi-condition when one condition fails", () => {
    const txn = {description: "שופרסל דיל סניף 42", chargedAmount: 250};
    const result = evaluateRules(txn, rules);
    expect(result).toBeNull();
  });

  test("matches starts_with", () => {
    const txn = {description: "העברה לכרטיס אשראי", chargedAmount: -5000};
    const result = evaluateRules(txn, rules);
    expect(result).toEqual({
      ruleId: "rule_003",
      category: "Transfer",
      overrideDescription: "Bank Transfer",
    });
  });

  test("returns null when no rules match", () => {
    const txn = {description: "random merchant", chargedAmount: -50};
    const result = evaluateRules(txn, rules);
    expect(result).toBeNull();
  });

  test("skips rules with no conditions", () => {
    const emptyRule = [{id: "empty", conditions: [], action_category: "X"}];
    const txn = {description: "test"};
    expect(evaluateRules(txn, emptyRule)).toBeNull();
  });
});
