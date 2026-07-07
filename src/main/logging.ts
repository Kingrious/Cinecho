import { mkdir, readFile, rename, writeFile, appendFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

type LogUploadConfig = {
  enabled?: boolean
  url?: string
  token?: string
  batchSize?: number
}

type LoggingOptions = {
  appName: string
  version: string
  logDir: string
  getUploadConfig: () => LogUploadConfig | undefined
}

export type AppLogPayload = Record<string, unknown>

type AppLogEvent = {
  id: string
  app: string
  version: string
  event: string
  createdAt: string
  sessionId: string
  payload: AppLogPayload
}

let options: LoggingOptions | null = null
let pendingLogPath = ''
let sentLogPath = ''
let sessionId = randomUUID()
let writeQueue = Promise.resolve()

const MAX_ERROR_LENGTH = 500

const MAX_PROMPT_LENGTH = 2000

const stringifyUnicode = (value: unknown): string =>
  JSON.stringify(value).replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

const safePayload = (payload: AppLogPayload = {}) => {
  const sanitized: AppLogPayload = {}
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('apikey') || lowerKey.includes('api_key') || lowerKey.includes('token') || lowerKey.includes('authorization')) {
      sanitized[key] = '[redacted]'
    } else if (lowerKey.includes('prompt') && typeof value === 'string') {
      sanitized[`${key}Length`] = value.length
      sanitized[key] = value.slice(0, MAX_PROMPT_LENGTH)
    } else if (lowerKey.includes('path') && typeof value === 'string') {
      sanitized[key] = value.split(/[\\/]/).pop() || value
    } else if (lowerKey.includes('error') && typeof value === 'string') {
      sanitized[key] = value.slice(0, MAX_ERROR_LENGTH)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export const initializeLogging = async (loggingOptions: LoggingOptions) => {
  options = loggingOptions
  pendingLogPath = join(loggingOptions.logDir, 'events.jsonl')
  sentLogPath = join(loggingOptions.logDir, 'events.sent.jsonl')
  sessionId = randomUUID()
  await mkdir(loggingOptions.logDir, { recursive: true })
}

export const logEvent = async (event: string, payload: AppLogPayload = {}) => {
  if (!options || !pendingLogPath) return

  const entry: AppLogEvent = {
    id: randomUUID(),
    app: options.appName,
    version: options.version,
    event,
    createdAt: new Date().toISOString(),
    sessionId,
    payload: safePayload(payload)
  }

  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() => appendFile(pendingLogPath, `${stringifyUnicode(entry)}\n`, 'utf-8'))
    .catch((error) => {
      console.warn('[Logging] Failed to write event:', error?.message || String(error))
    })

  await writeQueue
}

const readPendingEvents = async () => {
  try {
    const content = await readFile(pendingLogPath, 'utf-8')
    return content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as AppLogEvent)
  } catch {
    return []
  }
}

const writePendingEvents = async (events: AppLogEvent[]) => {
  const content = events.length ? `${events.map(event => JSON.stringify(event)).join('\n')}\n` : ''
  await writeFile(`${pendingLogPath}.tmp`, content, 'utf-8')
  await rename(`${pendingLogPath}.tmp`, pendingLogPath)
}

const appendSentEvents = async (events: AppLogEvent[]) => {
  if (!events.length) return
  await appendFile(sentLogPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`, 'utf-8')
}

const deriveLogLevel = (event: string) => {
  if (event.includes('.fail') || event.includes('.error')) return 'error'
  if (event.includes('.warn')) return 'warn'
  return 'info'
}

const eventToServerLog = (event: AppLogEvent) => ({
  time: event.createdAt,
  level: deriveLogLevel(event.event),
  message: event.event,
  module: event.event.split('.')[0] || event.app,
  payload: event.payload
})

export const flushLogs = async (reason = 'manual') => {
  if (!options || !pendingLogPath) return { uploaded: 0, remaining: 0, skipped: true }

  await writeQueue.catch(() => undefined)

  const config = options.getUploadConfig?.()
  const url = process.env.CINECHO_LOG_UPLOAD_URL || config?.url || ''
  const enabled = config?.enabled !== false && Boolean(url.trim())
  if (!enabled) return { uploaded: 0, remaining: 0, skipped: true }

  let pendingEvents = await readPendingEvents()
  if (!pendingEvents.length) return { uploaded: 0, remaining: 0, skipped: false }

  const batchSize = Math.max(1, Math.min(500, Number(config?.batchSize || 100)))
  let uploaded = 0

  while (pendingEvents.length) {
    const batch = pendingEvents.slice(0, batchSize)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config?.token ? { Authorization: `Bearer ${config.token}` } : {})
      },
      body: stringifyUnicode({
        deviceId: sessionId,
        appVersion: options.version,
        uploadedAt: new Date().toISOString(),
        reason,
        logs: batch.map(eventToServerLog)
      })
    })

    if (!response.ok) {
      throw new Error(`Log upload failed: HTTP ${response.status}`)
    }

    await appendSentEvents(batch)
    pendingEvents = pendingEvents.slice(batch.length)
    await writePendingEvents(pendingEvents)
    uploaded += batch.length
  }

  return { uploaded, remaining: pendingEvents.length, skipped: false }
}
