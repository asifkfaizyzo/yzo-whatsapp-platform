// src/components/automation/NodeTypes/CatalogNode.jsx

import { Handle, Position } from 'reactflow'
import { ShoppingBag, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10,
  height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function CatalogNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div
      className={`bg-white rounded-xl border-2 p-3 w-56 shadow-sm transition
        ${selected
          ? 'border-indigo-500'
          : 'border-slate-200 hover:border-indigo-300'
        }`}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50">
            <ShoppingBag size={13} className="text-indigo-600" />
          </div>
          <span className="text-xs font-bold text-indigo-600">
            Send Catalog
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition"
        >
          <X size={12} />
        </button>
      </div>

      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mb-2 line-clamp-2">
        {data.content || 'Browse our catalog below...'}
      </p>

      <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg py-1.5 px-2 text-center">
        <span className="text-[11px] font-bold text-indigo-700">
          🛍️ View Catalog
        </span>
      </div>

      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  )
}
