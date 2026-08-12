// src/components/automation/NodeTypes/ConditionNode.jsx

import { Handle, Position } from 'reactflow'
import { GitBranch, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10, height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function ConditionNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()
  const options = data.options || []

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div className={`bg-white rounded-xl border-2 p-3 w-56 shadow-sm transition relative
      ${selected
        ? 'border-purple-400'
        : 'border-slate-200 hover:border-purple-300'
      }`}
    >
      {/* ✅ Target handle on LEFT (horizontal flow) */}
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-50">
            <GitBranch size={13} className="text-purple-500" />
          </div>
          <span className="text-xs font-bold text-purple-500">
            Condition
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

      {/* ✅ Each option has its own handle on RIGHT */}
      {options.length > 0 ? (
        <div className="space-y-1.5 relative">
          {options.map((opt, i) => (
            <div
              key={i}
              className="relative text-[11px] px-2 py-1.5 rounded-lg pr-3"
              style={{
                background: opt.default ? '#FEF3C7' : '#F3E8FF',
                color:      opt.default ? '#92400E' : '#6B21A8'
              }}
            >
              {opt.default
                ? '↳ Else (default)'
                : `If: ${opt.value || '(empty)'}`
              }

              {/* Handle per option — right side */}
              <Handle
                id={`option-${i}`}
                type="source"
                position={Position.Right}
                style={{
                  ...handleStyle,
                  right: -14,
                  top:   '50%',
                  background: opt.default ? '#f59e0b' : '#a855f7'
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2">
          Click to add branches...
        </p>
      )}
    </div>
  )
}