import { ref, computed, type Component, markRaw } from 'vue'

// Lucide
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

// Tabler
import {
  IconHome, IconClipboardList, IconRefresh, IconPigMoney,
  IconTrendingUp, IconBuildingBank, IconChartBar, IconSettings,
  IconDots, IconMenu2, IconLoader2, IconCoins, IconSparkles,
  IconGripVertical, IconInfoCircle, IconChevronDown, IconChevronUp,
  IconChevronLeft, IconChevronRight, IconLock, IconLockOpen,
  IconTrash, IconScissors, IconBook, IconPlus, IconArrowsSplit2,
  IconInbox, IconPin, IconPencil,
} from '@tabler/icons-vue'

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

const tablerIcons: IconMap = {
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

const ICON_SETS: Record<IconSetName, IconMap> = {
  lucide: lucideIcons,
  tabler: tablerIcons,
}

export const ICON_SET_LABELS: Record<IconSetName, string> = {
  lucide: 'Lucide',
  tabler: 'Tabler',
}

const STORAGE_KEY = 'bizbuz:iconSet'

const activeSet = ref<IconSetName>(
  (localStorage.getItem(STORAGE_KEY) as IconSetName) || 'lucide'
)

export function useIcons() {
  const icons = computed(() => ICON_SETS[activeSet.value])

  function icon(name: AppIconName): Component {
    return icons.value[name]
  }

  function setIconSet(name: IconSetName) {
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
