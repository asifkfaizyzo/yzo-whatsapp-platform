// src/components/automation/NodeTypes/EndFlowNode.jsx

import { Handle, Position } from 'reactflow'
import { StopCircle, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10, height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function EndFlowNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div className={`bg-white rounded-xl border-2 p-3 w-44 shadow-sm transition
      ${selected
        ? 'border-red-400'
        : 'border-slate-200 hover:border-red-300'
      }`}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-50">
            <StopCircle size={13} className="text-red-500" />
          </div>
          <span className="text-xs font-bold text-red-500">
            End Flow
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
    </div>
  )
}