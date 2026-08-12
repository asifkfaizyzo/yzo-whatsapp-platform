// src/components/automation/NodePanel.jsx

import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  UserCheck,
  StopCircle,
  MousePointerClick,
} from 'lucide-react'

const nodeTypes = [
  {
    type: 'SEND_MESSAGE',
    label: 'Send Message',
    description: 'Send a text message',
    icon: <MessageSquare size={16} className="text-[#125EF2]" />,
    bg: 'bg-[#EAF2FE]',
    border: 'border-[#CFE0FD]',
  },
  {
    type: 'ASK_QUESTION',
    label: 'Ask Question',
    description: 'Wait for user reply',
    icon: <HelpCircle size={16} className="text-amber-500" />,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    type: 'CONDITION',
    label: 'Condition',
    description: 'Branch by reply',
    icon: <GitBranch size={16} className="text-purple-500" />,
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
   {
    type: 'INTERACTIVE_BUTTONS',
    label: 'Buttons',
    description: 'Show reply buttons',
    icon: <MousePointerClick size={16} className="text-green-600" />,
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  {
    type: 'ASSIGN_AGENT',
    label: 'Assign Agent',
    description: 'Hand off to human',
    icon: <UserCheck size={16} className="text-emerald-500" />,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    type: 'END_FLOW',
    label: 'End Flow',
    description: 'Stop automation',
    icon: <StopCircle size={16} className="text-red-500" />,
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
]

export default function NodePanel() {

  const onDragStart = (e, type) => {
    e.dataTransfer.setData('nodeType', type)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-52 bg-white border-r border-slate-100 flex flex-col">

      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Drag Nodes
        </p>
      </div>

      {/* Node List */}
      <div className="p-3 space-y-2 overflow-y-auto flex-1">
        {nodeTypes.map(node => (
          <div
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
            className={`
              flex items-center gap-3 p-3 rounded-xl border
              cursor-grab active:cursor-grabbing
              hover:shadow-sm transition
              ${node.bg} ${node.border}
            `}
          >
            <div className="shrink-0">{node.icon}</div>
            <div>
              <p className="text-xs font-bold text-slate-700">
                {node.label}
              </p>
              <p className="text-[10px] text-slate-400">
                {node.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Tip */}
      <div className="p-3 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 text-center">
          Drag nodes to canvas
        </p>
      </div>
    </div>
  )
}