// src/components/automation/NodeTypes/SendMessageNode.jsx

import { Handle, Position } from 'reactflow'
import { MessageSquare, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10, height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function SendMessageNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div className={`bg-white rounded-xl border-2 p-3 w-56 shadow-sm transition
      ${selected
        ? 'border-[#125EF2]'
        : 'border-slate-200 hover:border-blue-300'
      }`}
    >
    <Handle type="target" position={Position.Left} style={handleStyle} />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#EAF2FE]">
            <MessageSquare size={13} className="text-[#125EF2]" />
          </div>
          <span className="text-xs font-bold text-[#125EF2]">
            Send Message
          </span>
        </div>
        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className="p-1 rounded-md hover:bg-red-50 
            text-slate-300 hover:text-red-500 transition"
        >
          <X size={12} />
        </button>
      </div>

      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 line-clamp-2">
        {data.content || 'Click to add message...'}
      </p>

      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  )
}