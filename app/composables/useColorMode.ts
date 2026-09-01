export type ColorModePreference = 'system' | 'light' | 'dark'
export type ResolvedColorMode = Exclude<ColorModePreference, 'system'>

const cookieName = 'forgepilot-color-mode'
const stateKey = 'forgepilot-color-mode-preference'
const systemStateKey = 'forgepilot-system-prefers-dark'

const isColorModePreference = (value: unknown): value is ColorModePreference =>
  value === 'system' || value === 'light' || value === 'dark'

export const useColorMode = () => {
  const savedPreference = useCookie<ColorModePreference>(cookieName, {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const preference = useState<ColorModePreference>(stateKey, () =>
    isColorModePreference(savedPreference.value) ? savedPreference.value : 'system')
  const systemPrefersDark = useState(systemStateKey, () => false)
  const resolvedMode = computed<ResolvedColorMode>(() =>
    preference.value === 'system'
      ? (systemPrefersDark.value ? 'dark' : 'light')
      : preference.value)

  const setPreference = (value: ColorModePreference) => {
    preference.value = value
    savedPreference.value = value
  }

  const toggleColorMode = () => {
    setPreference(resolvedMode.value === 'dark' ? 'light' : 'dark')
  }

  let mediaQuery: MediaQueryList | undefined
  const updateSystemPreference = (event: MediaQueryListEvent) => {
    systemPrefersDark.value = event.matches
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark.value = mediaQuery.matches
    mediaQuery.addEventListener('change', updateSystemPreference)
  })
  onBeforeUnmount(() => mediaQuery?.removeEventListener('change', updateSystemPreference))

  return {
    preference: readonly(preference),
    resolvedMode,
    setPreference,
    toggleColorMode,
  }
}
