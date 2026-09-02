// src/components/automation/NodeConfigPanel.jsx

import { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  File,
  Loader2,
} from "lucide-react";
import { useReactFlow } from "reactflow";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import flowService from "../../services/flow.service";

export default function NodeConfigPanel({ node, onUpdate, onClose }) {
  const { deleteElements } = useReactFlow();
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef(null);

  const [content, setContent] = useState("");
  const [saveAs, setSaveAs] = useState("");
  const [options, setOptions] = useState([]);
  const [assignType, setAssignType] = useState("auto");
  const [buttons, setButtons] = useState([]);

  // Catalog & Location state
  const [footerText, setFooterText] = useState("");
  const [thumbnailSku, setThumbnailSku] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeLat, setStoreLat] = useState("");
  const [storeLng, setStoreLng] = useState("");

  const [mediaType, setMediaType] = useState("text"); // "text" | "image" | "video"
  const [mediaData, setMediaData] = useState(null); // { mediaUrl, mediaName, mediaSize, mediaMimeType }
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!node) return;
    setContent(node.data?.content || "");
    setSaveAs(node.data?.options?.saveAs || "");

    const rawOptions = node.data?.options;
    setOptions(Array.isArray(rawOptions) ? rawOptions : []);
    setAssignType(node.data?.assign_type || "auto");

    if (node.type === "INTERACTIVE_BUTTONS") {
      const rawButtons = node.data?.options;
      setButtons(Array.isArray(rawButtons) ? rawButtons : []);
    }

    if (node.type === "SEND_CATALOG") {
      setFooterText(node.data?.options?.footerText || "");
      setThumbnailSku(node.data?.options?.thumbnailSku || "");
    }

    if (node.type === "SEND_LOCATION") {
      setStoreName(node.data?.options?.storeName || "");
      setStoreAddress(node.data?.options?.address || node.data?.content || "");
      setStoreLat(node.data?.options?.latitude || "");
      setStoreLng(node.data?.options?.longitude || "");
    }

    // ✅ NEW: Load existing media for SEND_MESSAGE nodes
        // ✅ Load existing media for SEND_MESSAGE, ASK_QUESTION, and INTERACTIVE_BUTTONS
    if (
      node.type === "SEND_MESSAGE" ||
      node.type === "ASK_QUESTION" ||
      node.type === "INTERACTIVE_BUTTONS"
    ) {
      let opts = node.data?.options;
      
      // For buttons, media can be in node.data.media or node.data.options.media
      if (node.type === "INTERACTIVE_BUTTONS") {
        opts = node.data?.media || node.data?.options?.media || null;
        const rawBtns = Array.isArray(node.data?.options)
          ? node.data.options
          : node.data?.options?.buttons || [];
        setButtons(rawBtns);
      }

      if (opts && typeof opts === "object" && !Array.isArray(opts) && opts.mediaUrl) {
        let type = "image";
        if (opts.mediaType === "VIDEO") type = "video";
        if (opts.mediaType === "FILE") type = "document";

        setMediaType(type);
        setMediaData({
          mediaType: opts.mediaType,
          mediaUrl: opts.mediaUrl,
          mediaName: opts.mediaName,
          mediaSize: opts.mediaSize,
          mediaMimeType: opts.mediaMimeType,
        });
      } else {
        setMediaType("text");
        setMediaData(null);
      }
    }
  }, [node?.id]);

  // ✅ Close panel on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // ✅ NEW: Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    // Client-side validation
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isDoc = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ].includes(file.type);

    if (mediaType === "image" && !isImage) {
      toast.error("Please select an image file");
      return;
    }
    if (mediaType === "video" && !isVideo) {
      toast.error("Please select a video file");
      return;
    }
    if (mediaType === "document" && !isDoc) {
      toast.error(
        "Please select a valid document (PDF, Word, Excel, PPT, TXT)",
      );
      return;
    }

    let maxSize = 5 * 1024 * 1024; // 5MB for images
    if (mediaType === "video") maxSize = 16 * 1024 * 1024; // 16MB for video
    if (mediaType === "document") maxSize = 25 * 1024 * 1024; // 25MB for docs

    if (file.size > maxSize) {
      const limitLabel =
        mediaType === "image" ? "5MB" : mediaType === "video" ? "16MB" : "25MB";
      toast.error(`File too large. Max limit is ${limitLabel}`);
      return;
    }

    if (file.size > maxSize) {
      toast.error(
        `File too large. Max ${mediaType === "image" ? "5MB" : "16MB"}`,
      );
      return;
    }

    try {
      setUploading(true);
      const res = await flowService.uploadFlowMedia(file);
      setMediaData(res.data);
      toast.success("Media uploaded successfully");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to upload media");
    } finally {
      setUploading(false);
    }
  };

  // ✅ NEW: Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // ✅ NEW: Handle drag & drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ✅ NEW: Remove uploaded media
  const handleRemoveMedia = async () => {
    const ok = await confirm({
      type: "warning",
      title: "Remove Media",
      message: "Are you sure you want to remove this media?",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    setMediaData(null);
    toast.success("Media removed");
  };

  // ✅ NEW: Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };


  const handleUpdate = () => {
    if (!node) return;

    // ── Media Validation for SEND_MESSAGE, ASK_QUESTION, INTERACTIVE_BUTTONS ──
    const mediaNodes = ["SEND_MESSAGE", "ASK_QUESTION", "INTERACTIVE_BUTTONS"];
    if (mediaNodes.includes(node.type)) {
      if (mediaType === "text" && !content.trim()) {
        toast.warning(
          node.type === "ASK_QUESTION" ? "Please enter a question" : "Please enter a message"
        );
        return;
      }
      if (mediaType !== "text" && !mediaData) {
        toast.warning(`Please upload a ${mediaType}`);
        return;
      }
    }

    if (node.type === "ASK_QUESTION" && !saveAs.trim()) {
      toast.warning("Please provide a variable name to save the answer");
      return;
    }

    if (node.type === "CONDITION" && options.length === 0) {
      toast.warning("Please add at least one branch");
      return;
    }

    if (node.type === "INTERACTIVE_BUTTONS") {
      if (buttons.length === 0) {
        toast.warning("Please add at least one button");
        return;
      }
      const emptyBtn = buttons.find((b) => !b.title?.trim());
      if (emptyBtn) {
        toast.warning("All buttons must have a label");
        return;
      }
    }

    // ── Build Media Payload ──
    let mediaPayload = null;
    if (mediaType !== "text" && mediaData) {
      let finalType = "IMAGE";
      if (mediaType === "video") finalType = "VIDEO";
      if (mediaType === "document") finalType = "FILE";

      mediaPayload = {
        mediaType: finalType,
        mediaUrl: mediaData.mediaUrl,
        mediaName: mediaData.mediaName,
        mediaSize: mediaData.mediaSize,
        mediaMimeType: mediaData.mediaMimeType,
      };
    }

    // ── Build updated node data ──
    let newData = { ...node.data };

    if (node.type === "SEND_MESSAGE") {
      newData.content = content;
      newData.options = mediaPayload;
    }

    if (node.type === "ASK_QUESTION") {
      newData.content = content;
      newData.options = {
        saveAs: saveAs.trim(),
        ...(mediaPayload || {}),
      };
    }

    if (node.type === "INTERACTIVE_BUTTONS") {
      newData.content = content;
      newData.options = buttons;
      newData.media = mediaPayload;
    }

    if (node.type === "SEND_CATALOG") {
      newData.content = content || "Browse our catalog below:";
      newData.options = {
        footerText: footerText.trim() || null,
        thumbnailSku: thumbnailSku.trim() || null,
      };
    }

    if (node.type === "ASK_LOCATION") {
      newData.content = content || "Please share your delivery location so we can deliver your order accurately 🚚";
      newData.options = {};
    }

    if (node.type === "SEND_LOCATION") {
      newData.content = storeAddress.trim() || "Store Address";
      newData.options = {
        storeName: storeName.trim() || "Store Location",
        address: storeAddress.trim() || "Store Address",
        latitude: storeLat ? Number(storeLat) : 19.1136,
        longitude: storeLng ? Number(storeLng) : 72.8697,
      };
    }

    if (node.type === "CONDITION") {
      newData.options = options;
    }

    if (node.type === "ASSIGN_AGENT") {
      newData.assign_type = assignType;
    }

    onUpdate(node.id, newData);

    // ✅ Show success toast & auto-close
    toast.success("Node updated successfully");
    onClose();
  };


  // Delete node from config panel
  // Delete node from config panel
  const handleDeleteNode = () => {
    deleteElements({ nodes: [{ id: node.id }] });
    toast.success("Node deleted successfully");
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

    // ── Render Reusable Vertical Media Selector ──
  const renderVerticalMediaSelector = () => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-600 block">
        Message Type
      </label>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => {
            setMediaType("text");
            setMediaData(null);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            mediaType === "text"
              ? "bg-[#125EF2] text-white border-[#125EF2]"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <FileText size={14} />
          Text
        </button>

        <button
          type="button"
          onClick={() => setMediaType("image")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            mediaType === "image"
              ? "bg-[#125EF2] text-white border-[#125EF2]"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <ImageIcon size={14} />
          Image
        </button>

        <button
          type="button"
          onClick={() => setMediaType("video")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            mediaType === "video"
              ? "bg-[#125EF2] text-white border-[#125EF2]"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Video size={14} />
          Video
        </button>

        <button
          type="button"
          onClick={() => setMediaType("document")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
            mediaType === "document"
              ? "bg-[#125EF2] text-white border-[#125EF2]"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <File size={14} />
          Document
        </button>
      </div>
    </div>
  );

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
          <div className="space-y-3">
            {/* Vertical Media Selector */}
            {renderVerticalMediaSelector()}

            {/* Media Upload Box */}
            {(mediaType === "image" ||
              mediaType === "video" ||
              mediaType === "document") && (
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  {mediaType === "image"
                    ? "Image"
                    : mediaType === "video"
                      ? "Video"
                      : "Document"}
                </label>

                {!mediaData ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#125EF2] hover:bg-blue-50/30 transition"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2
                          size={20}
                          className="animate-spin text-[#125EF2]"
                        />
                        <p className="text-xs text-slate-500">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload size={20} className="text-slate-400" />
                        <p className="text-xs font-semibold text-slate-600">
                          Click to upload {mediaType}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          or drag & drop
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {mediaType === "image" && "PNG, JPG, WebP (max 5MB)"}
                          {mediaType === "video" && "MP4, 3GP (max 16MB)"}
                          {mediaType === "document" &&
                            "PDF, DOCX, XLSX, TXT (max 25MB)"}
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={
                        mediaType === "image"
                          ? "image/*"
                          : mediaType === "video"
                            ? "video/*"
                            : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      }
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                    <div className="flex items-start gap-2">
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {mediaType === "image" && (
                          <ImageIcon size={20} className="text-[#125EF2]" />
                        )}
                        {mediaType === "video" && (
                          <Video size={20} className="text-[#125EF2]" />
                        )}
                        {mediaType === "document" && (
                          <File size={20} className="text-[#125EF2]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {mediaData.mediaName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatFileSize(mediaData.mediaSize)}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          ✓ Uploaded
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRemoveMedia}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remove media"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message / Caption */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                {mediaType === "text" ? "Message" : "Caption (optional)"}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  mediaType === "text"
                    ? "Type your message..."
                    : "Add a caption for your media..."
                }
                rows={mediaType === "text" ? 5 : 3}
                className="w-full text-sm border border-slate-200 rounded-xl
                  p-3 resize-none focus:outline-none
                  focus:border-[#125EF2] transition"
              />
            </div>
          </div>
        )}


                {/* ASK_QUESTION */}
        {node.type === "ASK_QUESTION" && (
          <div className="space-y-3">
            {/* Vertical Media Selector */}
            {renderVerticalMediaSelector()}

            {/* Media Upload Box */}
            {(mediaType === "image" ||
              mediaType === "video" ||
              mediaType === "document") && (
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  {mediaType === "image"
                    ? "Image"
                    : mediaType === "video"
                      ? "Video"
                      : "Document"}
                </label>

                {!mediaData ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#125EF2] hover:bg-blue-50/30 transition"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2
                          size={20}
                          className="animate-spin text-[#125EF2]"
                        />
                        <p className="text-xs text-slate-500">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload size={20} className="text-slate-400" />
                        <p className="text-xs font-semibold text-slate-600">
                          Click to upload {mediaType}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          or drag & drop
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {mediaType === "image" && "PNG, JPG, WebP (max 5MB)"}
                          {mediaType === "video" && "MP4, 3GP (max 16MB)"}
                          {mediaType === "document" &&
                            "PDF, DOCX, XLSX, TXT (max 25MB)"}
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={
                        mediaType === "image"
                          ? "image/*"
                          : mediaType === "video"
                            ? "video/*"
                            : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      }
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                    <div className="flex items-start gap-2">
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {mediaType === "image" && (
                          <ImageIcon size={20} className="text-[#125EF2]" />
                        )}
                        {mediaType === "video" && (
                          <Video size={20} className="text-[#125EF2]" />
                        )}
                        {mediaType === "document" && (
                          <File size={20} className="text-[#125EF2]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {mediaData.mediaName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatFileSize(mediaData.mediaSize)}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          ✓ Uploaded
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRemoveMedia}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remove media"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                {mediaType === "text" ? "Question" : "Question / Caption"}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your question..."
                rows={3}
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
          </div>
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
            {/* Vertical Media Selector */}
            {renderVerticalMediaSelector()}

            {/* Media Upload Box */}
            {(mediaType === "image" ||
              mediaType === "video" ||
              mediaType === "document") && (
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Header{" "}
                  {mediaType === "image"
                    ? "Image"
                    : mediaType === "video"
                      ? "Video"
                      : "Document"}
                </label>

                {!mediaData ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#125EF2] hover:bg-blue-50/30 transition"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2
                          size={20}
                          className="animate-spin text-[#125EF2]"
                        />
                        <p className="text-xs text-slate-500">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Upload size={20} className="text-slate-400" />
                        <p className="text-xs font-semibold text-slate-600">
                          Click to upload {mediaType} header
                        </p>
                        <p className="text-[10px] text-slate-400">
                          or drag & drop
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {mediaType === "image" && "PNG, JPG, WebP (max 5MB)"}
                          {mediaType === "video" && "MP4, 3GP (max 16MB)"}
                          {mediaType === "document" &&
                            "PDF, DOCX, XLSX, TXT (max 25MB)"}
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={
                        mediaType === "image"
                          ? "image/*"
                          : mediaType === "video"
                            ? "video/*"
                            : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      }
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                    <div className="flex items-start gap-2">
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {mediaType === "image" && (
                          <ImageIcon size={20} className="text-[#125EF2]" />
                        )}
                        {mediaType === "video" && (
                          <Video size={20} className="text-[#125EF2]" />
                        )}
                        {mediaType === "document" && (
                          <File size={20} className="text-[#125EF2]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {mediaData.mediaName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatFileSize(mediaData.mediaSize)}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          ✓ Uploaded
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRemoveMedia}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remove media"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Body message */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                {mediaType === "text" ? "Message" : "Body Message"}
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
                  {buttons.length}/10 max
                </span>
              </div>

              {/* Info box */}
              <div className="bg-green-50 border border-green-100 rounded-lg p-2 mb-2">
                <p className="text-[10px] text-green-700 leading-relaxed">
                  💡 Max 10 buttons. 1–3 buttons are sent as Quick Reply buttons; 4–10 are automatically sent as an Interactive List menu. Drag from each handle to connect the next node.
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
                      placeholder="Button label (max 24 chars)"
                      maxLength={24}
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
                        {(btn.title || "").length}/24
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add button */}
              {buttons.length < 10 && (
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
              {buttons.length >= 10 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  ⚠️ Maximum 10 buttons reached
                </p>
              )}
            </div>
          </div>
        )}

        {/* SEND_CATALOG */}
        {node.type === "SEND_CATALOG" && (
          <div className="space-y-3">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-xs font-bold text-indigo-800">🛍️ WhatsApp Catalog</p>
              <p className="text-[11px] text-indigo-600 mt-0.5">
                Displays your Meta Commerce Catalog with a "View Catalog" button directly in chat.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Body Text
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. Browse our latest products and place an order directly on WhatsApp!"
                rows={3}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-[#125EF2] transition resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Footer Text (Optional)
              </label>
              <input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Tap View Catalog to explore"
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-[#125EF2] transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Header Product SKU (Optional)
              </label>
              <input
                value={thumbnailSku}
                onChange={(e) => setThumbnailSku(e.target.value)}
                placeholder="e.g. SKU_PROD_101"
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-[#125EF2] transition"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Optional item thumbnail featured in the message header
              </p>
            </div>
          </div>
        )}

        {/* ASK_LOCATION */}
        {node.type === "ASK_LOCATION" && (
          <div className="space-y-3">
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
              <p className="text-xs font-bold text-teal-800">📍 Home Delivery GPS Request</p>
              <p className="text-[11px] text-teal-600 mt-0.5">
                Sends a native WhatsApp "Send location" button. Automatically extracts GPS coordinates or text address and updates the active order.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Request Prompt Message
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. Please share your delivery location so our delivery partner can reach you 🚚"
                rows={3}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-[#125EF2] transition resize-none"
              />
            </div>
          </div>
        )}

        {/* SEND_LOCATION */}
        {node.type === "SEND_LOCATION" && (
          <div className="space-y-3">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
              <p className="text-xs font-bold text-orange-800">🏬 Store Pickup Google Maps Pin</p>
              <p className="text-[11px] text-orange-600 mt-0.5">
                Sends your store's exact GPS location and address pin on WhatsApp for pickup orders.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Store / Branch Name
              </label>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Main Street Outlet"
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-[#125EF2] transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Complete Address
              </label>
              <textarea
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="e.g. 123 Commerce Avenue, Suite 400, Mumbai 400001"
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-[#125EF2] transition resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Latitude
                </label>
                <input
                  value={storeLat}
                  onChange={(e) => setStoreLat(e.target.value)}
                  placeholder="e.g. 19.1136"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2 focus:outline-none focus:border-[#125EF2] transition"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Longitude
                </label>
                <input
                  value={storeLng}
                  onChange={(e) => setStoreLng(e.target.value)}
                  placeholder="e.g. 72.8697"
                  className="w-full text-xs border border-slate-200 rounded-xl p-2 focus:outline-none focus:border-[#125EF2] transition"
                />
              </div>
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
