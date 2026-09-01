// src/pages/dashboard/FlowBuilder.jsx

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MiniMap,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

import { ArrowLeft, Save, Loader2 } from "lucide-react";

import NodePanel from "../../components/automation/NodePanel";
import NodeConfigPanel from "../../components/automation/NodeConfigPanel";
import SendMessageNode from "../../components/automation/NodeTypes/sendMessageNode";
import AskQuestionNode from "../../components/automation/NodeTypes/AskQuestionNode";
import ConditionNode from "../../components/automation/NodeTypes/ConditionNode";
import AssignAgentNode from "../../components/automation/NodeTypes/AssignAgentNode";
import EndFlowNode from "../../components/automation/NodeTypes/EndFlowNode";
import flowService from "../../services/flow.service";
import InteractiveButtonsNode from "../../components/automation/NodeTypes/interactiveButtonsNode";
import CatalogNode from "../../components/automation/NodeTypes/CatalogNode";
import AskLocationNode from "../../components/automation/NodeTypes/AskLocationNode";
import SendLocationNode from "../../components/automation/NodeTypes/SendLocationNode";
import { getWhatsappStatus } from "../../services/tenant.service";
import { useToast } from "../../context/ToastContext";

// Register node types
const nodeTypes = {
  SEND_MESSAGE: SendMessageNode,
  ASK_QUESTION: AskQuestionNode,
  CONDITION: ConditionNode,
  ASSIGN_AGENT: AssignAgentNode,
  END_FLOW: EndFlowNode,
  INTERACTIVE_BUTTONS: InteractiveButtonsNode,
  SEND_CATALOG: CatalogNode,
  ASK_LOCATION: AskLocationNode,
  SEND_LOCATION: SendLocationNode,
};

function FlowBuilderInner() {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  const toast = useToast();
  const [whatsappChecked, setWhatsappChecked] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [flowName, setFlowName] = useState("New Flow");
  const [triggerType, setTriggerType] = useState("KEYWORD");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccessAndLoad();
  }, [flowId]);

  // ✅ Guard: Check WhatsApp before loading builder
  const checkAccessAndLoad = async () => {
    const statusRes = await getWhatsappStatus();
    if (statusRes.success && !statusRes.data?.isConnected) {
      toast.error("Please connect WhatsApp before editing automation flows.");
      navigate("/dashboard/automation");
      return;
    }
    setWhatsappChecked(true);
    loadFlow();
  };

  const loadFlow = async () => {
    try {
      setLoading(true);
      const res = await flowService.getFlow(flowId);
      const flow = res.data;

      setFlowName(flow.name);
      setTriggerType(flow.triggerType || "KEYWORD");

      if (flow.nodes && flow.nodes.length > 0) {
        // Convert DB nodes to React Flow format
        const rfNodes = flow.nodes.map((node) => {
          let nodeOptions = node.options || null;
          let nodeMedia = null;

          // For INTERACTIVE_BUTTONS, handle both array options & { buttons, media } options
          if (node.type === "INTERACTIVE_BUTTONS") {
            if (
              node.options &&
              !Array.isArray(node.options) &&
              node.options.buttons
            ) {
              nodeOptions = node.options.buttons;
              nodeMedia = node.options.media || null;
            }
          }

          return {
            id: node.id,
            type: node.type,
            position: node.position || { x: 100, y: 100 },
            data: {
              content: node.content || "",
              options: nodeOptions,
              media: nodeMedia || node.data?.media || null,
              assign_type: node.options?.assign_type || "auto",
            },
          };
        });
        setNodes(rfNodes);

        // ✅ Build edges — handle CONDITION options separately
        const rfEdges = [];

        flow.nodes.forEach((node) => {
          // Simple next node (SEND_MESSAGE, ASK_QUESTION, ASSIGN_AGENT)
          if (node.nextNodeId && node.type !== "CONDITION") {
            rfEdges.push({
              id: `e_${node.id}_${node.nextNodeId}`,
              source: node.id,
              target: node.nextNodeId,
              animated: true,
              style: { stroke: "#94a3b8", strokeWidth: 2 },
            });
          }

          // ✅ CONDITION — one edge per option
          if (node.type === "CONDITION" && Array.isArray(node.options)) {
            node.options.forEach((opt, i) => {
              if (opt.nextNodeId) {
                rfEdges.push({
                  id: `e_${node.id}_opt${i}_${opt.nextNodeId}`,
                  source: node.id,
                  sourceHandle: `option-${i}`,
                  target: opt.nextNodeId,
                  animated: true,
                  style: {
                    stroke: opt.default ? "#f59e0b" : "#a855f7",
                    strokeWidth: 2,
                  },
                });
              }
            });
          }

          // ✅ CONDITION — one edge per option
          if (node.type === "CONDITION" && Array.isArray(node.options)) {
            node.options.forEach((opt, i) => {
              if (opt.nextNodeId) {
                rfEdges.push({
                  id: `e_${node.id}_opt${i}_${opt.nextNodeId}`,
                  source: node.id,
                  sourceHandle: `option-${i}`,
                  target: opt.nextNodeId,
                  animated: true,
                  style: {
                    stroke: opt.default ? "#f59e0b" : "#a855f7",
                    strokeWidth: 2,
                  },
                });
              }
            });
          }

          // ⭐ ADD: INTERACTIVE_BUTTONS — one edge per button
          if (node.type === "INTERACTIVE_BUTTONS") {
            const buttonList = Array.isArray(node.options)
              ? node.options
              : node.options?.buttons || [];

            buttonList.forEach((btn) => {
              if (btn.nextNodeId) {
                rfEdges.push({
                  id: `e_${node.id}_${btn.id}_${btn.nextNodeId}`,
                  source: node.id,
                  sourceHandle: btn.id,
                  target: btn.nextNodeId,
                  animated: true,
                  style: {
                    stroke: "#16a34a",
                    strokeWidth: 2,
                  },
                });
              }
            });
          }
        });

        setEdges(rfEdges);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load flow");
    } finally {
      setLoading(false);
    }
  };

  // Connect two nodes with an edge
  const onConnect = useCallback(
    (params) => {
      console.log("🔗 Connection:", params);
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `e_${params.source}_${params.sourceHandle || "main"}_${params.target}`,
            animated: true,
            style: { stroke: "#94a3b8", strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  // Drop node onto canvas
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData("nodeType");
    if (!nodeType) return;

    const bounds = wrapperRef.current.getBoundingClientRect();
    const position = {
      x: e.clientX - bounds.left - 80,
      y: e.clientY - bounds.top - 40,
    };

    // ✅ Default options for CONDITION
    const defaultData = { content: "", options: null };
    if (nodeType === "CONDITION") {
      defaultData.options = [
        { value: "", default: false },
        { value: "", default: true },
      ];
    }

    // ⭐ ADD THIS: Default buttons for INTERACTIVE_BUTTONS
    if (nodeType === "INTERACTIVE_BUTTONS") {
      defaultData.options = [
        { id: `btn_${Date.now()}_1`, title: "" },
        { id: `btn_${Date.now()}_2`, title: "" },
      ];
    }

    const newNode = {
      id: `${nodeType}_${Date.now()}`,
      type: nodeType,
      position,
      data: defaultData,
    };

    setNodes((nds) => [...nds, newNode]);
  }, []);

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onNodeClick = (_, node) => {
    setSelectedNode(node);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  const updateNodeData = (nodeId, newData) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n,
      ),
    );
    setSelectedNode((prev) =>
      prev?.id === nodeId
        ? { ...prev, data: { ...prev.data, ...newData } }
        : prev,
    );
  };

  // ✅ Save flow — handle CONDITION multi-branch edges
  const handleSave = async () => {
    try {
      setSaving(true);

      const processedNodes = nodes.map((node) => {
        // ── CONDITION: embed nextNodeId per option ──
        if (node.type === "CONDITION") {
          const options = node.data?.options || [];
          const updatedOptions = options.map((opt, i) => {
            const edge = edges.find(
              (e) => e.source === node.id && e.sourceHandle === `option-${i}`,
            );
            return {
              ...opt,
              nextNodeId: edge?.target || null,
            };
          });
          return {
            ...node,
            data: { ...node.data, options: updatedOptions },
          };
        }

        // ⭐ INTERACTIVE_BUTTONS: embed nextNodeId per button & attach media
        if (node.type === "INTERACTIVE_BUTTONS") {
          const rawButtons = Array.isArray(node.data?.options)
            ? node.data.options
            : node.data?.options?.buttons || [];

          const updatedButtons = rawButtons.map((btn) => {
            const edge = edges.find(
              (e) => e.source === node.id && e.sourceHandle === btn.id,
            );
            return {
              ...btn,
              nextNodeId: edge?.target || null,
            };
          });

          const mediaObj = node.data?.media || null;

          return {
            ...node,
            data: {
              ...node.data,
              options: {
                buttons: updatedButtons,
                media: mediaObj,
              },
            },
          };
        }

        return node;
      });

      await flowService.saveFlow(flowId, {
        name: flowName,
        triggerType,
        nodes: processedNodes,
        edges,
      });

      // ✅ CHANGED: alert → toast
      toast.success("Flow saved successfully!");
    } catch (err) {
      console.error(err);
      // ✅ CHANGED: alert → toast
      toast.error(err?.response?.data?.message || "Failed to save flow");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-[#125EF2]" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-4 shrink-0 z-10">
        <button
          onClick={() => navigate("/dashboard/automation")}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-3">
          <input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="text-lg font-bold text-slate-800 border-none outline-none bg-transparent"
          />

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Trigger:
            </span>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#125EF2]"
            >
              <option value="KEYWORD">🔑 Keyword Match</option>
              <option value="ORDER_RECEIVED">🛍️ On Order Received</option>
              <option value="DEFAULT">⚡ Default / Fallback</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#125EF2] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {saving ? "Saving..." : "Save Flow"}
        </button>
      </div>

      {/* ── Main Area ── */}
      <div className="flex flex-1 overflow-hidden">
        <NodePanel />

        <div
          className="flex-1"
          ref={wrapperRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            connectionLineStyle={{ stroke: "#94a3b8", strokeWidth: 2 }}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "#94a3b8", strokeWidth: 2 },
            }}
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === "SEND_MESSAGE") return "#125EF2";
                if (n.type === "ASK_QUESTION") return "#f59e0b";
                if (n.type === "CONDITION") return "#a855f7";
                if (n.type === "ASSIGN_AGENT") return "#10b981";
                if (n.type === "END_FLOW") return "#ef4444";
                if (n.type === "INTERACTIVE_BUTTONS") return "#16a34a";
                return "#94a3b8";
              }}
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

// ✅ Wrap with provider to use useReactFlow inside nodes
export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
}
