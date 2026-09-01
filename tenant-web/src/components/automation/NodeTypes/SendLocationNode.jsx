// src/components/automation/NodeTypes/SendLocationNode.jsx

import { Handle, Position } from 'reactflow'
import { MapPin, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10,
  height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function SendLocationNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()
  const options = data.options || {}

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div
      className={`bg-white rounded-xl border-2 p-3 w-56 shadow-sm transition
        ${selected
          ? 'border-orange-500'
          : 'border-slate-200 hover:border-orange-300'
        }`}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-50">
            <MapPin size={13} className="text-orange-600" />
          </div>
          <span className="text-xs font-bold text-orange-600">
            Store Location Pin
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition"
        >
          <X size={12} />
        </button>
      </div>

      <div className="bg-orange-50/70 border border-orange-100 rounded-lg p-2 mb-2">
        <p className="text-xs font-bold text-slate-800 truncate">
          {options.storeName || 'Store Location'}
        </p>
        <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
          {options.address || data.content || 'Click to configure address...'}
        </p>
      </div>

      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  )
}
