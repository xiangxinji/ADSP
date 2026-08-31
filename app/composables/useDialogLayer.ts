let openDialogCount = 0
let previousBodyOverflow = ''
let appRootWasInert = false
let pendingFocusTargets: HTMLElement[] = []

export const lockDialogLayer = () => {
  if (!import.meta.client) return
  if (openDialogCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const appRoot = document.querySelector<HTMLElement>('#__nuxt')
    if (appRoot) {
      appRootWasInert = appRoot.hasAttribute('inert')
      appRoot.setAttribute('inert', '')
    }
  }
  openDialogCount += 1
}

export const unlockDialogLayer = (focusTarget: HTMLElement | null = null) => {
  if (!import.meta.client || openDialogCount === 0) return null
  openDialogCount -= 1
  const appRoot = document.querySelector<HTMLElement>('#__nuxt')
  if (openDialogCount > 0) {
    if (focusTarget && appRoot?.contains(focusTarget)) {
      pendingFocusTargets.push(focusTarget)
      return null
    }
    return focusTarget
  }

  document.body.style.overflow = previousBodyOverflow
  if (appRoot && !appRootWasInert) appRoot.removeAttribute('inert')

  const restoreTarget = [...pendingFocusTargets, focusTarget]
    .find((target): target is HTMLElement => Boolean(target?.isConnected)) || null
  pendingFocusTargets = []
  return restoreTarget
}
