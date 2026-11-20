// tenant-web/src/pages/Inbox/comps/MediaPreviewModal.jsx (do not remove this comment)
import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
  Mic,
  Paperclip,
  X,
} from "lucide-react";
import api from "../../../api/axios";

const getApiErrorMessage = async (error, fallback) => {
  const responseData = error.response?.data;
  if (responseData instanceof Blob) {
    try {
      const body = JSON.parse(await responseData.text());
      if (body.message) return body.message;
    } catch {
      return fallback;
    }
  }
  return responseData?.message || fallback;
};

function DocumentPreview({ media }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewStatus, setPreviewStatus] = useState(
    media.messageId ? "loading" : "error",
  );
  const [previewError, setPreviewError] = useState(
    media.messageId ? "" : "This message is missing its media reference.",
  );
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameError, setFrameError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!media.messageId) return undefined;

    const controller = new AbortController();
    let objectUrl = "";

    const loadPdf = async () => {
      try {
        const response = await api.get(
          `/messages/media/preview/${encodeURIComponent(media.messageId)}`,
          { responseType: "blob", signal: controller.signal },
        );
        if (controller.signal.aborted) return;

        const contentType =
          response.headers["content-type"] || response.data.type;
        if (!contentType?.toLowerCase().includes("application/pdf")) {
          setPreviewStatus("unsupported");
          return;
        }

        objectUrl = URL.createObjectURL(response.data);
        setPreviewUrl(objectUrl);
        setPreviewStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setPreviewError(
          await getApiErrorMessage(error, "Could not load the PDF preview."),
        );
        setPreviewStatus(error.response?.status === 415 ? "unsupported" : "error");
      }
    };

    loadPdf();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.messageId]);

  useEffect(() => {
    if (!previewUrl || frameLoaded) return undefined;

    const timeout = window.setTimeout(() => setFrameError(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [previewUrl, frameLoaded]);

  const handleDownload = async () => {
    if (!media.messageId || downloading) return;

    setDownloading(true);
    setDownloadError("");
    try {
      const response = await api.get(
        `/messages/media/preview/${encodeURIComponent(media.messageId)}?download=true`,
        { responseType: "blob" },
      );
      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = media.name || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      setDownloadError(
        await getApiErrorMessage(error, "Could not download this file."),
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-[80vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
        <Paperclip size={18} className="shrink-0" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {media.name || "Document"}
        </p>
        {previewStatus === "ready" && previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold transition hover:bg-white/25"
          >
            <ExternalLink size={14} />
            Open in new tab
          </a>
        )}
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !media.messageId}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#075E54] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={14} />
          {downloading ? "Downloading..." : "Download"}
        </button>
      </div>
      {previewStatus === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-[#667781]">
          <Loader2 size={28} className="animate-spin text-[#075E54]" />
          <span>Loading PDF preview...</span>
        </div>
      )}
      {previewStatus === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="text-base font-semibold text-[#111B21]">
            Preview could not be loaded
          </p>
          <p className="mt-2 max-w-lg break-words text-sm text-[#667781]">
            {previewError}
          </p>
          <p className="mt-2 text-sm text-[#667781]">
            You can still try downloading the original file.
          </p>
        </div>
      )}
      {previewStatus === "unsupported" && (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#075E54]/10 text-[#075E54]">
            <Paperclip size={26} />
          </div>
          <p className="text-base font-semibold text-[#111B21]">
            Preview isn’t available for this file type.
          </p>
          <p className="mt-2 max-w-lg break-words text-sm text-[#667781]">
            Download {media.name || "this file"} to open it in a compatible app.
          </p>
        </div>
      )}
      {previewStatus === "ready" && previewUrl && (
        <div className="relative min-h-0 flex-1 bg-slate-100">
          {!frameLoaded && !frameError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-sm text-[#667781]">
              <Loader2 size={28} className="animate-spin text-[#075E54]" />
              <span>Opening PDF...</span>
            </div>
          )}
          {frameError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-base font-semibold text-[#111B21]">
                This browser could not display the PDF.
              </p>
              <p className="text-sm text-[#667781]">
                Download the file to view it.
              </p>
            </div>
          )}
          <iframe
            src={previewUrl}
            title={media.name || "PDF document"}
            onLoad={() => setFrameLoaded(true)}
            onError={() => setFrameError(true)}
            className={`h-full w-full border-0 ${frameError ? "hidden" : ""}`}
          />
        </div>
      )}
      {downloadError && (
        <p
          role="alert"
          className="bg-red-50 px-4 py-2 text-center text-sm text-red-700"
        >
          {downloadError}
        </p>
      )}
    </div>
  );
}

export default function MediaPreviewModal({
  previewImageModal,
  setPreviewImageModal,
}) {
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
            {(previewImageModal.type === "IMAGE" ||
              !previewImageModal.type) && (
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
                  {previewImageModal?.name || "Voice / Audio Message"}
                </p>
                <audio
                  src={previewImageModal.url}
                  controls
                  autoPlay
                  className="w-full"
                />
              </div>
            )}

            {/* FILE / DOCUMENT PREVIEW */}
            {previewImageModal.type === "FILE" && (
              <DocumentPreview
                key={previewImageModal.messageId || previewImageModal.name}
                media={previewImageModal}
              />
            )}

            {/* Caption & Filename footer (for IMAGE/VIDEO/AUDIO) */}
            {(previewImageModal.caption || previewImageModal.name) &&
              previewImageModal.type !== "FILE" && (
                <div className="mt-4 text-center px-4 py-2.5 bg-black/60 rounded-xl text-white/90 text-sm backdrop-blur-md max-w-xl shadow-lg border border-white/10">
                  {previewImageModal.caption && (
                    <p className="font-semibold text-white">
                      {previewImageModal.caption}
                    </p>
                  )}
                  {previewImageModal.name && (
                    <p className="text-xs text-white/60 mt-0.5">
                      {previewImageModal.name}
                    </p>
                  )}
                </div>
              )}
          </div>
        </div>
      )}
    </>
  );
}
