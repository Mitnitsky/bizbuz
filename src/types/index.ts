export type OwnerTag = 'userA' | 'userB' | 'shared'
export type TransactionType = 'normal' | 'installments'
export type Status = 'auto_categorized' | 'pending_categorization' | 'categorized'
export type SavingsType = 'liquid' | 'locked'
export type TrackerType = 'once' | 'interval'

export interface InstallmentData {
  number: number
  total: number
}

export interface Transaction {
  id: string
  date: Date
  processedDate: Date
  originalAmount: number
  chargedAmount: number
  description: string
  overrideDescription: string
  status: Status | string
  category: string
  ownerTag: OwnerTag | string
  type: TransactionType | string
  installments?: InstallmentData
  appliedRuleId: string
  source: string
  userLocked: boolean
  isSplit: boolean
  hiddenFromUi: boolean
  isNew?: boolean
  hiddenFromInstallments?: boolean
  memo?: string
  categoryHint?: string
  account?: string
  companyId?: string
  originalCurrency: string
  chargedCurrency: string
  hash?: string
  identifier?: number
}

export interface Family {
  id: string
  name: string
  createdBy: string
  memberUids: string[]
  memberDisplayNames: Record<string, string>
  ingestSecret?: string
}

export interface AppUser {
  uid: string
  email: string
  familyId?: string
  displayName?: string
}

export interface SavingsEntry {
  id: string
  name: string
  amount: number
  savingsType: SavingsType
  lastUpdated: Date
  firmName?: string
  liquidityDate?: Date
  notes?: string
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
}

export type CategorySortMode = 'custom' | 'spending' | 'name'

export interface UserPreferences {
  dashboardTileOrder: string[]
  hiddenDashboardTiles: string[]
  locale: string
  showOwnerFilter: boolean
  showPaymentSource: boolean
  showCategoryHints: boolean
  themeMode: string
  categoryOrder: string[]
  pinnedCategories: string[]
  navBarOrder: string[]
}

export interface CategoryDef {
  id: string
  name: string
  nameEn?: string
  system?: boolean
  shared?: boolean
}

export interface FamilySettings {
  cycleStartDay: number
  incomeAnchorDay: number | null
  incomeAnchorGraceDays: number
  categoryBudgets: Record<string, number>
  paymentMethodLabels: Record<string, string>
  paymentMethodOwners: Record<string, OwnerTag | string>
  categoryNameOverrides: Record<string, string>
  categories: CategoryDef[]
}

export interface TrackerFields {
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
}

export interface Rule {
  id?: string
  conditions: Array<{ field: string; operator: string; value: string }>
  actionCategory: string
  actionOverrideDescription?: string
  isDefault?: boolean
}

export interface InvestmentEntry {
  id: string
  name: string
  investedAmount: number
  currentValue: number
  lastUpdated: Date
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
}

export type IndexLink = 'cpiLinked' | 'notLinked'
export type RateType = 'fixed' | 'variable'
export type PaymentMethod = 'spitzer' | 'equalPrincipal'

export interface MortgageTrack {
  id: string
  name: string
  amount: number
  remaining: number
  interestRate: number
  indexLink: IndexLink
  rateType: RateType
  variableIntervalYears?: number
  paymentMethod: PaymentMethod
  termMonths: number
  monthlyPayment?: number
}

export type LoanType = 'loan' | 'mortgage'

export interface LoanEntry {
  id: string
  name: string
  loanType: LoanType
  principal: number
  remaining: number
  endDate?: Date
  lastUpdated: Date
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
  tracks?: MortgageTrack[]
}
