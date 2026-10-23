import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { Search, RefreshCw, X } from 'lucide-react';
export default function NewChatModal({ showNewChatModal, setShowNewChatModal, modalSearch, setModalSearch, loadingContacts, filteredContacts, handleSelectContactForChat, getAvatarStyle }) {
return (
<>

      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[#075E54] flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white">
                  <FaWhatsapp size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white leading-tight">
                    New WhatsApp Chat
                  </h2>
                  <p className="text-[10px] text-emerald-200">
                    Select a phone contact to start chatting
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4 max-h-[400px] overflow-hidden">
              <div className="relative">
                <Search
                  className="absolute left-3 top-2.5 text-[#54656F]"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-[#F0F2F5] rounded-lg border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#F0F2F5]">
                {loadingContacts ? (
                  <div className="text-center text-xs text-[#667781] py-6 flex items-center justify-center gap-2">
                    <RefreshCw
                      size={14}
                      className="animate-spin text-[#25D366]"
                    />
                    Loading contacts...
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContactForChat(contact.id)}
                      className="w-full text-left py-3 px-2 hover:bg-[#F0F2F5] transition flex items-center gap-3 rounded-xl"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarStyle(
                          contact.name,
                        )}`}
                      >
                        {contact.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-[#111B21] truncate">
                            {contact.name}
                          </p>
                          {contact.isBlocked && (
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold rounded-md uppercase tracking-wider shrink-0 border border-red-100">
                              Blocked
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#667781] font-mono mt-0.5">
                          {contact.phone}
                        </p>
                      </div>
                      <FaWhatsapp className="w-4 h-4 text-[#25D366] shrink-0 opacity-50" />
                    </button>
                  ))
                )}
                {!loadingContacts && filteredContacts.length === 0 && (
                  <p className="text-center text-xs text-[#667781] py-6">
                    No matching contacts found
                  </p>
                )}
              </div>

              {/* Notice about Meta policy */}
              <div className="pt-2.5 border-t border-[#F0F2F5] text-[10px] text-[#667781] flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">ℹ️ Note:</span>
                <span>
                  Instagram & Messenger chats appear automatically when customers message your page.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}