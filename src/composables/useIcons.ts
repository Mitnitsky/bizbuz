import { ref, computed, type Component, markRaw } from 'vue'

// Lucide
import {
  Home as LHome, ClipboardList as LClipboardList, RefreshCw as LRefreshCw,
  PiggyBank as LPiggyBank, TrendingUp as LTrendingUp, Landmark as LLandmark,
  BarChart3 as LBarChart3, Settings as LSettings, MoreHorizontal as LMoreHorizontal,
  Menu as LMenu, Loader2 as LLoader2, Coins as LCoins, Bot as LBot,
  GripVertical as LGripVertical, Info as LInfo, ChevronDown as LChevronDown,
  ChevronUp as LChevronUp, ChevronLeft as LChevronLeft, ChevronRight as LChevronRight,
  Lock as LLock, Unlock as LUnlock, Trash2 as LTrash2, Split as LSplit,
  BookOpen as LBookOpen, Plus as LPlus, Scissors as LScissors,
} from 'lucide-vue-next'

// Phosphor
import {
  PhHouse, PhClipboardText, PhArrowsClockwise, PhPiggyBank,
  PhTrendUp, PhBank, PhChartBar, PhGear, PhDotsThree,
  PhList, PhSpinnerGap, PhCoins, PhRobot,
  PhDotsSixVertical, PhInfo, PhCaretDown, PhCaretUp,
  PhCaretLeft, PhCaretRight, PhLock, PhLockOpen,
  PhTrash, PhScissors, PhBookOpen, PhPlus, PhSplitVertical,
} from '@phosphor-icons/vue'

// Tabler
import {
  IconHome, IconClipboardList, IconRefresh, IconPigMoney,
  IconTrendingUp, IconBuildingBank, IconChartBar, IconSettings,
  IconDots, IconMenu2, IconLoader2, IconCoins, IconRobot,
  IconGripVertical, IconInfoCircle, IconChevronDown, IconChevronUp,
  IconChevronLeft, IconChevronRight, IconLock, IconLockOpen,
  IconTrash, IconScissors, IconBook, IconPlus, IconArrowsSplit2,
} from '@tabler/icons-vue'

export type IconSetName = 'lucide' | 'phosphor' | 'tabler'
export type AppIconName =
  | 'home' | 'spendings' | 'installments' | 'savings' | 'investments'
  | 'loans' | 'statistics' | 'settings' | 'more' | 'menu' | 'loader'
  | 'coins' | 'bot' | 'grip' | 'info' | 'chevronDown' | 'chevronUp'
  | 'chevronLeft' | 'chevronRight' | 'lock' | 'unlock' | 'trash'
  | 'split' | 'rules' | 'plus' | 'scissors'

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
  bot: markRaw(LBot),
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
}

const phosphorIcons: IconMap = {
  home: markRaw(PhHouse),
  spendings: markRaw(PhClipboardText),
  installments: markRaw(PhArrowsClockwise),
  savings: markRaw(PhPiggyBank),
  investments: markRaw(PhTrendUp),
  loans: markRaw(PhBank),
  statistics: markRaw(PhChartBar),
  settings: markRaw(PhGear),
  more: markRaw(PhDotsThree),
  menu: markRaw(PhList),
  loader: markRaw(PhSpinnerGap),
  coins: markRaw(PhCoins),
  bot: markRaw(PhRobot),
  grip: markRaw(PhDotsSixVertical),
  info: markRaw(PhInfo),
  chevronDown: markRaw(PhCaretDown),
  chevronUp: markRaw(PhCaretUp),
  chevronLeft: markRaw(PhCaretLeft),
  chevronRight: markRaw(PhCaretRight),
  lock: markRaw(PhLock),
  unlock: markRaw(PhLockOpen),
  trash: markRaw(PhTrash),
  split: markRaw(PhSplitVertical),
  rules: markRaw(PhBookOpen),
  plus: markRaw(PhPlus),
  scissors: markRaw(PhScissors),
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
  bot: markRaw(IconRobot),
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
}

const ICON_SETS: Record<IconSetName, IconMap> = {
  lucide: lucideIcons,
  phosphor: phosphorIcons,
  tabler: tablerIcons,
}

export const ICON_SET_LABELS: Record<IconSetName, string> = {
  lucide: 'Lucide',
  phosphor: 'Phosphor',
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
