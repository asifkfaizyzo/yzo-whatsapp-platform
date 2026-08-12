// src/components/automation/NodeConfigPanel.jsx

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useReactFlow } from "reactflow";

export default function NodeConfigPanel({ node, onUpdate, onClose }) {
  const { deleteElements } = useReactFlow();

  const [content, setContent] = useState("");
  const [saveAs, setSaveAs] = useState("");
  const [options, setOptions] = useState([]);
  const [assignType, setAssignType] = useState("auto");
  const [buttons, setButtons] = useState([]);

  useEffect(() => {
    if (!node) return;
    setContent(node.data?.content || "");
    setSaveAs(node.data?.options?.saveAs || "");
    // ✅ FIX: options is a plain array on node.data.options, NOT nested under .conditions
    const rawOptions = node.data?.options;
    setOptions(Array.isArray(rawOptions) ? rawOptions : []);
    setAssignType(node.data?.assign_type || "auto");

    // ⭐ Load buttons for INTERACTIVE_BUTTONS node
    if (node.type === "INTERACTIVE_BUTTONS") {
      const rawButtons = node.data?.options;
      setButtons(Array.isArray(rawButtons) ? rawButtons : []);
    }
  }, [node?.id]);

  const handleUpdate = () => {
    if (!node) return;
    let newData = { ...node.data };
    if (node.type === "SEND_MESSAGE") newData.content = content;
    if (node.type === "ASK_QUESTION") {
      newData.content = content;
      newData.options = { saveAs };
    }
    if (node.type === "CONDITION") newData.options = options;
    if (node.type === "ASSIGN_AGENT") {
      newData.assign_type = assignType;
    }
    // ⭐ NEW: Save buttons
    if (node.type === "INTERACTIVE_BUTTONS") {
      newData.content = content;
      newData.options = buttons;
    }

    onUpdate(node.id, newData);
  };

  // Delete node from config panel
  const handleDeleteNode = () => {
    deleteElements({ nodes: [{ id: node.id }] });
    onClose();
  };
  //Condition node options management
  const addOption = () => {
    setOptions([...options, { value: "", nextNodeId: "" }]);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index, value) => {
    const updated = [...options];
    updated[index].value = value;
    setOptions(updated);
  };

  if (!node) return null;

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
        {node.type === "SEND_MESSAGE" && (
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
        {node.type === "ASK_QUESTION" && (
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
        {node.type === "CONDITION" && (
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Branches
            </label>
            <p className="text-[10px] text-slate-400 mb-2">
              Each branch creates a separate output handle. Drag from the right
              side to connect each branch.
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
                    value={opt.value || ""}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[i].value = e.target.value;
                      setOptions(updated);
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
                        const updated = [...options];
                        updated[i].default = e.target.checked;
                        if (e.target.checked) updated[i].value = "";
                        setOptions(updated);
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
        {node.type === "ASSIGN_AGENT" && (
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

        {/* ⭐ INTERACTIVE_BUTTONS */}
        {node.type === "INTERACTIVE_BUTTONS" && (
          <div className="space-y-3">
            {/* Body message */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Message
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. How can we help you today?"
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-xl
          p-3 resize-none focus:outline-none
          focus:border-green-400 transition"
              />
            </div>

            {/* Buttons */}
            <div>
              {/* Label + counter */}
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">
                  Buttons
                </label>
                <span className="text-[10px] text-slate-400">
                  {buttons.length}/3 max
                </span>
              </div>

              {/* Info box */}
              <div className="bg-green-50 border border-green-100 rounded-lg p-2 mb-2">
                <p className="text-[10px] text-green-700">
                  💡 Max 3 buttons (WhatsApp limit). Drag from the green handle
                  on each button to connect to the next node.
                </p>
              </div>

              {/* Button list */}
              <div className="space-y-2">
                {buttons.map((btn, i) => (
                  <div
                    key={btn.id || i}
                    className="border border-green-200 rounded-lg p-2 bg-green-50"
                  >
                    {/* Button header */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-green-600">
                        Button {i + 1}
                      </span>
                      <button
                        onClick={() =>
                          setButtons(buttons.filter((_, idx) => idx !== i))
                        }
                        className="ml-auto p-1 text-red-400 hover:bg-red-50 rounded transition"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {/* Button title input */}
                    <input
                      value={btn.title || ""}
                      onChange={(e) => {
                        const updated = [...buttons];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setButtons(updated);
                      }}
                      placeholder="Button label (max 20 chars)"
                      maxLength={20}
                      className="w-full text-xs border border-green-200
                rounded-md p-1.5 focus:outline-none
                focus:border-green-400 bg-white transition"
                    />

                    {/* Character count + ID */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">
                        ID: {btn.id}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {(btn.title || "").length}/20
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add button */}
              {buttons.length < 3 && (
                <button
                  onClick={() => {
                    setButtons([
                      ...buttons,
                      {
                        id: `btn_${Date.now()}`,
                        title: "",
                        nextNodeId: null,
                      },
                    ]);
                  }}
                  className="mt-2 flex items-center gap-1.5 text-xs
            font-semibold text-green-600 hover:text-green-700 transition"
                >
                  <Plus size={13} />
                  Add Button
                </button>
              )}

              {/* Max reached warning */}
              {buttons.length === 3 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  ⚠️ Maximum 3 buttons reached
                </p>
              )}
            </div>
          </div>
        )}

        {/* END_FLOW */}
        {node.type === "END_FLOW" && (
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
        {node.type !== "END_FLOW" && (
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
  );
}
