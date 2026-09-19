// src/components/automation/NodeTypes/PaymentNode.jsx
import { Handle, Position } from 'reactflow';
import { CreditCard, X } from 'lucide-react';
import { useReactFlow } from 'reactflow';

const handleStyle = {
  width: 10,
  height: 10,
  background: '#10b981',
  border: '2px solid white',
};

export default function PaymentNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow();

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className={`bg-white rounded-xl border-2 p-3 w-60 shadow-sm transition
        ${selected ? 'border-emerald-500 shadow-md ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'}`}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50">
            <CreditCard size={13} className="text-emerald-600" />
          </div>
          <span className="text-xs font-bold text-emerald-700">
            Razorpay Payment
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
        {data.content || 'Please complete your payment using the button below:'}
      </p>

      <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg py-1.5 px-2.5 text-center flex items-center justify-center gap-1.5">
        <CreditCard size={11} className="text-emerald-700" />
        <span className="text-[11px] font-bold text-emerald-800">
          💳 Pay Now (CTA Button)
        </span>
      </div>

      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}
