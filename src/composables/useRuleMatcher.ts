import type { Transaction, Rule } from '@/types'

export function evaluateCondition(txn: Transaction, cond: { field: string; operator: string; value: string }): boolean {
  const fieldValue = (txn as unknown as Record<string, unknown>)[cond.field]
  switch (cond.operator) {
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(cond.value.toLowerCase())
    case 'equals':
      return fieldValue === cond.value || (typeof fieldValue === 'number' && fieldValue === Number(cond.value))
    case 'starts_with':
      return typeof fieldValue === 'string' && fieldValue.toLowerCase().startsWith(cond.value.toLowerCase())
    case 'not_in':
      return typeof fieldValue === 'string' && !cond.value.split(',').map(v => v.trim()).includes(fieldValue)
    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > Number(cond.value)
    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < Number(cond.value)
    case 'between': {
      if (typeof fieldValue !== 'number') return false
      const [minStr, maxStr] = cond.value.split(',')
      const min = Number(minStr)
      const max = Number(maxStr)
      if (isNaN(min) || isNaN(max)) return false
      return fieldValue >= min && fieldValue <= max
    }
    default:
      return false
  }
}

export function ruleSpecificity(rule: Rule): number {
  let score = rule.conditions.length
  for (const c of rule.conditions) {
    if (c.operator === 'equals') score += 0.5
    if (c.operator === 'between') score += 0.3
  }
  return score
}

export function matchRule(txn: Transaction, rules: Rule[]): Rule | null {
  let best: Rule | null = null
  let bestScore = -1
  for (const rule of rules) {
    if (!rule.conditions.length || !rule.actionCategory) continue
    if (rule.conditions.every(c => evaluateCondition(txn, c))) {
      const score = ruleSpecificity(rule)
      if (score > bestScore) {
        best = rule
        bestScore = score
      }
    }
  }
  return best
}
