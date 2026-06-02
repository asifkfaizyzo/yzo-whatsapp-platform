// src/pages/dashboard/Inbox.jsx

import React, { useState } from "react";
import { 
  Search, 
  Send, 
  Paperclip, 
  Smile, 
  User, 
  Phone, 
  Tag, 
  Clock, 
  Check, 
  CheckCheck,
  MoreVertical
} from "lucide-react";

export default function Inbox() {
  const initialChats = [
    {
      id: 1,
      name: "Riya Patel",
      phone: "+91 98765 43210",
      status: "online",
      tag: "Interested in pricing",
      tagColor: "bg-emerald-50 text-emerald-700 border-emerald-100",
      avatarBg: "bg-emerald-100 text-emerald-800",
      time: "11:45 AM",
      unread: 1,
      messages: [
        { id: 1, text: "Hi, can you share your pricing plans?", sender: "contact", time: "11:40 AM", status: "read" },
        { id: 2, text: "Sure — we have Starter, Growth, and Enterprise plans.", sender: "agent", time: "11:42 AM", status: "read" },
        { id: 3, text: "Great. Can I book a quick demo?", sender: "contact", time: "11:45 AM", status: "sent" },
      ],
    },
    {
      id: 2,
      name: "David Lee",
      phone: "+1 (555) 019-2834",
      status: "offline",
      tag: "Lead",
      tagColor: "bg-blue-50 text-blue-700 border-blue-100",
      avatarBg: "bg-blue-100 text-blue-800",
      time: "10:12 AM",
      unread: 0,
      messages: [
        { id: 1, text: "Hello! I need support with integrations.", sender: "contact", time: "10:05 AM", status: "read" },
        { id: 2, text: "Our integration docs are located at docs.yzo.com. Let me know if that helps!", sender: "agent", time: "10:10 AM", status: "read" },
        { id: 3, text: "Thanks, looking into it now.", sender: "contact", time: "10:12 AM", status: "read" },
      ],
    },
    {
      id: 3,
      name: "Acme Sales (Emma)",
      phone: "+44 20 7946 0958",
      status: "online",
      tag: "Enterprise",
      tagColor: "bg-purple-50 text-purple-700 border-purple-100",
      avatarBg: "bg-purple-100 text-purple-800",
      time: "Yesterday",
      unread: 0,
      messages: [
        { id: 1, text: "We need 50 agent seats. Can we get a custom contract?", sender: "contact", time: "3:40 PM", status: "read" },
        { id: 2, text: "Yes absolutely. Let me connect you to our Account Executive.", sender: "agent", time: "3:45 PM", status: "read" },
      ],
    },
  ];

  const [chats, setChats] = useState(initialChats);
  const [activeChatId, setActiveChatId] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typedMessage, setTypedMessage] = useState("");

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    const newMessage = {
      id: activeChat.messages.length + 1,
      text: typedMessage,
      sender: "agent",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    // Update active chat messages
    const updatedChats = chats.map((c) => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          unread: 0,
          time: newMessage.time,
          messages: [...c.messages, newMessage],
        };
      }
      return c;
    });

    setChats(updatedChats);
    setTypedMessage("");

    // Simulate automatic contact reply after 1.5 seconds for visual wow factor!
    setTimeout(() => {
      const automaticReply = {
        id: newMessage.id + 1,
        text: `Thanks for the quick reply! I'm evaluating this in real-time.`,
        sender: "contact",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setChats((prevChats) =>
        prevChats.map((c) => {
          if (c.id === activeChat.id) {
            return {
              ...c,
              unread: 1,
              time: automaticReply.time,
              messages: [...c.messages, automaticReply],
            };
          }
          return c;
        })
      );
    }, 1500);
  };

  const filteredChats = chats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="h-[calc(100vh-130px)] flex border border-slate-100 rounded-3xl bg-white shadow-sm overflow-hidden animate-in fade-in duration-200">
      {/* ── Left Sidebar (Conversations List) ── */}
      <div className="w-80 border-r border-slate-100 flex flex-col shrink-0">
        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search chat or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-2.5"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filteredChats.map((chat) => {
            const lastMsg = chat.messages[chat.messages.length - 1];
            const isActive = chat.id === activeChatId;

            return (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  // Clear unread count on click
                  setChats(chats.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
                }}
                className={`w-full text-left p-4 flex items-start gap-3.5 transition duration-150 ${
                  isActive ? "bg-slate-50" : "hover:bg-slate-50/40"
                }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${chat.avatarBg}`}>
                  {chat.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-sm truncate">{chat.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{chat.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1">
                    {lastMsg ? lastMsg.text : "No messages yet"}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border ${chat.tagColor}`}>
                      {chat.tag}
                    </span>
                    {chat.unread > 0 && (
                      <span className="bg-emerald-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredChats.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-8">No chats found</p>
          )}
        </div>
      </div>

      {/* ── Middle Chat Area ── */}
      <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">
        {/* Chat Header */}
        <div className="bg-white px-6 py-3 border-b border-slate-100 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${activeChat.avatarBg}`}>
              {activeChat.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">{activeChat.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${activeChat.status === "online" ? "bg-emerald-500" : "bg-slate-400"}`} />
                <span className="text-[10px] text-slate-400 font-medium capitalize">{activeChat.status}</span>
              </div>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-50">
            <MoreVertical size={18} />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {activeChat.messages.map((msg) => {
            const isAgent = msg.sender === "agent";
            return (
              <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm border flex flex-col ${
                  isAgent
                    ? "bg-emerald-600 border-emerald-700 text-white rounded-tr-none"
                    : "bg-white border-slate-100 text-slate-800 rounded-tl-none"
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <div className={`mt-1 flex items-center gap-1 self-end text-[10px] ${
                    isAgent ? "text-emerald-100" : "text-slate-400"
                  }`}>
                    <span>{msg.time}</span>
                    {isAgent && (
                      msg.status === "read" ? <CheckCheck size={12} /> : <Check size={12} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="bg-white p-4 border-t border-slate-100 flex items-center gap-3 shrink-0 relative z-10">
          <button type="button" className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition">
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            placeholder="Type a message..."
            value={typedMessage}
            onChange={(e) => setTypedMessage(e.target.value)}
            className="input py-2 px-4"
          />
          <button type="button" className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition">
            <Smile size={18} />
          </button>
          <button type="submit" className="btn-primary w-11 h-11 p-0 rounded-xl shrink-0 flex items-center justify-center shadow-sm">
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* ── Right Panel (Contact Detail Context) ── */}
      <div className="w-72 border-l border-slate-100 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg mb-3 ${activeChat.avatarBg}`}>
            {activeChat.name.charAt(0)}
          </div>
          <h3 className="font-bold text-slate-800 text-base leading-none">{activeChat.name}</h3>
          <p className="text-xs text-slate-400 mt-1">{activeChat.phone}</p>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Phone size={13} />
              <span>Contact Info</span>
            </div>
            <p className="text-xs font-semibold text-slate-700">Phone: <span className="font-medium text-slate-600">{activeChat.phone}</span></p>
            <p className="text-xs font-semibold text-slate-700 mt-1">Country: <span className="font-medium text-slate-600">Global</span></p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Tag size={13} />
              <span>Tags</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${activeChat.tagColor}`}>
                {activeChat.tag}
              </span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border bg-slate-50 border-slate-200 text-slate-500 cursor-pointer hover:bg-slate-100 transition">
                + Add Tag
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Clock size={13} />
              <span>Session Log</span>
            </div>
            <p className="text-xs text-slate-600">Created: <span className="text-slate-500">May 25, 2026</span></p>
            <p className="text-xs text-slate-600 mt-1">Last Interaction: <span className="text-slate-500">{activeChat.time}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
