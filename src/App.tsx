import { useState, useRef, useCallback, useMemo, type ChangeEvent, type ClipboardEvent } from 'react'
import { toBlob } from 'html-to-image'
import MarkdownEditor from './components/MarkdownEditor'
import XiaohongshuPreview from './components/XiaohongshuPreview'
import WechatPreview from './components/WechatPreview'
import xhsAvatar from './assets/xhs-avatar.png'
import { Download, Copy, FileText, Image, Upload, Sparkles, X, Loader2 } from 'lucide-react'

type Tab = 'xiaohongshu' | 'wechat'

const WECHAT_CODE_FONT = 'Menlo, "SF Mono", "SFMono-Regular", Monaco, Consolas, "Liberation Mono", monospace'

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getImageRefName(value: string) {
  const cleaned = value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .split('|')[0]
    .split('#')[0]
    .split('?')[0]
    .replace(/\\/g, '/')

  try {
    return decodeURIComponent(cleaned).split('/').pop() || cleaned
  } catch {
    return cleaned.split('/').pop() || cleaned
  }
}

function replaceMatchingImageRef(markdown: string, filename: string, placeholder: string) {
  const targetName = getImageRefName(filename).toLowerCase()
  let replaced = false

  const withWikiRefs = markdown.replace(/!\[\[([^\]]+)\]\]/g, (full, ref: string) => {
    if (getImageRefName(ref).toLowerCase() !== targetName) return full
    replaced = true
    return `![${filename}](${placeholder})`
  })

  const withMarkdownRefs = withWikiRefs.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt: string, url: string) => {
    if (getImageRefName(url).toLowerCase() !== targetName) return full
    replaced = true
    return `![${alt || filename}](${placeholder})`
  })

  return { markdown: withMarkdownRefs, replaced }
}

function replaceFirstLocalImageRef(markdown: string, filename: string, placeholder: string) {
  let replaced = false

  const withWikiRef = markdown.replace(/!\[\[([^\]]+)\]\]/, () => {
    replaced = true
    return `![${filename}](${placeholder})`
  })
  if (replaced) return { markdown: withWikiRef, replaced }

  const withMarkdownRef = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/, (full, alt: string, url: string) => {
    if (/^(https?:|data:|__IMG_)/i.test(url.trim())) return full
    replaced = true
    return `![${alt || filename}](${placeholder})`
  })

  return { markdown: withMarkdownRef, replaced }
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('xiaohongshu')
  const [markdown, setMarkdown] = useState(`# 示例文章

艾伦研究所的知名研究员 Nathan Lambert，前两天来北京和我们熟知的国内 AI 公司聊了一圈，包括月之暗面、智谱、字节、阿里、美团、小米等等。

聊完之后，他写了一篇文章做总结。我觉得这篇挺有意思的，因为 Nathan 本身对硅谷非常熟，这次相当于带着硅谷的视角来看我们中国的 AI 实验室是怎么运作的，以及他看到了哪些不一样的地方。

文章我看完了，写一些自己的笔记。

## 1. DeepSeek

DeepSeek 被所有人公认为技术品味和执行力最好，是技术方向上的引领者，但在商业上并不是引领者。

反过来，像字节、阿里这种巨头，被视为真正能够把大模型吃进整个业务体系、最终兑现成大规模市场份额的那批公司。

## 2. 关于中国 AI 实验室

中国 AI 实验室的运作方式和硅谷有很大不同。这里的公司往往有更强的执行力，产品迭代速度更快。

但同时，原创性研究的比例相对较低，更多的是在已有方向上的快速跟进和工程优化。

这是一个长期存在的问题，但随着像 DeepSeek 这样的公司出现，情况正在改变。
`)
  const [authorName, setAuthorName] = useState('海瑟')
  const [authorHandle, setAuthorHandle] = useState('@AIDeepDive')
  const [authorAvatar, setAuthorAvatar] = useState(xhsAvatar)
  const [dragOver, setDragOver] = useState(false)
  const [images, setImages] = useState<Record<string, string>>({})
  const [showImagePrompt, setShowImagePrompt] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const imgIdRef = useRef(0)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const xhsRef = useRef<HTMLDivElement>(null)
  const downloadingRef = useRef(false)

  const handleDownloadXhs = useCallback(async () => {
    if (downloadingRef.current) return
    downloadingRef.current = true
    setIsDownloading(true)
    try {
      if (!xhsRef.current) return
      await document.fonts?.ready

      const pages = Array.from(xhsRef.current.querySelectorAll<HTMLElement>(':scope > .xhs-page'))
      for (let i = 0; i < pages.length; i++) {
        const node = pages[i]
        const blob = await toBlob(node, { pixelRatio: 3 })
        if (!blob) continue

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `xiaohongshu-page-${i + 1}.png`
        link.href = url
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        await new Promise((resolve) => window.setTimeout(resolve, 150))
      }
    } finally {
      downloadingRef.current = false
      setIsDownloading(false)
    }
  }, [])

  const handleCopyWechat = useCallback(async () => {
    const wechatContent = document.querySelector('.wechat-content')
    if (!wechatContent) return

    // 克隆 DOM，避免修改原始预览
    const clone = wechatContent.cloneNode(true) as HTMLElement

    // 1. 移除 React 相关的 data 属性
    clone.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes)
        .filter((attr) => attr.name.startsWith('data-react'))
        .forEach((attr) => el.removeAttribute(attr.name))
    })

    // 2. 处理 blockquote：样式直接放在 blockquote 上（微信会过滤内层 div 样式）
    clone.querySelectorAll('blockquote').forEach((bq) => {
      // 删除已有的引号 div/span
      bq.querySelectorAll('div, span').forEach((el) => {
        const styleStr = el.getAttribute('style') || ''
        if (styleStr.includes('font-size: 32px') || styleStr.includes('position: absolute')) {
          el.remove()
        }
      })

      // 解开包裹 children 的 div
      const wrapperDiv = bq.querySelector('div[style*="margin-bottom: -20px"]')
      if (wrapperDiv) {
        while (wrapperDiv.firstChild) {
          bq.insertBefore(wrapperDiv.firstChild, wrapperDiv)
        }
        wrapperDiv.remove()
      }

      // 清除内容元素默认 margin，并同步字体大小
      bq.querySelectorAll('p, ul, ol').forEach((el) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.marginTop = '0px'
        htmlEl.style.marginBottom = '0px'
        htmlEl.style.fontSize = '16px'
      })

      // 样式直接放在 blockquote 上，不用 div 包裹（微信编辑器会过滤 div）
      bq.style.background = '#EDF2F7'
      bq.style.backgroundColor = '#EDF2F7'
      bq.style.borderRadius = '0px'
      bq.style.padding = '8px 12px'
      bq.style.margin = '16px 0 20px 0'
      bq.style.color = '#475569'
      bq.style.fontSize = '16px'
      bq.style.lineHeight = '1.75'
      bq.style.border = 'none'
      bq.style.boxShadow = 'none'

      // 上引号
      const upperP = document.createElement('p')
      upperP.style.margin = '0px'
      upperP.style.lineHeight = '1'
      const upperSpan = document.createElement('span')
      upperSpan.innerHTML = '&#8220;'
      upperSpan.style.fontSize = '32px'
      upperSpan.style.color = '#A0B4CC'
      upperSpan.style.fontFamily = '"Georgia", "Songti SC", "SimSun", serif'
      upperP.appendChild(upperSpan)
      bq.insertBefore(upperP, bq.firstChild)

      // 下引号（用 p 标签，微信对 p 的 text-align 保留更好）
      const lowerP = document.createElement('p')
      lowerP.align = 'right'
      lowerP.style.textAlign = 'right'
      lowerP.style.margin = '-6px 0 0 0'
      lowerP.style.lineHeight = '0.8'
      const lowerSpan = document.createElement('span')
      lowerSpan.innerHTML = '&#8221;'
      lowerSpan.style.fontSize = '32px'
      lowerSpan.style.color = '#A0B4CC'
      lowerSpan.style.fontFamily = '"Georgia", "Songti SC", "SimSun", serif'
      lowerP.appendChild(lowerSpan)
      bq.appendChild(lowerP)
    })

    // 3. 避免公众号后台套用自己的 code/pre 默认样式
    clone.querySelectorAll('pre').forEach((pre) => {
      const section = document.createElement('section')
      section.innerHTML = pre.innerHTML
      section.style.cssText = (pre as HTMLElement).style.cssText
      section.style.background = '#F3F4F6'
      section.style.backgroundColor = '#F3F4F6'
      section.style.padding = '16px'
      section.style.borderRadius = '8px'
      section.style.overflow = 'hidden'
      section.style.fontSize = '15px'
      section.style.lineHeight = '1.7'
      section.style.margin = '0 0 20px'
      section.style.fontFamily = WECHAT_CODE_FONT
      section.style.fontVariantLigatures = 'none'
      section.style.color = '#4B5563'
      section.style.whiteSpace = 'pre-wrap'
      section.style.wordBreak = 'break-word'
      pre.replaceWith(section)
    })

    clone.querySelectorAll('code').forEach((code) => {
      const span = document.createElement('span')
      span.innerHTML = code.innerHTML
      span.style.cssText = (code as HTMLElement).style.cssText
      span.style.fontFamily = WECHAT_CODE_FONT
      span.style.fontSize = '14px'
      span.style.fontVariantLigatures = 'none'
      span.style.wordBreak = 'break-word'
      code.replaceWith(span)
    })

    // 4. 列表折行收紧，同时保留条目之间的轻微间距
    clone.querySelectorAll('li').forEach((li) => {
      li.style.margin = '0 0 6px'
      li.style.lineHeight = '1.45'
    })

    // 5. 给所有内联样式加上 !important，抵抗微信编辑器的样式过滤
    clone.querySelectorAll('[style]').forEach((el) => {
      const style = (el as HTMLElement).style
      const cssText = style.cssText
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.endsWith('!important'))
        .map((s) => s + ' !important')
        .join('; ')
      if (cssText) {
        ;(el as HTMLElement).style.cssText = cssText
      }
    })

    // 6. 处理图片：确保使用 base64，避免相对路径失效
    clone.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || ''
      // 如果图片不是 base64 也不是 http 链接，标记为不可加载
      if (!src.startsWith('data:') && !src.startsWith('http')) {
        img.setAttribute('alt', `[图片: ${src}]`)
        img.removeAttribute('src')
      }
    })

    // 7. 移除空的 class 属性
    clone.querySelectorAll('*').forEach((el) => {
      if (el.getAttribute('class') === '') {
        el.removeAttribute('class')
      }
    })

    const html = clone.innerHTML

    try {
      const blob = new Blob([html], { type: 'text/html' })
      const item = new ClipboardItem({ 'text/html': blob })
      await navigator.clipboard.write([item])
      alert('已复制公众号富文本，请直接粘贴到公众号编辑器')
    } catch {
      // Fallback: copy as plain text HTML code
      await navigator.clipboard.writeText(html)
      alert('已复制 HTML 代码，请在公众号编辑器「源代码模式」中粘贴')
    }
  }, [])

  const handleFileUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setMarkdown(text)
    }
    reader.readAsText(file)
  }, [])

  const handleGenerateCoverPrompt = useCallback(() => {
    const titleMatch = markdown.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : ''

    const summary = markdown
      .replace(/^#.*$/gm, '')
      .replace(/^>.*$/gm, '')
      .replace(/^[-*]\s+.*$/gm, '')
      .replace(/^!\[.*?\]\(.*?\)$/gm, '')
      .replace(/^\d+\.\s+.*$/gm, '')
      .replace(/^---$/gm, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 10)
      .slice(0, 5)
      .join(' ')
      .slice(0, 400)

    const prompt = `【封面图主题】${title || '文章封面'}
【文章摘要】${summary || '根据全文内容生成'}
【风格要求】公众号文章封面配图，横版 16:9 比例，简洁大气，与文章主题高度相关，画面中不要出现任何文字

请根据以上信息生成一张高质量封面图。`

    setImagePrompt(prompt)
    setShowImagePrompt(true)
  }, [markdown])

  const handleGenerateSectionPrompt = useCallback(() => {
    const textarea = editorRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (start === end) {
      alert('请先在编辑器中选中一段文字，再点击生成段落配图')
      return
    }

    const selectedText = markdown.slice(start, end).trim()

    const beforeText = markdown.slice(0, start)
    const sectionTitleMatch = beforeText.match(/^##+\s+(.+)$/gm)
    const sectionTitle = sectionTitleMatch ? sectionTitleMatch[sectionTitleMatch.length - 1] : ''

    const prompt = `【段落主题】${sectionTitle || '章节配图'}
【段落内容】${selectedText.slice(0, 400)}
【风格要求】公众号文章段落配图，横版 16:9 比例，简洁商务风格，浅灰白色调，与段落内容高度相关，画面中不要出现任何文字

请根据以上信息生成一张高质量配图。`

    setImagePrompt(prompt)
    setShowImagePrompt(true)
  }, [markdown])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOver(false)
    }
  }, [])

  const importImageFiles = useCallback(
    async (
      files: File[],
      options: { cursorPos?: number; selectionEnd?: number; replaceFirstLocalRef?: boolean } = {}
    ) => {
      if (files.length === 0) return

      const cursorPos = options.cursorPos ?? editorRef.current?.selectionStart ?? markdown.length
      const selectionEnd = options.selectionEnd ?? editorRef.current?.selectionEnd ?? cursorPos
      const newImages: Record<string, string> = {}
      const fileInfos: { filename: string; placeholder: string }[] = []

      await Promise.all(
        files.map(
          (file) =>
            new Promise<void>((resolve) => {
              const reader = new FileReader()
              reader.onload = (ev) => {
                const base64 = ev.target?.result as string
                const id = imgIdRef.current++
                const placeholder = `__IMG_${id}__`
                newImages[placeholder] = base64
                fileInfos.push({ filename: file.name, placeholder })
                resolve()
              }
              reader.readAsDataURL(file)
            })
        )
      )

      let newMarkdown = markdown
      const unmatched: { filename: string; placeholder: string }[] = []

      fileInfos.forEach(({ filename, placeholder }) => {
        const matched = replaceMatchingImageRef(newMarkdown, filename, placeholder)
        newMarkdown = matched.markdown

        if (matched.replaced) return

        if (options.replaceFirstLocalRef) {
          const fallback = replaceFirstLocalImageRef(newMarkdown, filename, placeholder)
          newMarkdown = fallback.markdown
          if (fallback.replaced) return
        }

        unmatched.push({ filename, placeholder })
      })

      if (unmatched.length > 0) {
        const insertText = unmatched
          .map(({ filename, placeholder }) => `![${filename}](${placeholder})`)
          .join('\n\n')
        const prefix = cursorPos > 0 && !newMarkdown.slice(0, cursorPos).endsWith('\n') ? '\n\n' : ''
        const suffix = selectionEnd < newMarkdown.length && !newMarkdown.slice(selectionEnd).startsWith('\n') ? '\n' : ''
        newMarkdown = newMarkdown.slice(0, cursorPos) + prefix + insertText + suffix + newMarkdown.slice(selectionEnd)
      }

      setImages((prev) => ({ ...prev, ...newImages }))
      setMarkdown(newMarkdown)
    },
    [markdown]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      if (files.length === 0) return

      const cursorPos = editorRef.current?.selectionStart ?? markdown.length
      await importImageFiles(files, { cursorPos, selectionEnd: cursorPos })
    },
    [importImageFiles, markdown]
  )

  const handlePaste = useCallback(
    async (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))

      if (files.length === 0) return

      e.preventDefault()
      const cursorPos = e.currentTarget.selectionStart
      const selectionEnd = e.currentTarget.selectionEnd
      await importImageFiles(files, { cursorPos, selectionEnd, replaceFirstLocalRef: true })
    },
    [importImageFiles]
  )

  const processedMarkdown = useMemo(() => {
    return Object.entries(images).reduce((md, [placeholder, base64]) => {
      return md.replace(new RegExp(escapeRegExp(placeholder), 'g'), base64)
    }, markdown)
  }, [markdown, images])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-700" />
          <h1 className="text-base font-semibold text-gray-800">Markdown 排版工具</h1>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('xiaohongshu')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'xiaohongshu'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Image className="w-4 h-4" />
            小红书长图
          </button>
          <button
            onClick={() => setActiveTab('wechat')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'wechat'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            公众号文章
          </button>
        </div>
        <div className="w-24" />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor */}
        <div
          className="w-1/2 flex flex-col border-r border-gray-200 bg-white relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragOver && (
            <div className="absolute inset-0 bg-blue-50/90 z-50 flex flex-col items-center justify-center border-2 border-blue-400 border-dashed m-3 rounded-xl">
              <Upload className="w-8 h-8 text-blue-500 mb-2" />
              <span className="text-blue-700 font-medium text-sm">释放以导入图片</span>
              <span className="text-blue-500 text-xs mt-1">自动替换 Markdown 中的图片引用</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">Markdown 编辑器</span>
              <label className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">
                <Upload className="w-3 h-3" />
                导入 .md
                <input
                  type="file"
                  accept=".md,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-gray-300">或将图片拖拽至此</span>
              {activeTab === 'wechat' && (
                <>
                  <button
                    onClick={handleGenerateCoverPrompt}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    生成封面图
                  </button>
                  <button
                    onClick={handleGenerateSectionPrompt}
                    className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    生成段落配图
                  </button>
                </>
              )}
            </div>
            <span className="text-xs text-gray-300">{markdown.length} 字符</span>
          </div>
          <MarkdownEditor ref={editorRef} value={markdown} onChange={setMarkdown} onPaste={handlePaste} />

          {/* Image Prompt Panel */}
          {activeTab === 'wechat' && showImagePrompt && (
            <div className="border-t border-gray-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-medium text-orange-700">AI 配图提示词</span>
                  <span className="text-xs text-orange-400">（复制后到即梦 / Midjourney / DALL-E 生成）</span>
                </div>
                <button
                  onClick={() => setShowImagePrompt(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative">
                <pre className="text-xs text-gray-700 bg-white border border-orange-200 rounded-md p-3 whitespace-pre-wrap leading-relaxed font-mono">
                  {imagePrompt}
                </pre>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(imagePrompt)
                    alert('提示词已复制')
                  }}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  复制
                </button>
              </div>
            </div>
          )}

          {/* Author Info (only for xiaohongshu) */}
          {activeTab === 'xiaohongshu' && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 font-medium mb-2">作者信息（仅第一页显示）</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="昵称"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
                <input
                  type="text"
                  placeholder="@handle"
                  value={authorHandle}
                  onChange={(e) => setAuthorHandle(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (ev) => setAuthorAvatar(ev.target?.result as string)
                      reader.readAsDataURL(file)
                    }
                  }}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white cursor-pointer hover:bg-gray-50 text-gray-600"
                >
                  {authorAvatar ? '更换头像' : '上传头像'}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="w-1/2 flex flex-col bg-gray-100">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
            <span className="text-xs text-gray-400 font-medium">
              {activeTab === 'xiaohongshu' ? '图片预览' : '公众号预览'}
            </span>
            {activeTab === 'xiaohongshu' ? (
              <button
                onClick={handleDownloadXhs}
                disabled={isDownloading}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium text-white rounded-md transition-colors ${
                  isDownloading
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {isDownloading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {isDownloading ? '生成中...' : '下载图片'}
              </button>
            ) : (
              <button
                onClick={handleCopyWechat}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
              >
                <Copy className="w-3 h-3" />
                复制富文本
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3">
            {activeTab === 'xiaohongshu' ? (
              <XiaohongshuPreview
                ref={xhsRef}
                markdown={processedMarkdown}
                authorName={authorName}
                authorHandle={authorHandle}
                authorAvatar={authorAvatar}
              />
            ) : (
              <WechatPreview markdown={processedMarkdown} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
