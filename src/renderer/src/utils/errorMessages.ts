const cleanRawMessage = (raw?: string) => {
  const message = String(raw || '').trim()
  if (!message) return ''

  return message
    .replace(/\s*Request id[:：][\s\S]*$/i, '')
    .replace(/\s*"param":"".*$/i, '')
    .replace(/\s*"type":"BadRequest".*$/i, '')
    .trim()
}

const hasAny = (message: string, patterns: string[]) => patterns.some((pattern) => message.includes(pattern))

export const formatCommonError = (error?: string, fallback = '操作失败，请稍后重试。') => {
  const message = cleanRawMessage(error)
  if (!message) return fallback

  if (hasAny(message, ['No API key configured', 'API Key 未配置', 'api key'])) {
    return 'API Key 未配置或无效，请先到 Settings 页面检查后再试。'
  }
  if (hasAny(message, ['rate limit', 'Too Many Requests', '429'])) {
    return '请求太频繁了，服务正在限流，请稍等一会儿再试。'
  }
  if (hasAny(message, ['timeout', 'ETIMEDOUT', '请求超时'])) {
    return '请求超时了，可能是网络较慢或服务繁忙，请稍后重试。'
  }
  if (hasAny(message, ['网络请求失败', 'Network request failed', 'socket hang up', 'ECONNRESET', 'ECONNREFUSED', 'fetch failed'])) {
    return '网络连接失败，暂时无法完成请求，请检查网络后重试。'
  }
  if (hasAny(message, ['Unsupported provider', 'not available in this local adapter yet'])) {
    return '当前选择的服务暂时不可用，请切换到受支持的模型或服务后再试。'
  }
  if (hasAny(message, ['不支持的参考图格式', '参考图格式不支持'])) {
    return '参考图格式不受支持，请改用 PNG、JPG、WEBP 等常见图片格式。'
  }
  if (hasAny(message, ['参考图上传/读取失败'])) {
    return '参考图读取失败，请检查图片文件是否存在、是否损坏，或重新选择后再试。'
  }
  if (hasAny(message, ['API返回中未找到图像数据', '未找到图片 URL', '未找到视频URL', '生成成功了，但返回结果里没有视频地址'])) {
    return '生成结果返回不完整，暂时无法取得文件，请稍后重试。'
  }
  if (hasAny(message, ['解析响应失败', 'Failed to parse', '解析任务状态失败'])) {
    return '服务返回的数据无法识别，请稍后重试。'
  }
  if (hasAny(message, ['文件不在资产目录内', '目录不在资产目录内'])) {
    return '目标文件不在当前项目资产目录中，无法操作。'
  }

  return message
}

export const formatImageGenerationError = (error?: string) => {
  const message = cleanRawMessage(error)
  if (!message) return '图像生成失败，请稍后重试。'
  const lowerMessage = message.toLowerCase()

  if (message.includes('OutputImageSensitiveContentDetected')) {
    return '平台判定生成结果可能包含敏感内容。请减少真人写真、暴露服装或过度性感化描述后重试。'
  }
  if (
    message.includes('InputTextSensitiveContentDetected') ||
    lowerMessage.includes('sensitive text') ||
    lowerMessage.includes('may contain sensitive')
  ) {
    return '平台判定当前提示词包含敏感内容。请修改提示词，避免涉及暴力、色情、政治敏感等违规描述后重试。'
  }
  if (
    message.includes('InputImageSensitiveContentDetected.PrivacyInformation') ||
    lowerMessage.includes('may contain real person') ||
    lowerMessage.includes('privacyinformation') ||
    (message.includes('API Error: 400') && lowerMessage.includes('real person'))
  ) {
    return 'AI 生成服务限制：当前参考图疑似包含真人照片或隐私信息，模型服务方不允许继续生成。这不是 Cinecho 平台故障。请改用 AI 角色图、三视图设定图，或先将真人照片处理成非真人风格后再试。'
  }
  if (hasAny(message, [
    '可能包含真人或隐私信息',
    '参考图被平台判定可能包含真人或隐私信息',
    'privacy',
    'private information',
    'real person'
  ])) {
    return 'AI 生成服务限制：当前参考图疑似包含真人照片或隐私信息，模型服务方不允许继续生成。这不是 Cinecho 平台故障。请改用 AI 角色图、三视图设定图，或先将真人照片处理成非真人风格后再试。'
  }
  if (message.includes('reference') && message.includes('sensitive')) {
    return '参考图未通过平台安全检测，暂时不能直接用于生成。请更换为非真人、无隐私信息的参考图后重试。'
  }
  if (hasAny(message, ['APIMart 图像生成超时', 'image generation failed'])) {
    return '图像生成耗时过长或服务繁忙，请稍后重试。'
  }
  if (hasAny(message, ['InvalidParameter', 'BadRequest'])) {
    return '提交的图片生成参数不被当前模型支持，请检查提示词、参考图和模型设置后重试。'
  }

  return formatCommonError(message, '图像生成失败，请稍后重试。')
}

export const formatVideoGenerationError = (error?: string) => {
  const message = cleanRawMessage(error)
  if (!message) return '视频生成失败，请稍后重试。'
  const lowerMessage = message.toLowerCase()

  if (message.includes('service_tier') && message.includes('not supported')) {
    return '当前视频模型不支持这个生成参数。请直接重试；如果仍失败，请切换其它视频模型后再试。'
  }
  if (message.includes('当前生成模式需要至少一张可用参考图')) {
    return '当前模式需要参考图，但你选择的图片暂时不可用。请重新选择一张已生成完成、可正常预览的参考图后再试。'
  }
  if (message.includes('首尾帧模式需要同时选择首帧和尾帧')) {
    return '你当前选择的是首尾帧模式，需要同时放入首帧和尾帧后才能生成。'
  }
  if (message.includes('不支持当前生成模式')) {
    return '当前模型不支持你选中的生成模式，请切换模型或调整生成模式后再试。'
  }
  if (message.includes('InvalidParameter')) {
    return '提交的视频生成参数不被当前模型支持。请检查生成模式、参考帧、时长和分辨率后重试。'
  }
  if (
    message.includes('InputTextSensitiveContentDetected') ||
    lowerMessage.includes('sensitive text') ||
    lowerMessage.includes('may contain sensitive')
  ) {
    return '平台判定当前提示词包含敏感内容，无法进行视频生成。请修改提示词，避免涉及暴力、色情、政治敏感等违规描述后重试。'
  }
  if (
    message.includes('InputImageSensitiveContentDetected') ||
    message.includes('PrivacyInformation') ||
    lowerMessage.includes('may contain real person') ||
    (message.includes('API Error: 400') && lowerMessage.includes('real person'))
  ) {
    return 'AI 生成服务限制：当前参考图疑似包含真人照片或隐私信息，模型服务方不允许继续生成。这不是 Cinecho 平台故障。请改用 AI 角色图、三视图设定图，或先将真人照片处理成非真人风格后再试。'
  }
  if (message.includes('视频生成超时')) {
    return '视频生成耗时超过了等待上限（5分钟）。任务可能仍在服务端运行，请稍后到视频列表中查看结果；如果一直没有出现，可以缩短时长或降低分辨率后重试。'
  }
  if (message.includes('任务已过期')) {
    return '视频任务在服务端排队太久已自动过期。这通常发生在高峰期，请稍后重试，或尝试降低分辨率来减少排队时间。'
  }
  if (message.includes('任务已取消')) {
    return '视频任务已被服务端取消。如果参考图包含真人照片，可能是因为平台安全审核拒绝；请更换参考图或调整提示词后重试。'
  }
  if (hasAny(message, ['已停止等待当前视频生成任务'])) {
    return '已停止等待当前视频生成任务。'
  }

  return formatCommonError(message, '视频生成失败，请稍后重试。')
}

export const formatStoryboardError = (error?: string, action = '操作') => {
  const message = cleanRawMessage(error)
  if (!message) return `${action}分镜失败，请稍后重试。`

  if (hasAny(message, ['Storyboard not found'])) {
    return '分镜脚本不存在，可能已被删除，请刷新后重试。'
  }
  if (hasAny(message, ['Storyboard shot not found'])) {
    return '目标镜头不存在，可能已被删除或顺序已变化，请刷新后重试。'
  }

  return formatCommonError(message, `${action}分镜失败，请稍后重试。`)
}

export const formatExportError = (error?: string) => {
  const message = cleanRawMessage(error)
  if (!message) return '导出失败，请稍后重试。'

  if (hasAny(message, ['没有可以导出的视频片段'])) {
    return '时间线里还没有可导出的视频片段，请先添加片段后再导出。'
  }

  return formatCommonError(message, '导出失败，请稍后重试。')
}

export const formatPromptOptimizationError = (error?: string) => {
  const message = cleanRawMessage(error)
  if (!message) return '提示词优化失败，请稍后重试。'
  return formatCommonError(message, '提示词优化失败，请稍后重试。')
}
