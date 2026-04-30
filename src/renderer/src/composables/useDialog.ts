import { reactive } from 'vue'

export type DialogKind = 'info' | 'error' | 'confirm'

export interface DialogRequest {
  id: number
  kind: DialogKind
  title: string
  message: string
  confirmText: string
  cancelText?: string
  resolve: (value: boolean) => void
  restoreTarget?: HTMLElement | null
}

const state = reactive({
  stack: [] as DialogRequest[]
})

let nextId = 1

const getActiveElement = () => {
  const element = document.activeElement
  return element instanceof HTMLElement ? element : null
}

const openDialog = (request: Omit<DialogRequest, 'id' | 'resolve' | 'restoreTarget'>) => {
  const restoreTarget = getActiveElement()
  return new Promise<boolean>((resolve) => {
    state.stack.push({
      ...request,
      id: nextId++,
      resolve,
      restoreTarget
    })
  })
}

const restoreFocus = (target?: HTMLElement | null) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (target && document.contains(target)) {
        target.focus()
        return
      }
      const main = document.querySelector('main') as HTMLElement | null
      main?.focus?.()
    })
  })
}

const closeDialog = (id: number, value: boolean) => {
  const index = state.stack.findIndex(item => item.id === id)
  if (index < 0) return
  const [dialog] = state.stack.splice(index, 1)
  dialog.resolve(value)
  restoreFocus(dialog.restoreTarget)
}

export const useDialog = () => {
  const notify = async (message: string, title = '提示') => {
    await openDialog({
      kind: 'info',
      title,
      message,
      confirmText: '确定'
    })
  }

  const error = async (message: string, title = '出错了') => {
    await openDialog({
      kind: 'error',
      title,
      message,
      confirmText: '知道了'
    })
  }

  const confirm = (message: string, title = '请确认', confirmText = '确认', cancelText = '取消') => {
    return openDialog({
      kind: 'confirm',
      title,
      message,
      confirmText,
      cancelText
    })
  }

  return {
    state,
    closeDialog,
    notify,
    error,
    confirm
  }
}
