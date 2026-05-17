import https from 'https'

const ARK_HOSTNAME = 'ark.cn-beijing.volces.com'
const VIDEO_TASKS_PATH = '/api/v3/contents/generations/tasks'

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

export const pollVolcVideoTask = async (apiKey: string, taskId: string, timeoutMs = 300000) => {
  const startedAt = Date.now()

  return new Promise<string>((resolve, reject) => {
    const pollInterval = setInterval(() => {
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(pollInterval)
        reject(new Error('视频生成超时(5分钟)'))
        return
      }

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
          try {
            const parsed = JSON.parse(data)
            console.log('[VolcVideo] 任务状态:', parsed.status || 'unknown')

            if (parsed.status === 'succeeded') {
              clearInterval(pollInterval)
              console.log('[VolcVideo] 任务成功，完整响应:', JSON.stringify(parsed).substring(0, 1000))
              const videoUrl = extractVideoUrl(parsed)
              if (videoUrl) {
                resolve(videoUrl)
                return
              }

              console.error('[VolcVideo] 无法从响应中提取视频URL，响应结构:', Object.keys(parsed))
              if (parsed.content) {
                console.error('[VolcVideo] content 结构:', JSON.stringify(parsed.content).substring(0, 500))
              }
              reject(new Error('响应中未找到视频URL'))
            } else if (parsed.status === 'failed') {
              clearInterval(pollInterval)
              reject(new Error(parsed.error?.message || '视频生成失败'))
            } else if (parsed.status === 'expired') {
              clearInterval(pollInterval)
              reject(new Error('视频生成任务已过期'))
            }
          } catch (error) {
            console.error('[VolcVideo] 解析状态失败:', error)
          }
        })
      })

      statusReq.on('error', (error) => {
        console.error('[VolcVideo] 状态查询失败:', error)
      })

      statusReq.end()
    }, 3000)
  })
}
