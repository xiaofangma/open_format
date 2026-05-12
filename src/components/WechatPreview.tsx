import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

// 从 React children 中提取纯文本
function getText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(getText).join('')
  if (React.isValidElement(node)) return getText(node.props.children)
  return ''
}

// 从 markdown 的 ## 行中提取纯文本（去除粗体、斜体、代码、链接等语法）
function extractH2Text(line: string): string {
  let text = line.replace(/^##\s+/, '')
  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  text = text.replace(/\*(.+?)\*/g, '$1')
  text = text.replace(/`(.+?)`/g, '$1')
  text = text.replace(/\[(.+?)\]\(.+?\)/g, '$1')
  text = text.replace(/~~(.+?)~~/g, '$1')
  return text.trim()
}

interface Props {
  markdown: string
}

const WechatPreview: React.FC<Props> = ({ markdown }) => {
  // 预先解析 markdown 中所有 ## 标题，建立 纯文本内容 -> 编号 的映射
  const h2TextToIndexMap = React.useMemo(() => {
    const map = new Map<string, number>()
    let count = 0
    let inCodeBlock = false
    const lines = markdown.split('\n')
    for (const line of lines) {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock
        continue
      }
      if (!inCodeBlock && line.startsWith('## ')) {
        count++
        const text = extractH2Text(line)
        const normalized = text.replace(/\s+/g, ' ').trim()
        if (!map.has(normalized)) {
          map.set(normalized, count)
        }
      }
    }
    return map
  }, [markdown])

  // 预处理高亮语法 ==...== 为 HTML mark 标签
  const processedMarkdown = markdown.replace(
    /==([^=]+)==/g,
    '<mark style="background:linear-gradient(to bottom, transparent 60%, #fed7aa 60%);padding:0 2px;color:#1F2937;">$1</mark>'
  )

  return (
    <div className="flex justify-center">
      <div
        className="wechat-content px-5 py-6 text-gray-900"
        style={{
          width: 680,
          maxWidth: '100%',
          backgroundColor: '#F9FAFB',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({ children }) => (
              <h1 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                lineHeight: 1.4,
                margin: '32px 0 16px',
                color: '#1a1a1a',
                textAlign: 'left',
              }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => {
              const text = getText(children).replace(/\s+/g, ' ').trim()
              const index = h2TextToIndexMap.get(text) || 0
              const numStr = String(index).padStart(2, '0')

              return (
                <h2 style={{ margin: '36px 0 36px' }}>
                  <span
                    style={{
                      fontSize: '48px',
                      fontStyle: 'italic',
                      color: '#ea580c',
                      borderBottom: '3px solid #ea580c',
                      paddingBottom: '0px',
                      display: 'inline-block',
                      fontWeight: 'bold',
                      lineHeight: 1.2,
                    }}
                  >
                    {numStr}
                  </span>
                  <br />
                  <span
                    style={{
                      fontSize: '22px',
                      fontWeight: 'bold',
                      color: '#1a1a1a',
                      marginTop: '20px',
                      lineHeight: 1.5,
                      display: 'block',
                    }}
                  >
                    {children}
                  </span>
                </h2>
              )
            },
            h3: ({ children }) => (
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                lineHeight: 1.5,
                margin: '24px 0 24px',
                color: '#1a1a1a',
              }}>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p style={{
                fontSize: '17px',
                lineHeight: 1.65,
                margin: '0 0 20px',
                color: '#3f3f3f',
                textAlign: 'left',
                wordWrap: 'break-word',
              }}>
                {children}
              </p>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{
                position: 'relative',
                background: '#E8E8E8',
                borderRadius: '8px',
                padding: '48px 24px 12px 24px',
                margin: '16px 0 20px 0',
                color: '#666',
                fontSize: '16px',
                lineHeight: 1.75,
              }}>
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  left: '12px',
                  fontSize: '64px',
                  lineHeight: 1,
                  color: '#BBBBBB',
                  fontFamily: '"Songti SC", "SimSun", serif',
                }}>“</span>
                <div style={{ padding: '0 8px' }}>{children}</div>
                <span style={{
                  position: 'absolute',
                  bottom: '0px',
                  right: '12px',
                  fontSize: '64px',
                  lineHeight: 1,
                  color: '#BBBBBB',
                  fontFamily: '"Songti SC", "SimSun", serif',
                }}>”</span>
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul style={{
                fontSize: '17px',
                lineHeight: 1.65,
                margin: '0 0 20px',
                paddingLeft: '28px',
                color: '#3f3f3f',
              }}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol style={{
                fontSize: '17px',
                lineHeight: 1.65,
                margin: '0 0 20px',
                paddingLeft: '28px',
                color: '#2563eb',
              }}>
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li style={{ margin: '14px 0' }}>
                <span style={{ color: '#3f3f3f' }}>{children}</span>
              </li>
            ),
            code: ({ children }) => (
              <code style={{
                background: '#f4f4f4',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '14px',
                color: '#d63384',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              }}>
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre style={{
                background: '#f6f8fa',
                padding: '16px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '14px',
                lineHeight: 1.6,
                margin: '0 0 20px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              }}>
                {children}
              </pre>
            ),
            hr: () => (
              <hr style={{
                border: 'none',
                borderTop: '1px solid #e0e0e0',
                margin: '24px 0',
              }} />
            ),
            strong: ({ children }) => (
              <strong style={{ fontWeight: 'bold', color: '#2A5D95' }}>
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em style={{ fontStyle: 'italic', color: '#666' }}>
                {children}
              </em>
            ),
            a: ({ children, href }) => (
              <a href={href} style={{ color: '#576b95', textDecoration: 'none' }}>
                {children}
              </a>
            ),
            img: ({ src, alt }) => (
              <img src={src} alt={alt} style={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '4px',
                margin: '12px 0',
                display: 'block',
              }} />
            ),
            table: ({ children }) => (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: '20px',
                fontSize: '14px',
              }}>
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th style={{
                border: '1px solid #ddd',
                padding: '10px',
                background: '#f5f5f5',
                fontWeight: 'bold',
                textAlign: 'left',
              }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td style={{
                border: '1px solid #ddd',
                padding: '10px',
              }}>
                {children}
              </td>
            ),
            del: ({ children }) => (
              <del style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                {children}
              </del>
            ),
            mark: ({ children }) => (
              <mark style={{
                background: 'linear-gradient(to bottom, transparent 60%, #fed7aa 60%)',
                padding: '0 2px',
                color: '#1F2937',
              }}>
                {children}
              </mark>
            ),
          }}
        >
          {processedMarkdown}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export default WechatPreview
