// src/components/automation/NodeTypes/AskQuestionNode.jsx

import { Handle, Position } from 'reactflow'
import { HelpCircle, X } from 'lucide-react'
import { useReactFlow } from 'reactflow'

const handleStyle = {
  width: 10, height: 10,
  background: '#94a3b8',
  border: '2px solid white',
}

export default function AskQuestionNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow()

  const handleDelete = (e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  return (
    <div className={`bg-white rounded-xl border-2 p-3 w-56 shadow-sm transition
      ${selected
        ? 'border-amber-400'
        : 'border-slate-200 hover:border-amber-300'
      }`}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50">
            <HelpCircle size={13} className="text-amber-500" />
          </div>
          <span className="text-xs font-bold text-amber-500">
            Ask Question
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

      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 line-clamp-2">
        {data.content || 'Click to add question...'}
      </p>

      {data.options?.saveAs && (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[10px] text-slate-400">Saves as:</span>
          <span className="text-[10px] font-semibold text-amber-500">
            {data.options.saveAs}
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  )
}