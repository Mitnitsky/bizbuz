import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type {
  Transaction,
  AppUser,
  Family,
  SavingsEntry,
  FamilySettings,
  CategoryDef,
  UserPreferences,
  Rule,
  TrackerType,
  OwnerTag,
  InvestmentEntry,
  LoanEntry,
  LoanType,
  MortgageTrack,
  IndexLink,
  RateType,
  PaymentMethod,
} from '@/types'
import { extractTrackerFields } from '@/composables/useTracker'
import { LEGACY_NAME_TO_ID } from '@/composables/useCategories'

// ---------- Converter helpers ----------

export function transactionFromFirestore(docSnap: QueryDocumentSnapshot<DocumentData>): Transaction {
  const d = docSnap.data()
  return {
    id: docSnap.id,
    date: toDate(d.date),
    processedDate: toDate(d.processedDate),
    originalAmount: d.originalAmount ?? 0,
    chargedAmount: d.chargedAmount ?? 0,
    description: d.description ?? '',
    overrideDescription: d.override_description ?? '',
    status: d.status ?? 'pending_categorization',
    category: LEGACY_NAME_TO_ID[d.category] ?? d.category ?? '',
    ownerTag: d.owner_tag ?? 'shared',
    type: d.type ?? 'normal',
    installments: d.installments
      ? { number: d.installments.number ?? 0, total: d.installments.total ?? 0 }
      : undefined,
    appliedRuleId: d.applied_rule_id ?? '',
    source: d.source ?? '',
    userLocked: d.user_locked ?? false,
    isSplit: !!(d.is_split || d.parent_id),
    hiddenFromUi: d.hidden_from_ui ?? false,
    memo: d.memo,
    categoryHint: d.categoryHint,
    account: d.account,
    companyId: d.companyId,
    originalCurrency: d.originalCurrency ?? 'ILS',
    chargedCurrency: d.chargedCurrency ?? 'ILS',
    hash: d.hash,
    identifier: d.identifier,
    isNew: d.is_new ?? false,
    hiddenFromInstallments: d.hidden_from_installments ?? false,
  }
}

export function savingsEntryFromFirestore(docSnap: QueryDocumentSnapshot<DocumentData>): SavingsEntry {
  const d = docSnap.data()
  const tracker = extractTrackerFields(d)
  return {
    id: docSnap.id,
    name: d.name ?? '',
    amount: d.amount ?? 0,
    savingsType: d.savings_type ?? 'liquid',
    lastUpdated: toDate(d.last_updated),
    firmName: d.firm_name,
    liquidityDate: d.liquidity_date ? toDate(d.liquidity_date) : undefined,
    notes: d.notes,
    ...tracker,
  }
}

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate()
  if (val instanceof Date) return val
  if (typeof val === 'string') return new Date(val)
  return new Date()
}

// ---------- Auth & Family ----------

export async function createFamily(uid: string, email: string, familyName: string): Promise<string> {
  const familyRef = doc(collection(db, 'families'))
  const familyId = familyRef.id
  const displayName = email.split('@')[0]
  await setDoc(familyRef, {
    name: familyName,
    created_by: uid,
    member_uids: [uid],
    member_display_names: { [uid]: displayName },
    created_at: serverTimestamp(),
  })
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    family_id: familyId,
    display_name: email.split('@')[0],
  })
  // Create default family settings
  await setDoc(doc(db, 'families', familyId, 'family_settings', 'default'), {
    cycle_start_day: 1,
    category_budgets: {},
    payment_method_labels: {},
    category_name_overrides: {},
    category_order: [],
  })
  // Create default user preferences
  await setDoc(doc(db, 'families', familyId, 'user_preferences', uid), {
    dashboard_tile_order: [],
    locale: 'en',
    show_owner_filter: true,
    show_payment_source: false,
    theme_mode: 'system',
  })
  return familyId
}

export async function joinFamily(uid: string, email: string, inviteCode: string): Promise<string | null> {
  const familiesRef = collection(db, 'families')
  const q = query(familiesRef)
  const snapshot = await getDocs(q)
  const match = snapshot.docs.find((d) => d.id.startsWith(inviteCode))
  if (!match) return null

  const familyId = match.id
  const data = match.data()
  const members: string[] = data.member_uids ?? []
  const displayName = email.split('@')[0]
  if (!members.includes(uid)) {
    members.push(uid)
    await updateDoc(doc(db, 'families', familyId), {
      member_uids: members,
      [`member_display_names.${uid}`]: displayName,
    })
  }
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    family_id: familyId,
    display_name: email.split('@')[0],
  })
  // Create default user preferences
  await setDoc(doc(db, 'families', familyId, 'user_preferences', uid), {
    dashboard_tile_order: [],
    locale: 'en',
    show_owner_filter: true,
    show_payment_source: false,
    theme_mode: 'system',
  })
  return familyId
}

export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid: d.uid,
    email: d.email,
    familyId: d.family_id,
    displayName: d.display_name,
  }
}

export async function updateDisplayName(uid: string, familyId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { display_name: name })
  if (familyId) {
    await updateDoc(doc(db, 'families', familyId), {
      [`member_display_names.${uid}`]: name,
    })
  }
}

// ---------- Transactions ----------

export async function categorizeTransaction(
  familyId: string,
  txnId: string,
  category: string,
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), {
    category,
    user_locked: true,
    status: 'categorized',
  })
}

export async function uncategorizeTransaction(
  familyId: string,
  txnId: string,
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), {
    category: '',
    user_locked: false,
    status: 'pending_categorization',
    applied_rule_id: '',
  })
}

export async function autoCategorizeTransaction(
  familyId: string,
  txnId: string,
  category: string,
  ruleId: string,
  overrideDescription?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    category,
    applied_rule_id: ruleId,
    status: 'auto_categorized',
  }
  if (overrideDescription) updates.override_description = overrideDescription
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), updates)
}

export async function updateOwnerTag(
  familyId: string,
  txnId: string,
  ownerTag: OwnerTag | string,
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), {
    owner_tag: ownerTag,
    user_locked: true,
  })
}

export async function deleteTransaction(familyId: string, txnId: string): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), {
    hidden_from_ui: true,
  })
}

export async function updateTransactionOverride(
  familyId: string,
  txnId: string,
  overrideDescription: string,
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), {
    override_description: overrideDescription,
    user_locked: true,
  })
}

export async function setTransactionLock(
  familyId: string,
  txnId: string,
  locked: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), {
    user_locked: locked,
  })
}

export async function setHiddenFromInstallments(
  familyId: string,
  txnId: string,
  hidden: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'transactions', txnId), {
    hidden_from_installments: hidden,
  })
}

export async function splitTransaction(
  familyId: string,
  txnId: string,
  splits: Array<{ amount: number; category: string; description: string; ownerTag?: string }>,
): Promise<void> {
  const txnRef = doc(db, 'families', familyId, 'transactions', txnId)
  const txnSnap = await getDoc(txnRef)
  if (!txnSnap.exists()) return

  const original = txnSnap.data()

  // Tombstone the original
  await updateDoc(txnRef, {
    is_split: true,
    hidden_from_ui: true,
  })

  // Create child splits
  const suffixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let i = 0; i < splits.length; i++) {
    const split = splits[i]
    const childId = `${txnId}_split_${suffixes[i]}`
    await setDoc(doc(db, 'families', familyId, 'transactions', childId), {
      ...original,
      chargedAmount: split.amount,
      originalAmount: split.amount,
      category: split.category,
      override_description: split.description,
      ...(split.ownerTag ? { owner_tag: split.ownerTag } : {}),
      status: 'categorized',
      user_locked: true,
      is_split: false,
      hidden_from_ui: false,
      parent_id: txnId,
    })
  }
}

export async function addManualTransaction(
  familyId: string,
  data: {
    description: string
    amount: number
    category: string
    date: Date
    ownerTag: string
  },
): Promise<void> {
  const txnsRef = collection(db, 'families', familyId, 'transactions')
  const newRef = doc(txnsRef)
  await setDoc(newRef, {
    description: data.description,
    chargedAmount: data.amount,
    originalAmount: data.amount,
    category: data.category,
    date: Timestamp.fromDate(data.date),
    processedDate: Timestamp.fromDate(data.date),
    owner_tag: data.ownerTag,
    status: 'categorized',
    source: 'manual',
    user_locked: true,
    is_split: false,
    hidden_from_ui: false,
    type: 'normal',
    originalCurrency: 'ILS',
    chargedCurrency: 'ILS',
    override_description: '',
    applied_rule_id: '',
    created_at: serverTimestamp(),
  })
}

export async function addRule(familyId: string, rule: Rule): Promise<void> {
  const rulesRef = collection(db, 'families', familyId, 'rules')
  const newRef = doc(rulesRef)
  await setDoc(newRef, {
    conditions: rule.conditions,
    action_category: rule.actionCategory,
    action_override_description: rule.actionOverrideDescription ?? '',
    created_at: serverTimestamp(),
  })
}

export function onRules(
  familyId: string,
  callback: (rules: Rule[]) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'families', familyId, 'rules'), (snapshot) => {
    const rules: Rule[] = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        conditions: data.conditions ?? [],
        actionCategory: data.action_category ?? '',
        actionOverrideDescription: data.action_override_description ?? '',
        isDefault: data.is_default ?? false,
      }
    })
    callback(rules)
  })
}

export async function updateRule(familyId: string, ruleId: string, rule: Rule): Promise<void> {
  await updateDoc(doc(db, 'families', familyId, 'rules', ruleId), {
    conditions: rule.conditions,
    action_category: rule.actionCategory,
    action_override_description: rule.actionOverrideDescription ?? '',
  })
}

export async function deleteRule(familyId: string, ruleId: string): Promise<void> {
  await deleteDoc(doc(db, 'families', familyId, 'rules', ruleId))
}

export async function getAllTransactions(familyId: string): Promise<Transaction[]> {
  const q = query(
    collection(db, 'families', familyId, 'transactions'),
    where('hidden_from_ui', '==', false),
    orderBy('date', 'desc'),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(transactionFromFirestore)
}

// ---------- Savings ----------

export async function upsertSavingsEntry(
  familyId: string,
  entry: {
    id?: string
    name: string
    amount: number
    savingsType: string
    firmName?: string
    liquidityDate?: Date
    notes?: string
  },
): Promise<void> {
  const savingsRef = collection(db, 'families', familyId, 'savings')
  const docRef = entry.id ? doc(savingsRef, entry.id) : doc(savingsRef)
  await setDoc(
    docRef,
    {
      name: entry.name,
      amount: entry.amount,
      savings_type: entry.savingsType,
      firm_name: entry.firmName ?? '',
      liquidity_date: entry.liquidityDate ? Timestamp.fromDate(entry.liquidityDate) : null,
      notes: entry.notes ?? '',
      last_updated: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function deleteSavingsEntry(familyId: string, id: string): Promise<void> {
  const { deleteDoc: firestoreDeleteDoc } = await import('firebase/firestore')
  await firestoreDeleteDoc(doc(db, 'families', familyId, 'savings', id))
}

export async function deleteLoan(familyId: string, id: string): Promise<void> {
  const { deleteDoc: firestoreDeleteDoc } = await import('firebase/firestore')
  await firestoreDeleteDoc(doc(db, 'families', familyId, 'loans', id))
}

export async function updateSavingsTracker(
  familyId: string,
  docId: string,
  trackerType: TrackerType | null,
  trackerDate: Date | null,
  trackerIntervalDays: number | null,
): Promise<void> {
  const ref = doc(db, 'families', familyId, 'savings', docId)
  await updateDoc(ref, {
    tracker_type: trackerType ?? deleteField(),
    tracker_date: trackerDate ? Timestamp.fromDate(trackerDate) : deleteField(),
    tracker_interval_days: trackerIntervalDays ?? deleteField(),
    last_updated: serverTimestamp(),
  })
}

// ---------- Investments ----------

export async function addInvestment(
  familyId: string,
  name: string,
  investedAmount: number,
  currentValue: number,
): Promise<void> {
  const ref = collection(db, 'families', familyId, 'investments')
  await setDoc(doc(ref), {
    name,
    invested_amount: investedAmount,
    current_value: currentValue,
    last_updated: serverTimestamp(),
  })
}

export async function updateInvestment(
  familyId: string,
  id: string,
  name: string,
  investedAmount: number,
  currentValue: number,
): Promise<void> {
  const ref = doc(db, 'families', familyId, 'investments', id)
  await updateDoc(ref, {
    name,
    invested_amount: investedAmount,
    current_value: currentValue,
    last_updated: serverTimestamp(),
  })
}

export async function deleteInvestment(familyId: string, id: string): Promise<void> {
  const { deleteDoc: firestoreDeleteDoc } = await import('firebase/firestore')
  await firestoreDeleteDoc(doc(db, 'families', familyId, 'investments', id))
}

export async function updateInvestmentTracker(
  familyId: string,
  docId: string,
  trackerType: TrackerType | null,
  trackerDate: Date | null,
  trackerIntervalDays: number | null,
): Promise<void> {
  const ref = doc(db, 'families', familyId, 'investments', docId)
  await updateDoc(ref, {
    tracker_type: trackerType ?? deleteField(),
    tracker_date: trackerDate ? Timestamp.fromDate(trackerDate) : deleteField(),
    tracker_interval_days: trackerIntervalDays ?? deleteField(),
    last_updated: serverTimestamp(),
  })
}

// ---------- Loans ----------

function serializeTracks(tracks: MortgageTrack[]): Record<string, unknown>[] {
  return tracks.map((t) => ({
    id: t.id,
    name: t.name,
    amount: t.amount,
    remaining: t.remaining,
    interest_rate: t.interestRate,
    index_link: t.indexLink,
    rate_type: t.rateType,
    ...(t.variableIntervalYears != null ? { variable_interval_years: t.variableIntervalYears } : {}),
    payment_method: t.paymentMethod,
    term_months: t.termMonths,
    ...(t.monthlyPayment != null ? { monthly_payment: t.monthlyPayment } : {}),
  }))
}

export function deserializeTracks(data: unknown[]): MortgageTrack[] {
  if (!Array.isArray(data)) return []
  return data.map((raw: unknown) => {
    const t = raw as Record<string, unknown>
    return {
      id: (t.id as string) ?? '',
      name: (t.name as string) ?? '',
      amount: (t.amount as number) ?? 0,
      remaining: (t.remaining as number) ?? 0,
      interestRate: (t.interest_rate as number) ?? 0,
      indexLink: (t.index_link as IndexLink) ?? 'notLinked',
      rateType: (t.rate_type as RateType) ?? 'fixed',
      ...(t.variable_interval_years != null ? { variableIntervalYears: t.variable_interval_years as number } : {}),
      paymentMethod: (t.payment_method as PaymentMethod) ?? 'spitzer',
      termMonths: (t.term_months as number) ?? 0,
      ...(t.monthly_payment != null ? { monthlyPayment: t.monthly_payment as number } : {}),
    }
  })
}

export async function addLoan(
  familyId: string,
  name: string,
  loanType: LoanType,
  principal: number,
  remaining: number,
  endDate?: Date | null,
  tracks?: MortgageTrack[],
): Promise<void> {
  const ref = collection(db, 'families', familyId, 'loans')
  const data: Record<string, unknown> = {
    name,
    loan_type: loanType,
    principal,
    remaining,
    last_updated: serverTimestamp(),
  }
  if (endDate) data.end_date = Timestamp.fromDate(endDate)
  if (tracks && tracks.length > 0) data.tracks = serializeTracks(tracks)
  await setDoc(doc(ref), data)
}

export async function updateLoan(
  familyId: string,
  id: string,
  fields: { name?: string; principal?: number; remaining?: number; endDate?: Date | null; tracks?: MortgageTrack[] },
): Promise<void> {
  const ref = doc(db, 'families', familyId, 'loans', id)
  const { endDate, tracks, ...rest } = fields
  const data: Record<string, unknown> = {
    ...rest,
    last_updated: serverTimestamp(),
  }
  if (endDate === null) data.end_date = deleteField()
  else if (endDate) data.end_date = Timestamp.fromDate(endDate)
  if (tracks !== undefined) {
    data.tracks = tracks.length > 0 ? serializeTracks(tracks) : deleteField()
  }
  await updateDoc(ref, data)
}

export async function updateLoanTracker(
  familyId: string,
  docId: string,
  trackerType: TrackerType | null,
  trackerDate: Date | null,
  trackerIntervalDays: number | null,
): Promise<void> {
  const ref = doc(db, 'families', familyId, 'loans', docId)
  await updateDoc(ref, {
    tracker_type: trackerType ?? deleteField(),
    tracker_date: trackerDate ? Timestamp.fromDate(trackerDate) : deleteField(),
    tracker_interval_days: trackerIntervalDays ?? deleteField(),
    last_updated: serverTimestamp(),
  })
}

// ---------- User Preferences ----------

export async function updateUserPreferences(
  familyId: string,
  uid: string,
  fields: Partial<Record<string, unknown>>,
): Promise<void> {
  await setDoc(doc(db, 'families', familyId, 'user_preferences', uid), fields, { merge: true })
}

export async function updateDashboardTileOrder(
  familyId: string,
  uid: string,
  order: string[],
): Promise<void> {
  await updateUserPreferences(familyId, uid, { dashboard_tile_order: order })
}

export async function updateHiddenDashboardTiles(
  familyId: string,
  uid: string,
  hidden: string[],
): Promise<void> {
  await updateUserPreferences(familyId, uid, { hidden_dashboard_tiles: hidden })
}

export async function updateLocale(familyId: string, uid: string, locale: string): Promise<void> {
  await updateUserPreferences(familyId, uid, { locale })
}

// ---------- Family Settings ----------

function familySettingsRef(familyId: string) {
  return doc(db, 'families', familyId, 'family_settings', 'default')
}

export async function updateCycleStartDay(familyId: string, day: number): Promise<void> {
  await updateDoc(familySettingsRef(familyId), { cycle_start_day: day })
}

export async function updateIncomeAnchor(
  familyId: string,
  anchorDay: number | null,
  graceDays: number,
): Promise<void> {
  await updateDoc(familySettingsRef(familyId), {
    income_anchor_day: anchorDay,
    income_anchor_grace_days: graceDays,
  })
}

export async function updateCategoryBudgets(
  familyId: string,
  budgets: Record<string, number>,
): Promise<void> {
  await updateDoc(familySettingsRef(familyId), { category_budgets: budgets })
}

export async function updatePaymentMethodLabels(
  familyId: string,
  labels: Record<string, string>,
): Promise<void> {
  await updateDoc(familySettingsRef(familyId), { payment_method_labels: labels })
}

export async function updatePaymentMethodOwners(
  familyId: string,
  owners: Record<string, string>,
): Promise<void> {
  await updateDoc(familySettingsRef(familyId), { payment_method_owners: owners })
}

export async function updateCategoryNameOverrides(
  familyId: string,
  overrides: Record<string, string>,
): Promise<void> {
  await updateDoc(familySettingsRef(familyId), { category_name_overrides: overrides })
}

export async function updateCategories(
  familyId: string,
  categories: CategoryDef[],
): Promise<void> {
  await updateDoc(familySettingsRef(familyId), { categories })
}

/** Delete a category: reassign all its transactions to 'other' and remove related rules */
export async function deleteCategoryWithCascade(
  familyId: string,
  categoryId: string,
  allCategories: CategoryDef[],
): Promise<{ transactionsReassigned: number; rulesDeleted: number }> {
  const txnRef = collection(db, 'families', familyId, 'transactions')
  const txnSnap = await getDocs(query(txnRef, where('category', '==', categoryId)))
  let transactionsReassigned = 0
  for (const d of txnSnap.docs) {
    await updateDoc(d.ref, { category: '', status: 'pending_categorization' })
    transactionsReassigned++
  }

  const rulesRef = collection(db, 'families', familyId, 'rules')
  const rulesSnap = await getDocs(query(rulesRef, where('assign_category', '==', categoryId)))
  let rulesDeleted = 0
  for (const d of rulesSnap.docs) {
    await deleteDoc(d.ref)
    rulesDeleted++
  }

  const updated = allCategories.filter(c => c.id !== categoryId)
  await updateCategories(familyId, updated)

  return { transactionsReassigned, rulesDeleted }
}

export async function updateCategoryOrder(familyId: string, uid: string, order: string[]): Promise<void> {
  await updateUserPreferences(familyId, uid, { category_order: order })
}

export async function updateFamilyName(familyId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { name })
}

// ---------- Real-time listeners ----------

export function onTransactions(
  familyId: string,
  callback: (txns: Transaction[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'families', familyId, 'transactions'),
    where('hidden_from_ui', '==', false),
  )
  return onSnapshot(q, (snapshot) => {
    const txns = snapshot.docs.map(transactionFromFirestore)
    txns.sort((a, b) => b.date.getTime() - a.date.getTime())
    callback(txns)
  }, (error) => {
    console.error('[onTransactions] Firestore error:', error.message)
  })
}

export function onSavings(
  familyId: string,
  callback: (entries: SavingsEntry[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'families', familyId, 'savings'))
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(savingsEntryFromFirestore)
    entries.sort((a, b) => a.name.localeCompare(b.name))
    callback(entries)
  }, (error) => {
    console.error('[onSavings] Firestore error:', error.message)
  })
}

export function onFamily(
  familyId: string,
  callback: (family: Family) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'families', familyId), (snap) => {
    if (!snap.exists()) return
    const d = snap.data()
    callback({
      id: snap.id,
      name: d.name ?? '',
      createdBy: d.created_by ?? '',
      memberUids: d.member_uids ?? [],
      memberDisplayNames: d.member_display_names ?? {},
      ingestSecret: d.ingest_secret,
    })
  }, (error) => {
    console.error('[onFamily] Firestore error:', error.message)
  })
}

export function onFamilySettings(
  familyId: string,
  callback: (settings: FamilySettings) => void,
): Unsubscribe {
  return onSnapshot(familySettingsRef(familyId), (snap) => {
    if (!snap.exists()) return
    const d = snap.data()
    callback({
      cycleStartDay: d.cycle_start_day ?? 1,
      incomeAnchorDay: d.income_anchor_day ?? null,
      incomeAnchorGraceDays: d.income_anchor_grace_days ?? 3,
      categoryBudgets: d.category_budgets ?? {},
      paymentMethodLabels: d.payment_method_labels ?? {},
      paymentMethodOwners: d.payment_method_owners ?? {},
      categoryNameOverrides: d.category_name_overrides ?? {},
      categories: d.categories ?? [],
    })
  }, (error) => {
    console.error('[onFamilySettings] Firestore error:', error.message)
  })
}

export function onUserPreferences(
  familyId: string,
  uid: string,
  callback: (prefs: UserPreferences) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'families', familyId, 'user_preferences', uid), (snap) => {
    if (!snap.exists()) return
    const d = snap.data()
    callback({
      dashboardTileOrder: d.dashboard_tile_order ?? [],
      hiddenDashboardTiles: d.hidden_dashboard_tiles ?? [],
      locale: d.locale ?? 'en',
      showOwnerFilter: d.show_owner_filter ?? true,
      showPaymentSource: d.show_payment_source ?? false,
      showCategoryHints: d.show_category_hints ?? false,
      themeMode: d.theme_mode ?? 'system',
      categoryOrder: d.category_order ?? [],
      pinnedCategories: d.pinned_categories ?? [],
      navBarOrder: d.nav_bar_order ?? [],
    })
  }, (error) => {
    console.error('[onUserPreferences] Firestore error:', error.message)
  })
}

// ---------- Investments & Loans (real-time) ----------

export function investmentFromFirestore(docSnap: QueryDocumentSnapshot<DocumentData>): InvestmentEntry {
  const d = docSnap.data()
  const tracker = extractTrackerFields(d)
  return {
    id: docSnap.id,
    name: d.name ?? '',
    investedAmount: d.invested_amount ?? 0,
    currentValue: d.current_value ?? 0,
    lastUpdated: toDate(d.last_updated),
    ...tracker,
  }
}

export function loanFromFirestore(docSnap: QueryDocumentSnapshot<DocumentData>): LoanEntry {
  const d = docSnap.data()
  const tracker = extractTrackerFields(d)
  return {
    id: docSnap.id,
    name: d.name ?? '',
    loanType: (d.loan_type as LoanType) ?? 'loan',
    principal: d.principal ?? 0,
    remaining: d.remaining ?? 0,
    endDate: d.end_date ? toDate(d.end_date) : undefined,
    lastUpdated: toDate(d.last_updated),
    ...tracker,
    tracks: d.tracks ? deserializeTracks(d.tracks as unknown[]) : undefined,
  }
}

export function onInvestments(
  familyId: string,
  callback: (entries: InvestmentEntry[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'families', familyId, 'investments'))
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(investmentFromFirestore)
    entries.sort((a, b) => a.name.localeCompare(b.name))
    callback(entries)
  }, (error) => {
    console.error('[onInvestments] Firestore error:', error.message)
  })
}

export function onLoans(
  familyId: string,
  callback: (entries: LoanEntry[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'families', familyId, 'loans'))
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(loanFromFirestore)
    entries.sort((a, b) => a.name.localeCompare(b.name))
    callback(entries)
  }, (error) => {
    console.error('[onLoans] Firestore error:', error.message)
  })
}
