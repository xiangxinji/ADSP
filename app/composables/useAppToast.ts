export type AppToastTone = 'error' | 'success'

type AppToast = {
  id: number
  message: string
  tone: AppToastTone
}

export const useAppToast = () => {
  const toast = useState<AppToast | null>('forgepilot-app-toast', () => null)

  const dismiss = () => {
    toast.value = null
  }

  const show = (message: string, tone: AppToastTone = 'success') => {
    const id = Date.now()
    toast.value = { id, message, tone }
    if (import.meta.client) {
      window.setTimeout(() => {
        if (toast.value?.id === id) dismiss()
      }, 4500)
    }
  }

  return {
    toast,
    dismiss,
    error: (message: string) => show(message, 'error'),
    success: (message: string) => show(message, 'success'),
  }
}
