export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 }).format(Math.abs(amount))
}

export function formatCurrencySigned(amount: number): string {
  const formatted = formatCurrency(amount)
  if (amount < 0) return `-${formatted}`
  if (amount > 0) return `+${formatted}`
  return formatted
}

export function formatCurrencySpending(amount: number): string {
  const formatted = formatCurrency(amount)
  if (amount > 0) return `+${formatted}`
  return formatted
}

export function formatDate(date: Date, locale = 'en'): string {
  const loc = locale === 'he' ? 'he-IL' : 'en-GB'
  return new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatDateShort(date: Date, locale = 'en'): string {
  const loc = locale === 'he' ? 'he-IL' : 'en-GB'
  return new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date)
}

export function formatDateHeader(date: Date, locale = 'en'): string {
  const loc = locale === 'he' ? 'he-IL' : 'en-US'
  return new Intl.DateTimeFormat(loc, { month: 'short', day: '2-digit', year: 'numeric' }).format(date)
}
