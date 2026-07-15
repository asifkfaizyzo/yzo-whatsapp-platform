// src/components/automation/NodeTypes/AssignAgentNode.jsx

import { Handle, Position } from 'reactflow'
import { UserCheck, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10, height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function AssignAgentNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div className={`bg-white rounded-xl border-2 p-3 w-56 shadow-sm transition
      ${selected
        ? 'border-emerald-400'
        : 'border-slate-200 hover:border-emerald-300'
      }`}
    >
      {/* ✅ Input handle - LEFT (horizontal flow) */}
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50">
            <UserCheck size={13} className="text-emerald-500" />
          </div>
          <span className="text-xs font-bold text-emerald-500">
            Assign Agent
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

      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
        {data.assign_type === 'specific'
          ? `Agent: ${data.agent_name || 'Not set'}`
          : '🔄 Auto (Round Robin)'
        }
      </p>

      {/* ✅ NEW — Output handle - RIGHT (horizontal flow) */}
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
      />
    </div>
  )
}