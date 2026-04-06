import { ref, computed, shallowRef, type Component, markRaw } from 'vue'

// Lucide (default set – loaded eagerly)
import {
  Home as LHome, ClipboardList as LClipboardList, RefreshCw as LRefreshCw,
  PiggyBank as LPiggyBank, TrendingUp as LTrendingUp, Landmark as LLandmark,
  BarChart3 as LBarChart3, Settings as LSettings, MoreHorizontal as LMoreHorizontal,
  Menu as LMenu, Loader2 as LLoader2, Coins as LCoins, Sparkles as LSparkles,
  GripVertical as LGripVertical, Info as LInfo, ChevronDown as LChevronDown,
  ChevronUp as LChevronUp, ChevronLeft as LChevronLeft, ChevronRight as LChevronRight,
  Lock as LLock, Unlock as LUnlock, Trash2 as LTrash2, Split as LSplit,
  BookOpen as LBookOpen, Plus as LPlus, Scissors as LScissors, Inbox as LInbox,
  Pin as LPin, Pencil as LPencil,
} from 'lucide-vue-next'

export type IconSetName = 'lucide' | 'tabler'
export type AppIconName =
  | 'home' | 'spendings' | 'installments' | 'savings' | 'investments'
  | 'loans' | 'statistics' | 'settings' | 'more' | 'menu' | 'loader'
  | 'coins' | 'sparkles' | 'grip' | 'info' | 'chevronDown' | 'chevronUp'
  | 'chevronLeft' | 'chevronRight' | 'lock' | 'unlock' | 'trash'
  | 'split' | 'rules' | 'plus' | 'scissors' | 'inbox' | 'pin' | 'edit'

type IconMap = Record<AppIconName, Component>

const lucideIcons: IconMap = {
  home: markRaw(LHome),
  spendings: markRaw(LClipboardList),
  installments: markRaw(LRefreshCw),
  savings: markRaw(LPiggyBank),
  investments: markRaw(LTrendingUp),
  loans: markRaw(LLandmark),
  statistics: markRaw(LBarChart3),
  settings: markRaw(LSettings),
  more: markRaw(LMoreHorizontal),
  menu: markRaw(LMenu),
  loader: markRaw(LLoader2),
  coins: markRaw(LCoins),
  sparkles: markRaw(LSparkles),
  grip: markRaw(LGripVertical),
  info: markRaw(LInfo),
  chevronDown: markRaw(LChevronDown),
  chevronUp: markRaw(LChevronUp),
  chevronLeft: markRaw(LChevronLeft),
  chevronRight: markRaw(LChevronRight),
  lock: markRaw(LLock),
  unlock: markRaw(LUnlock),
  trash: markRaw(LTrash2),
  split: markRaw(LSplit),
  rules: markRaw(LBookOpen),
  plus: markRaw(LPlus),
  scissors: markRaw(LScissors),
  inbox: markRaw(LInbox),
  pin: markRaw(LPin),
  edit: markRaw(LPencil),
}

// Tabler icons – loaded on demand to reduce initial bundle
let _tablerIcons: IconMap | null = null
async function loadTablerIcons(): Promise<IconMap> {
  if (_tablerIcons) return _tablerIcons
  const {
    IconHome, IconClipboardList, IconRefresh, IconPigMoney,
    IconTrendingUp, IconBuildingBank, IconChartBar, IconSettings,
    IconDots, IconMenu2, IconLoader2, IconCoins, IconSparkles,
    IconGripVertical, IconInfoCircle, IconChevronDown, IconChevronUp,
    IconChevronLeft, IconChevronRight, IconLock, IconLockOpen,
    IconTrash, IconScissors, IconBook, IconPlus, IconArrowsSplit2,
    IconInbox, IconPin, IconPencil,
  } = await import('@tabler/icons-vue')
  _tablerIcons = {
    home: markRaw(IconHome),
    spendings: markRaw(IconClipboardList),
    installments: markRaw(IconRefresh),
    savings: markRaw(IconPigMoney),
    investments: markRaw(IconTrendingUp),
    loans: markRaw(IconBuildingBank),
    statistics: markRaw(IconChartBar),
    settings: markRaw(IconSettings),
    more: markRaw(IconDots),
    menu: markRaw(IconMenu2),
    loader: markRaw(IconLoader2),
    coins: markRaw(IconCoins),
    sparkles: markRaw(IconSparkles),
    grip: markRaw(IconGripVertical),
    info: markRaw(IconInfoCircle),
    chevronDown: markRaw(IconChevronDown),
    chevronUp: markRaw(IconChevronUp),
    chevronLeft: markRaw(IconChevronLeft),
    chevronRight: markRaw(IconChevronRight),
    lock: markRaw(IconLock),
    unlock: markRaw(IconLockOpen),
    trash: markRaw(IconTrash),
    split: markRaw(IconArrowsSplit2),
    rules: markRaw(IconBook),
    plus: markRaw(IconPlus),
    scissors: markRaw(IconScissors),
    inbox: markRaw(IconInbox),
    pin: markRaw(IconPin),
    edit: markRaw(IconPencil),
  }
  return _tablerIcons
}

export const ICON_SET_LABELS: Record<IconSetName, string> = {
  lucide: 'Lucide',
  tabler: 'Tabler',
}

const STORAGE_KEY = 'bizbuz:iconSet'

const activeSet = ref<IconSetName>(
  (localStorage.getItem(STORAGE_KEY) as IconSetName) || 'lucide'
)

// Holds the currently resolved icon map (lucide eagerly, tabler after lazy load)
const resolvedIcons = shallowRef<IconMap>(lucideIcons)

// If user previously chose tabler, load it immediately
if (activeSet.value === 'tabler') {
  loadTablerIcons().then(t => { resolvedIcons.value = t })
}

export function useIcons() {
  const icons = computed(() => resolvedIcons.value)

  function icon(name: AppIconName): Component {
    return icons.value[name]
  }

  async function setIconSet(name: IconSetName) {
    if (name === 'tabler') {
      const t = await loadTablerIcons()
      resolvedIcons.value = t
    } else {
      resolvedIcons.value = lucideIcons
    }
    activeSet.value = name
    localStorage.setItem(STORAGE_KEY, name)
  }

  return {
    activeSet,
    icons,
    icon,
    setIconSet,
  }
}
