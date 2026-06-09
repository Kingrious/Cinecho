import https from 'https'

const ARK_HOSTNAME = 'ark.cn-beijing.volces.com'
const VIDEO_TASKS_PATH = '/api/v3/contents/generations/tasks'

type VideoTaskProgress = {
  status: string
  message?: string
}

export const cancelVolcVideoTask = async (apiKey: string, taskId: string) => {
  return new Promise<void>((resolve, reject) => {
    const req = https.request({
      hostname: ARK_HOSTNAME,
      port: 443,
      path: `${VIDEO_TASKS_PATH}/${taskId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
          return
        }
        reject(new Error(`取消视频任务失败：HTTP ${res.statusCode} ${data.substring(0, 200)}`))
      })
    })

    req.on('error', (error: any) => {
      reject(new Error(`取消视频任务失败：${error?.message || String(error)}`))
    })

    req.setTimeout(30000, () => {
      req.destroy(new Error('取消视频任务超时'))
    })
    req.end()
  })
}

export const createVolcVideoTask = async (apiKey: string, payload: any, label: string) => {
  const postData = JSON.stringify(payload)
  console.log('[VolcVideo] create task payload:', label, '| content items:', payload.content?.length || 0)

  return new Promise<string>((resolve, reject) => {
    const req = https.request({
      hostname: ARK_HOSTNAME,
      port: 443,
      path: VIDEO_TASKS_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        console.log('[VolcVideo] task create response:', data.substring(0, 500))

        if (res.statusCode !== 200) {
          reject(new Error(`API Error: ${res.statusCode} - ${data.substring(0, 300)}`))
          return
        }

        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)))
            return
          }

          if (parsed.id) {
            resolve(parsed.id)
          } else {
            reject(new Error('No task id returned: ' + data.substring(0, 300)))
          }
        } catch (error: any) {
          reject(new Error(`Failed to parse task response: ${error?.message || String(error)}`))
        }
      })
    })

    req.on('error', (error: any) => {
      reject(new Error(`Network request failed: ${error?.message || String(error)}`))
    })

    req.setTimeout(30000)
    req.write(postData)
    req.end()
  })
}

const extractVideoUrl = (parsed: any) => {
  if (parsed.content?.video_url) return parsed.content.video_url
  if (parsed.content?.data?.length > 0) return parsed.content.data[0].url
  if (parsed.output?.video_url) return parsed.output.video_url
  if (parsed.output?.data?.length > 0) return parsed.output.data[0].url
  return ''
}

export const pollVolcVideoTask = async (
  apiKey: string,
  taskId: string,
  timeoutMs = 300000,
  onProgress?: (progress: VideoTaskProgress) => void,
  signal?: AbortSignal
) => {
  const startedAt = Date.now()

  return new Promise<string>((resolve, reject) => {
    let finished = false
    let inFlight = false
    let abortHandler: (() => void) | null = null

    const finishWithError = (message: string) => {
      if (finished) return
      finished = true
      clearInterval(pollInterval)
      if (abortHandler) signal?.removeEventListener('abort', abortHandler)
      reject(new Error(message))
    }

    const finishWithSuccess = (videoUrl: string) => {
      if (finished) return
      finished = true
      clearInterval(pollInterval)
      if (abortHandler) signal?.removeEventListener('abort', abortHandler)
      resolve(videoUrl)
    }

    if (signal?.aborted) {
      finishWithError('已停止等待当前视频生成任务')
      return
    }

    abortHandler = () => finishWithError('已停止等待当前视频生成任务')
    signal?.addEventListener('abort', abortHandler)

    const pollInterval = setInterval(() => {
      if (finished || inFlight) return
      if (Date.now() - startedAt > timeoutMs) {
        finishWithError('视频生成超时(5分钟)')
        return
      }

      inFlight = true
      const statusReq = https.request({
        hostname: ARK_HOSTNAME,
        port: 443,
        path: `${VIDEO_TASKS_PATH}/${taskId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          inFlight = false
          try {
            if (res.statusCode !== 200) {
              finishWithError(`查询视频任务失败：HTTP ${res.statusCode} ${data.substring(0, 200)}`)
              return
            }

            const parsed = JSON.parse(data)
            console.log('[VolcVideo] 任务状态:', parsed.status || 'unknown')
            onProgress?.({
              status: parsed.status || 'unknown',
              message:
                parsed.status === 'queued'
                  ? '任务已提交，正在排队'
                  : parsed.status === 'running'
                    ? '服务端正在生成视频'
                    : parsed.status === 'succeeded'
                      ? '视频生成完成，正在整理结果'
                      : parsed.status === 'failed'
                        ? '视频生成失败'
                        : parsed.status === 'cancelled'
                          ? '视频生成任务已取消'
                          : parsed.status === 'expired'
                            ? '视频生成任务已过期'
                            : undefined
            })

            if (parsed.error?.message && parsed.status !== 'running' && parsed.status !== 'queued') {
              finishWithError(parsed.error.message)
              return
            }

            if (parsed.status === 'succeeded') {
              console.log('[VolcVideo] 任务成功，完整响应:', JSON.stringify(parsed).substring(0, 1000))
              const videoUrl = extractVideoUrl(parsed)
              if (videoUrl) {
                finishWithSuccess(videoUrl)
                return
              }

              console.error('[VolcVideo] 无法从响应中提取视频URL，响应结构:', Object.keys(parsed))
              if (parsed.content) {
                console.error('[VolcVideo] content 结构:', JSON.stringify(parsed.content).substring(0, 500))
              }
              finishWithError('生成成功了，但返回结果里没有视频地址')
            } else if (parsed.status === 'failed') {
              finishWithError(parsed.error?.message || '视频生成失败')
            } else if (parsed.status === 'expired') {
              finishWithError('视频生成任务已过期')
            } else if (parsed.status === 'cancelled') {
              finishWithError('视频生成任务已取消')
            }
          } catch (error: any) {
            console.error('[VolcVideo] 解析状态失败:', error)
            finishWithError(`解析任务状态失败：${error?.message || String(error)}`)
          }
        })
      })

      statusReq.on('error', (error: any) => {
        inFlight = false
        console.error('[VolcVideo] 状态查询失败:', error)
        finishWithError(`查询视频任务失败：${error?.message || String(error)}`)
      })

      statusReq.setTimeout(30000, () => {
        statusReq.destroy(new Error('查询视频任务超时'))
      })
      statusReq.end()
    }, 3000)
  })
}
