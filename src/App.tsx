import { useState, useRef, useCallback, useMemo, type ChangeEvent } from 'react'
import { toPng } from 'html-to-image'
import MarkdownEditor from './components/MarkdownEditor'
import XiaohongshuPreview from './components/XiaohongshuPreview'
import WechatPreview from './components/WechatPreview'
import { Download, Copy, FileText, Image, Upload, Sparkles, X } from 'lucide-react'

type Tab = 'xiaohongshu' | 'wechat'

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  const [authorName, setAuthorName] = useState('小盖')
  const [authorHandle, setAuthorHandle] = useState('@xiaogai')
  const [authorAvatar, setAuthorAvatar] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [images, setImages] = useState<Record<string, string>>({})
  const [showImagePrompt, setShowImagePrompt] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const imgIdRef = useRef(0)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const xhsRef = useRef<HTMLDivElement>(null)

  const handleDownloadXhs = useCallback(async () => {
    if (!xhsRef.current) return
    const pages = xhsRef.current.querySelectorAll('.xhs-page')
    for (let i = 0; i < pages.length; i++) {
      const node = pages[i] as HTMLElement
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })
      const link = document.createElement('a')
      link.download = `xiaohongshu-page-${i + 1}.png`
      link.href = dataUrl
      link.click()
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

    // 2. 给所有内联样式加上 !important，抵抗微信编辑器的样式过滤
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

    // 3. 处理图片：确保使用 base64，避免相对路径失效
    clone.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || ''
      // 如果图片不是 base64 也不是 http 链接，标记为不可加载
      if (!src.startsWith('data:') && !src.startsWith('http')) {
        img.setAttribute('alt', `[图片: ${src}]`)
        img.removeAttribute('src')
      }
    })

    // 4. 移除空的 class 属性
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
      .replace(/^\>.*$/gm, '')
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

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      if (files.length === 0) return

      // 在拖拽前记录光标位置
      const cursorPos = editorRef.current?.selectionStart ?? markdown.length

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

      // 先处理匹配替换
      fileInfos.forEach(({ filename, placeholder }) => {
        const wikiPattern = new RegExp(`!\\[\\[${escapeRegExp(filename)}\\]\\]`, 'g')
        const mdPattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(filename)}\\)`, 'g')

        if (wikiPattern.test(newMarkdown) || mdPattern.test(newMarkdown)) {
          newMarkdown = newMarkdown.replace(wikiPattern, `![${filename}](${placeholder})`)
          newMarkdown = newMarkdown.replace(mdPattern, `![${filename}](${placeholder})`)
        } else {
          unmatched.push({ filename, placeholder })
        }
      })

      // 未匹配的图片插入到光标位置
      if (unmatched.length > 0) {
        const insertText = unmatched.map(({ filename, placeholder }) =>
          `![${filename}](${placeholder})`
        ).join('\n\n')
        newMarkdown = newMarkdown.slice(0, cursorPos) + '\n\n' + insertText + '\n' + newMarkdown.slice(cursorPos)
      }

      setImages((prev) => ({ ...prev, ...newImages }))
      setMarkdown(newMarkdown)
    },
    [markdown]
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
          <MarkdownEditor ref={editorRef} value={markdown} onChange={setMarkdown} />

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
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
              >
                <Download className="w-3 h-3" />
                下载图片
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
