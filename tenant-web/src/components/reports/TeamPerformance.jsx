// tenant-web/src/components/reports/TeamPerformance.jsx

import React from "react";
import { Users, Award, Star } from "lucide-react";

export default function TeamPerformance({ summary = {}, leaderboard = [] }) {
  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 border border-amber-300">🥇 #1</span>;
    if (rank === 2) return <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 border border-slate-300">🥈 #2</span>;
    if (rank === 3) return <span className="bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 border border-amber-200">🥉 #3</span>;
    return <span className="text-slate-400 font-bold text-xs pl-2">#{rank}</span>;
  };

  return (
    <div className="card border border-slate-200 bg-white rounded-xl shadow-xs p-6 space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Users size={18} className="text-[#125EF2]" />
          <span>Team & Agent Performance</span>
        </h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          First response time (FRT), resolution time (ART), and ticket volumes per agent
        </p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
        <div className="text-center border-r border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversations</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">
            {(summary.totalConversations || 0).toLocaleString()}
          </div>
        </div>
        <div className="text-center border-r border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resolved</span>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">
            {(summary.resolvedConversations || 0).toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Messages</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">
            {(summary.totalMessages || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Agent Leaderboard Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Agent Name</th>
              <th className="py-2.5 px-3">Conversations</th>
              <th className="py-2.5 px-3">Resolved</th>
              <th className="py-2.5 px-3">Avg FRT</th>
              <th className="py-2.5 px-3">Avg ART</th>
              <th className="py-2.5 px-3">CSAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">
                  No agent activity logged for selected period
                </td>
              </tr>
            ) : (
              leaderboard.map((row) => (
                <tr key={row.agentId} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-3">{getRankBadge(row.rank)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#125EF2]/10 text-[#125EF2] font-bold flex items-center justify-center text-xs">
                        {row.avatarInitial}
                      </div>
                      <span className="font-bold text-slate-800">{row.agentName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">{row.conversations}</td>
                  <td className="py-3 px-3 font-semibold text-emerald-600">{row.resolved}</td>
                  <td className="py-3 px-3 font-medium text-slate-600">{row.frt}</td>
                  <td className="py-3 px-3 font-medium text-slate-600">{row.art}</td>
                  <td className="py-3 px-3 text-slate-400 font-medium flex items-center gap-1">
                    <Star size={12} className="text-slate-300" />
                    <span>{row.csat}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}