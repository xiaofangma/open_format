import React, { useLayoutEffect, useRef, useState, forwardRef, useMemo } from 'react'

interface Props {
  markdown: string
  authorName: string
  authorHandle: string
  authorAvatar: string
}

const PAGE_WIDTH = 390
const PAGE_HEIGHT = 700
const PAGE_PADDING_X = 30
const PAGE_PADDING_Y = 32
const AUTHOR_HEIGHT = 76
const BOTTOM_SAFE = 0 // 底部安全区域取消，图片允许被裁剪

interface BlockInfo {
  type: string
  content: string
  olIndex?: number
  url?: string
}

interface MeasuredBlock {
  id: number
  height: number
}

// 简单行内 Markdown 解析：加粗、斜体、代码、删除线、链接、高亮
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|==([^=]+)==|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g

  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index))
    }

    const full = m[0]
    if (full.startsWith('**')) {
      parts.push(<strong key={m.index} style={{ fontWeight: 700, color: '#2C2C2C' }}>{m[2]}</strong>)
    } else if (full.startsWith('==')) {
      parts.push(<mark key={m.index} style={{ background: '#FDE8B3', padding: '0 3px', borderRadius: '3px', color: '#2C2C2C' }}>{m[4]}</mark>)
    } else if (full.startsWith('~~')) {
      parts.push(<del key={m.index} style={{ textDecoration: 'line-through', opacity: 0.6 }}>{m[5]}</del>)
    } else if (full.startsWith('`')) {
      parts.push(<code key={m.index} style={{ background: '#F5EDE4', padding: '2px 5px', borderRadius: '4px', fontSize: '0.88em', fontFamily: 'ui-monospace, monospace', color: '#D97757' }}>{m[6]}</code>)
    } else if (full.startsWith('[')) {
      parts.push(<a key={m.index} href={m[8]} style={{ color: '#576b95', textDecoration: 'none' }}>{m[7]}</a>)
    } else {
      parts.push(<em key={m.index}>{m[3]}</em>)
    }

    lastIdx = m.index + full.length
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

const XiaohongshuPreview = forwardRef<HTMLDivElement, Props>(
  ({ markdown, authorName, authorHandle, authorAvatar }, ref) => {
    const [pages, setPages] = useState<MeasuredBlock[][]>([])
    const measureRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const blocks = useMemo(() => {
      const lines = markdown.split('\n')
      const result: BlockInfo[] = []
      let currentParagraph = ''
      let olCounter = 0

      const flushParagraph = () => {
        if (currentParagraph.trim()) {
          result.push({ type: 'paragraph', content: currentParagraph.trim() })
          currentParagraph = ''
        }
      }

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          flushParagraph()
          olCounter = 0
          continue
        }
        if (trimmed.startsWith('# ')) {
          flushParagraph()
          result.push({ type: 'h1', content: trimmed.slice(2) })
          olCounter = 0
        } else if (trimmed.startsWith('## ')) {
          flushParagraph()
          result.push({ type: 'h2', content: trimmed.slice(3) })
          olCounter = 0
        } else if (trimmed.startsWith('### ')) {
          flushParagraph()
          result.push({ type: 'h3', content: trimmed.slice(4) })
          olCounter = 0
        } else if (trimmed.startsWith('>')) {
          flushParagraph()
          result.push({ type: 'blockquote', content: trimmed.slice(1).trim() })
          olCounter = 0
        } else if (/^!\[([^\]]*)\]\(([^)]+)\)/.test(trimmed)) {
          flushParagraph()
          const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
          if (imgMatch) {
            result.push({ type: 'img', content: imgMatch[1], url: imgMatch[2] })
          }
          olCounter = 0
        } else if (/^!\[\[([^\]]+)\]\]/.test(trimmed)) {
          flushParagraph()
          const wikiMatch = trimmed.match(/^!\[\[([^\]]+)\]\]/)
          if (wikiMatch) {
            result.push({ type: 'img', content: '', url: wikiMatch[1] })
          }
          olCounter = 0
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          flushParagraph()
          result.push({ type: 'li', content: trimmed.slice(2) })
          olCounter = 0
        } else if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
          flushParagraph()
          result.push({ type: 'hr', content: '' })
          olCounter = 0
        } else if (trimmed.match(/^\d+\.\s/)) {
          flushParagraph()
          olCounter++
          result.push({ type: 'oli', content: trimmed.replace(/^\d+\.\s/, ''), olIndex: olCounter })
        } else {
          currentParagraph += (currentParagraph ? ' ' : '') + trimmed
          olCounter = 0
        }
      }
      flushParagraph()
      return result
    }, [markdown])

    useLayoutEffect(() => {
      if (!measureRef.current) return

      const measure = () => {
        const container = measureRef.current!
        const children = Array.from(container.children)
        const measured: MeasuredBlock[] = []

        children.forEach((child, idx) => {
          const rect = child.getBoundingClientRect()
          measured.push({ id: idx, height: rect.height })
        })

        const availableFirst = PAGE_HEIGHT - PAGE_PADDING_Y * 2 - AUTHOR_HEIGHT - BOTTOM_SAFE
        const available = PAGE_HEIGHT - PAGE_PADDING_Y * 2 - BOTTOM_SAFE

        const allPages: MeasuredBlock[][] = []
        let currentPage: MeasuredBlock[] = []
        let currentHeight = 0
        let isFirstPage = true

        for (let i = 0; i < measured.length; i++) {
          const block = measured[i]
          const maxH = isFirstPage ? availableFirst : available
          const blockType = blocks[block.id].type

          // 文字块严格限制，防止截断；图片允许超出被裁剪
          const limit = blockType === 'img' ? maxH + 60 : maxH - 2

          if (currentHeight + block.height <= limit) {
            currentPage.push(block)
            currentHeight += block.height
          } else {
            if (currentPage.length > 0) {
              allPages.push(currentPage)
            }
            currentPage = [block]
            currentHeight = block.height
            isFirstPage = false
          }
        }

        if (currentPage.length > 0) {
          allPages.push(currentPage)
        }

        // Even distribution
        if (allPages.length >= 2) {
          const totalHeight = measured.reduce((s, b) => s + b.height, 0)
          const avgHeight = totalHeight / allPages.length
          const lastPage = allPages[allPages.length - 1]
          const lastPageHeight = lastPage.reduce((s, b) => s + b.height, 0)

          if (lastPageHeight < avgHeight * 0.45 && allPages[allPages.length - 2].length > 1) {
            const prevPage = allPages[allPages.length - 2]
            let prevPageHeight = prevPage.reduce((s, b) => s + b.height, 0)

            while (
              prevPage.length > 1 &&
              prevPageHeight - prevPage[prevPage.length - 1].height > avgHeight
            ) {
              const moved = prevPage.pop()!
              prevPageHeight -= moved.height
              lastPage.unshift(moved)
            }
          }
        }

        setPages(allPages)
      }

      let t1: ReturnType<typeof setTimeout>
      let t2: ReturnType<typeof setTimeout>

      const schedule = () => {
        requestAnimationFrame(measure)
        t1 = setTimeout(measure, 300)
        t2 = setTimeout(measure, 800)
      }

      // 等待字体加载完成后再测量，避免字体差异导致的高度不准
      if (document.fonts) {
        document.fonts.ready.then(schedule)
      } else {
        schedule()
      }

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }, [blocks])

    const renderBlock = (block: BlockInfo, idx: number) => {
      const inline = parseInline(block.content)

      switch (block.type) {
        case 'h1':
          return (
            <h1
              key={idx}
              style={{
                fontFamily: 'var(--font-song)',
                fontSize: '26px',
                fontWeight: 700,
                lineHeight: 1.3,
                paddingBottom: '20px',
                margin: 0,
                color: '#2C2C2C',
                wordBreak: 'break-word',
              }}
            >
              {inline}
            </h1>
          )
        case 'h2':
          return (
            <h2
              key={idx}
              style={{
                fontFamily: 'var(--font-song)',
                fontSize: '19px',
                fontWeight: 700,
                lineHeight: 1.4,
                paddingTop: '28px',
                paddingBottom: '14px',
                margin: 0,
                color: '#2C2C2C',
                wordBreak: 'break-word',
              }}
            >
              {inline}
            </h2>
          )
        case 'h3':
          return (
            <h3
              key={idx}
              style={{
                fontFamily: 'var(--font-song)',
                fontSize: '16px',
                fontWeight: 700,
                lineHeight: 1.45,
                paddingTop: '20px',
                paddingBottom: '10px',
                margin: 0,
                color: '#2C2C2C',
                wordBreak: 'break-word',
              }}
            >
              {inline}
            </h3>
          )
        case 'blockquote':
          return (
            <blockquote
              key={idx}
              style={{
                background: '#EDF2F7',
                borderRadius: '0px',
                padding: '8px 12px',
                margin: '0 0 16px 0',
                color: '#475569',
                fontSize: '15px',
                lineHeight: 1.75,
                fontFamily: 'var(--font-song)',
                wordBreak: 'break-word',
              }}
            >
              {inline}
            </blockquote>
          )
        case 'li':
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                paddingBottom: '8px',
                margin: 0,
                fontSize: '15px',
                lineHeight: 1.8,
                fontFamily: 'var(--font-song)',
                color: '#2C2C2C',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ flexShrink: 0, paddingTop: '2px' }}>•</span>
              <span>{inline}</span>
            </div>
          )
        case 'oli':
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                paddingBottom: '8px',
                margin: 0,
                fontSize: '15px',
                lineHeight: 1.8,
                fontFamily: 'var(--font-song)',
                color: '#2C2C2C',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ flexShrink: 0 }}>{block.olIndex}.</span>
              <span>{inline}</span>
            </div>
          )
        case 'img': {
          const imgUrl = block.url?.startsWith('http')
            ? block.url
            : encodeURI(block.url || '')
          return (
            <div
              key={idx}
              style={{
                paddingBottom: '16px',
                margin: 0,
                minHeight: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={imgUrl}
                alt={block.content}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = `<div style="color:#bbb;font-size:13px;text-align:center;padding:16px;border:1px dashed #ddd;border-radius:4px;">图片无法加载<br/>${block.url}</div>`
                  }
                }}
                style={{
                  maxWidth: '100%',
                  maxHeight: '280px',
                  borderRadius: '4px',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            </div>
          )
        }
        case 'hr':
          return (
            <hr
              key={idx}
              style={{
                border: 'none',
                borderTop: '1px solid #d8cfc6',
                paddingTop: '24px',
                paddingBottom: '24px',
                margin: 0,
              }}
            />
          )
        default:
          return (
            <p
              key={idx}
              style={{
                fontFamily: 'var(--font-song)',
                fontSize: '15px',
                lineHeight: 1.85,
                paddingBottom: '16px',
                margin: 0,
                color: '#2C2C2C',
                textAlign: 'justify',
                wordBreak: 'break-word',
              }}
            >
              {inline}
            </p>
          )
      }
    }

    const today = useMemo(() => {
      const d = new Date()
      return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`
    }, [])

    return (
      <div className="flex flex-col items-center gap-3 pb-2" ref={containerRef}>
        {/* Hidden measurement container */}
        <div
          ref={measureRef}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            width: PAGE_WIDTH - PAGE_PADDING_X * 2,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {blocks.map((block, idx) => renderBlock(block, idx))}
        </div>

        {/* Visible pages */}
        <div ref={ref} className="flex flex-col items-center gap-3">
          {pages.map((pageBlocks, pageIdx) => (
            <div
              key={pageIdx}
              className="xhs-page relative bg-white shadow-lg"
              style={{
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                backgroundColor: '#FAF8F3',
                padding: `${PAGE_PADDING_Y}px ${PAGE_PADDING_X}px`,
                boxSizing: 'border-box',
                overflow: 'hidden',
                fontFamily: 'var(--font-song)',
              }}
            >
              {/* Author header - only first page */}
              {pageIdx === 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '28px',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: authorAvatar ? `url(${authorAvatar}) center/cover` : '#d4c4b4',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {!authorAvatar && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          color: '#fff',
                          fontFamily: 'var(--font-song)',
                        }}
                      >
                        {authorName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: '#2C2C2C',
                        lineHeight: 1.3,
                        fontFamily: 'var(--font-song)',
                      }}
                    >
                      {authorName}
                      <span style={{ color: '#999', fontWeight: 400, marginLeft: '6px' }}>
                        {authorHandle}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#999',
                        lineHeight: 1.4,
                        marginTop: '4px',
                        fontFamily: 'system-ui, sans-serif',
                      }}
                    >
                      {today}
                    </div>
                  </div>
                </div>
              )}

              {/* Page content */}
              <div
                style={{
                  height: pageIdx === 0
                    ? PAGE_HEIGHT - PAGE_PADDING_Y * 2 - AUTHOR_HEIGHT - BOTTOM_SAFE
                    : PAGE_HEIGHT - PAGE_PADDING_Y * 2 - BOTTOM_SAFE,
                  overflow: 'hidden',
                }}
              >
                {pageBlocks.map((block) => {
                  const blockData = blocks[block.id]
                  if (!blockData) return null
                  return (
                    <React.Fragment key={block.id}>
                      {renderBlock(blockData, block.id)}
                    </React.Fragment>
                  )
                })}
              </div>

            </div>
          ))}
        </div>

        {pages.length === 0 && (
          <div className="text-gray-400 text-sm mt-10">正在排版中...</div>
        )}
      </div>
    )
  }
)

XiaohongshuPreview.displayName = 'XiaohongshuPreview'

export default XiaohongshuPreview
