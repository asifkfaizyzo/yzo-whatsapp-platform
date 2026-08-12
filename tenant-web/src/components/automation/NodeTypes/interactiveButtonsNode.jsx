// src/components/automation/NodeTypes/InteractiveButtonsNode.jsx

import { Handle, Position } from 'reactflow'
import { MousePointerClick, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10,
  height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function InteractiveButtonsNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()

  const buttons = Array.isArray(data.options) ? data.options : []

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div
      className={`bg-white rounded-xl border-2 p-3 w-56 shadow-sm transition
        ${selected
          ? 'border-green-500'
          : 'border-slate-200 hover:border-green-400'
        }`}
    >
      {/* Input handle - LEFT */}
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-green-50">
            <MousePointerClick size={13} className="text-green-600" />
          </div>
          <span className="text-xs font-bold text-green-600">
            Buttons
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 rounded-md hover:bg-red-50
            text-slate-300 hover:text-red-500 transition"
        >
          <X size={12} />
        </button>
      </div>

      {/* Body text preview */}
      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mb-2 line-clamp-2">
        {data.content || 'Click to add message...'}
      </p>

      {/* Buttons with individual handles */}
      {buttons.length > 0 ? (
        <div className="space-y-1.5 relative">
          {buttons.map((btn, i) => (
            <div
              key={btn.id || i}
              className="relative flex items-center justify-between
                bg-green-50 border border-green-200 rounded-lg
                px-2 py-1.5 pr-4"
            >
              <span className="text-[11px] font-semibold text-green-700 truncate">
                {btn.title || `Button ${i + 1}`}
              </span>

              {/* ⭐ Each button has its own source handle */}
              <Handle
                id={btn.id}
                type="source"
                position={Position.Right}
                style={{
                  ...handleStyle,
                  right: -14,
                  top: '50%',
                  background: '#16a34a'
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2">
          Click to add buttons...
        </p>
      )}
    </div>
  )
}