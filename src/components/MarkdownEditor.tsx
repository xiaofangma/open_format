import { forwardRef, type ClipboardEvent } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void
}

const MarkdownEditor = forwardRef<HTMLTextAreaElement, Props>(
  ({ value, onChange, onPaste }, ref) => {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        onKeyDown={(e) => {
          // 阻止剪切快捷键冒泡，防止触发浏览器后退等行为
          if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X')) {
            e.stopPropagation()
          }
        }}
        onCut={(e) => e.stopPropagation()}
        className="flex-1 w-full p-4 text-sm font-mono leading-relaxed resize-none focus:outline-none bg-white text-gray-800"
        placeholder="在此粘贴 Markdown 内容..."
        spellCheck={false}
      />
    )
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'

export default MarkdownEditor
