import React from 'react';
import { X, Paperclip } from 'lucide-react';
export default function MediaPreviewModal({ previewImageModal, setPreviewImageModal }) {
return (
<>

      {previewImageModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition shadow-lg z-10"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>

            {/* IMAGE PREVIEW */}
            {(previewImageModal.type === "IMAGE" || !previewImageModal.type) && (
              <img
                src={previewImageModal.url}
                alt={previewImageModal.name || "Preview"}
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-white/10"
              />
            )}

            {/* VIDEO PREVIEW */}
            {previewImageModal.type === "VIDEO" && (
              <video
                src={previewImageModal.url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-white/10"
              />
            )}

            {/* AUDIO PREVIEW */}
            {previewImageModal.type === "AUDIO" && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl text-center shadow-2xl min-w-[320px]">
                <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto mb-3 text-[#25D366]">
                  <Mic size={24} />
                </div>
                <p className="text-white text-sm font-semibold mb-4 truncate max-w-xs mx-auto">
                  {previewMediaModal?.name || "Voice / Audio Message"}
                </p>
                <audio src={previewImageModal.url} controls autoPlay className="w-full" />
              </div>
            )}

            {/* FILE / DOCUMENT PREVIEW */}
            {previewImageModal.type === "FILE" && (
              <div className="w-full h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/10">
                <div className="px-4 py-3 bg-[#075E54] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip size={18} />
                    <span className="font-semibold text-sm truncate">
                      {previewImageModal.name || "Document Viewer"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={previewImageModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition text-white"
                    >
                      Open in New Tab
                    </a>
                    <a
                      href={previewImageModal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={previewImageModal.name}
                      className="px-3 py-1.5 bg-white text-[#075E54] hover:bg-gray-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      Download
                    </a>
                  </div>
                </div>
                <iframe
                  src={previewImageModal.url}
                  title={previewImageModal.name || "Document"}
                  className="w-full flex-1 border-none bg-gray-50"
                />
              </div>
            )}

            {/* Caption & Filename footer (for IMAGE/VIDEO/AUDIO) */}
            {(previewImageModal.caption || previewImageModal.name) && previewImageModal.type !== "FILE" && (
              <div className="mt-4 text-center px-4 py-2.5 bg-black/60 rounded-xl text-white/90 text-sm backdrop-blur-md max-w-xl shadow-lg border border-white/10">
                {previewImageModal.caption && (
                  <p className="font-semibold text-white">{previewImageModal.caption}</p>
                )}
                {previewImageModal.name && (
                  <p className="text-xs text-white/60 mt-0.5">{previewImageModal.name}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}