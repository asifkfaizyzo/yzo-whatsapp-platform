// src/components/automation/NodeConfigPanel.jsx

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useReactFlow } from 'reactflow'

export default function NodeConfigPanel({ node, onUpdate, onClose }) {
  const { deleteElements } = useReactFlow()

  const [content, setContent]       = useState('')
  const [saveAs, setSaveAs]         = useState('')
  const [options, setOptions]       = useState([])
  const [assignType, setAssignType] = useState('auto')

  useEffect(() => {
    if (!node) return
    setContent(node.data?.content || '')
    setSaveAs(node.data?.options?.saveAs || '')
    setOptions(node.data?.options?.conditions || [])
    setAssignType(node.data?.assign_type || 'auto')
  }, [node?.id])

  const handleUpdate = () => {
    if (!node) return
    let newData = { ...node.data }
    if (node.type === 'SEND_MESSAGE') newData.content = content
    if (node.type === 'ASK_QUESTION') {
      newData.content = content
      newData.options = { saveAs }
    }
    if (node.type === 'CONDITION')    newData.options = options
    if (node.type === 'ASSIGN_AGENT') newData.assign_type = assignType
    onUpdate(node.id, newData)
  }

  // Delete node from config panel
  const handleDeleteNode = () => {
    deleteElements({ nodes: [{ id: node.id }] })
    onClose()
  }

  const addOption = () => {
    setOptions([...options, { value: '', nextNodeId: '' }])
  }

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index, value) => {
    const updated = [...options]
    updated[index].value = value
    setOptions(updated)
  }

  if (!node) return null

  return (
    <div className="w-64 bg-white border-l border-slate-100 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-700">Configure Node</p>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 
            text-slate-400 transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Config Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">

        {/* SEND_MESSAGE */}
        {node.type === 'SEND_MESSAGE' && (
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Message
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              rows={5}
              className="w-full text-sm border border-slate-200 rounded-xl 
                p-3 resize-none focus:outline-none 
                focus:border-[#125EF2] transition"
            />
          </div>
        )}

        {/* ASK_QUESTION */}
        {node.type === 'ASK_QUESTION' && (
          <>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Question
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your question..."
                rows={4}
                className="w-full text-sm border border-slate-200 rounded-xl 
                  p-3 resize-none focus:outline-none 
                  focus:border-amber-400 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Save answer as
              </label>
              <input
                value={saveAs}
                onChange={(e) => setSaveAs(e.target.value)}
                placeholder="e.g. customer_name"
                className="w-full text-sm border border-slate-200 rounded-xl 
                  p-2.5 focus:outline-none focus:border-amber-400 transition"
              />
            </div>
          </>
        )}

        {/* CONDITION */}
        {/* CONDITION Config */}
{node.type === 'CONDITION' && (
  <div>
    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
      Branches
    </label>
    <p className="text-[10px] text-slate-400 mb-2">
      Each branch creates a separate output handle.
      Drag from the right side to connect each branch.
    </p>

    <div className="space-y-2">
      {options.map((opt, i) => (
        <div
          key={i}
          className="border border-slate-200 rounded-lg p-2 bg-slate-50"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-purple-500">
              Branch {i + 1}
            </span>
            <button
              onClick={() => removeOption(i)}
              className="ml-auto p-1 text-red-400 hover:bg-red-50 rounded transition"
            >
              <Trash2 size={11} />
            </button>
          </div>

          {/* Value input */}
          <input
            value={opt.value || ''}
            onChange={(e) => {
              const updated = [...options]
              updated[i].value = e.target.value
              setOptions(updated)
            }}
            placeholder="e.g. valid_order, ORD*, yes"
            disabled={opt.default}
            className="w-full text-xs border border-slate-200 rounded-md
              p-1.5 focus:outline-none focus:border-purple-400 transition
              disabled:bg-slate-100 disabled:text-slate-400"
          />

          {/* Default checkbox */}
          <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={opt.default || false}
              onChange={(e) => {
                const updated = [...options]
                updated[i].default = e.target.checked
                if (e.target.checked) updated[i].value = ''
                setOptions(updated)
              }}
              className="w-3 h-3"
            />
            <span className="text-[10px] text-slate-500">
              Else / Default branch
            </span>
          </label>
        </div>
      ))}
    </div>

    <button
      onClick={addOption}
      className="mt-2 flex items-center gap-1.5 text-xs
        font-semibold text-purple-500 hover:text-purple-700 transition"
    >
      <Plus size={13} />
      Add Branch
    </button>
  </div>
)}

        {/* ASSIGN_AGENT */}
        {node.type === 'ASSIGN_AGENT' && (
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Assignment Type
            </label>
            <select
              value={assignType}
              onChange={(e) => setAssignType(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl 
                p-2.5 focus:outline-none focus:border-emerald-400 transition"
            >
              <option value="auto">Auto (Round Robin)</option>
              <option value="specific">Specific Agent</option>
            </select>
          </div>
        )}

        {/* END_FLOW */}
        {node.type === 'END_FLOW' && (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400">No configuration needed.</p>
            <p className="text-xs text-slate-400 mt-1">
              This node ends the flow.
            </p>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="p-4 border-t border-slate-100 space-y-2">

        {/* Update Button */}
        {node.type !== 'END_FLOW' && (
          <button
            onClick={handleUpdate}
            className="w-full py-2.5 bg-[#125EF2] text-white text-sm 
              font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Update Node
          </button>
        )}

        {/* Delete Node Button */}
        <button
          onClick={handleDeleteNode}
          className="w-full py-2.5 bg-red-50 border border-red-100 
            text-red-500 text-sm font-semibold rounded-xl 
            hover:bg-red-100 transition flex items-center 
            justify-center gap-2"
        >
          <Trash2 size={14} />
          Delete Node
        </button>
      </div>
    </div>
  )
}