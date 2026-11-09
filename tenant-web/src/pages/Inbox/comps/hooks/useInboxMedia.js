// tenant-web/src/pages/Inbox/comps/hooks/useInboxMedia.js (do not remove this comment)

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "../../../../context/ToastContext";
import { sendMediaMessage, sendLocation } from "../../../../api/message";
import { getConversationMedia } from "../../../../api/conversation";
import api from "../../../../api/axios";

/**
 * Manages all media-related operations: file upload, voice recording,
 * contact sharing, location sending, and the right-panel media browser.
 *
 * @param {object} opts
 * @param {string} opts.activeChatId
 * @param {object} opts.activeChat
 */
export const useInboxMedia = ({ activeChatId, activeChat }) => {
  const toast = useToast();

  // ── File Staging ──
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileCaption, setFileCaption] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showStagingEmojiPicker, setShowStagingEmojiPicker] =
    useState(false);
  const stagingEmojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── New Media Input Refs ──
  const documentInputRef = useRef(null);
  const photoVideoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // ── Audio Recording ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ── Attach Menu ──
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef(null);

  // ── Contact Picker ──
  const [showContactPickerModal, setShowContactPickerModal] =
    useState(false);
  const [contactPickerSearch, setContactPickerSearch] = useState("");
  const [selectedContactsToShare, setSelectedContactsToShare] = useState(
    [],
  );
  const [sendingContact, setSendingContact] = useState(false);

  // ── Location ──
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
  });
  const [locationError, setLocationError] = useState("");
  const [sendingLocation, setSendingLocation] = useState(false);

  // ── Right Panel Media Browser ──
  const [showContactPanel, setShowContactPanel] = useState(() => {
    const saved = localStorage.getItem("inbox_contact_panel_open");
    return saved === "true";
  });
  const [rightPanelSubView, setRightPanelSubView] = useState("info");
  const [mediaActiveTab, setMediaActiveTab] = useState("media");
  const [mediaItems, setMediaItems] = useState([]);
  const [loadingMediaItems, setLoadingMediaItems] = useState(false);
  const [mediaCategoryCounts, setMediaCategoryCounts] = useState({
    media: 0,
    docs: 0,
    links: 0,
  });
  const [previewImageModal, setPreviewImageModal] = useState(null);

  // ── Persist panel state ──
  useEffect(() => {
    localStorage.setItem(
      "inbox_contact_panel_open",
      String(showContactPanel),
    );
  }, [showContactPanel]);

  // ── Reset subview on chat change ──
  useEffect(() => {
    setRightPanelSubView("info");
  }, [activeChatId]);

  // ── Click-outside handlers ──
  useEffect(() => {
    const handler = (e) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target)
      )
        setShowAttachMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (
        stagingEmojiPickerRef.current &&
        !stagingEmojiPickerRef.current.contains(e.target)
      )
        setShowStagingEmojiPicker(false);
    };
    if (showStagingEmojiPicker)
      document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStagingEmojiPicker]);

  // ── Escape to discard staging ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && selectedFile) handleCancelFile();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedFile]);

  // ── Load Media Category ──
  const loadMediaCategory = useCallback(
    async (convId, category) => {
      if (!convId) return;
      setLoadingMediaItems(true);
      try {
        const res = await getConversationMedia(convId, category, 1, 50);
        if (res.success && res.data) {
          setMediaItems(res.data.items || []);
          if (res.data.counts) setMediaCategoryCounts(res.data.counts);
        }
      } catch (err) {
        console.error("Failed to fetch media:", err);
      } finally {
        setLoadingMediaItems(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (activeChatId && showContactPanel) {
      loadMediaCategory(activeChatId, mediaActiveTab);
    }
  }, [activeChatId, showContactPanel, mediaActiveTab, loadMediaCategory]);

  // ── File Select ──
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const maxSize = isImage
      ? 5 * 1024 * 1024
      : isVideo || isAudio
        ? 16 * 1024 * 1024
        : 100 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.warning(
        `File too large. Max size is ${isImage ? "5MB" : isVideo || isAudio ? "16MB" : "100MB"}`,
      );
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target.result);
      reader.readAsDataURL(file);
    } else if (isVideo) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
    e.target.value = "";
  };

  const handleCancelFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileCaption("");
    setShowStagingEmojiPicker(false);
  };

  const handleStagingEmojiClick = (emojiData) => {
    setFileCaption((prev) => prev + emojiData.emoji);
  };

  // ── Send File ──
  const handleSendFile = async () => {
    if (!selectedFile || !activeChatId || !activeChat?.contact?.id)
      return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("conversationId", activeChatId);
      formData.append("caption", fileCaption);
      const res = await sendMediaMessage(
        activeChat.contact.id,
        formData,
      );
      if (res.success) {
        handleCancelFile();
        toast.success("File sent successfully!");
      } else {
        toast.error("Failed to send file: " + res.error);
      }
    } catch {
      toast.error("Failed to send file");
    }
    setUploadingFile(false);
  };

  // ── Voice Recording ──
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await sendVoiceMessage(audioBlob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      toast.error(
        "Could not access microphone. Please allow mic permission.",
      );
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    if (!activeChatId || !activeChat?.contact?.id) return;
    if (audioBlob.size === 0) return;
    try {
      const fileName = `voice_${Date.now()}.webm`;
      const file = new File([audioBlob], fileName, {
        type: "audio/webm",
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", activeChatId);
      formData.append("caption", "");
      const res = await sendMediaMessage(
        activeChat.contact.id,
        formData,
      );
      if (!res.success)
        toast.error("Failed to send voice: " + res.error);
    } catch {
      toast.error("Failed to send voice message");
    }
  };

  // ── Attach Menu ──
  const handleAttachMenuClick = (type) => {
    setShowAttachMenu(false);
    switch (type) {
      case "document":
        documentInputRef.current?.click();
        break;
      case "photos":
        photoVideoInputRef.current?.click();
        break;
      case "camera":
        cameraInputRef.current?.click();
        break;
      case "audio":
        audioInputRef.current?.click();
        break;
      case "contact":
        setShowContactPickerModal(true);
        break;
      case "location":
        setShowLocationModal(true);
        break;
    }
  };

  // ── Share Contacts ──
  const handleShareContacts = async () => {
    if (selectedContactsToShare.length === 0) {
      toast.warning("Please select at least one contact to share");
      return;
    }
    if (!activeChat?.contact?.phone) {
      toast.error("Contact phone number not found");
      return;
    }
    setSendingContact(true);
    try {
      const to = activeChat.contact.phone.replace(/^\+/, "");
      const contactsToSend = selectedContactsToShare.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email || undefined,
      }));
      const res = await api.post(
        `${import.meta.env.VITE_BACKEND_URL}/tenant/conversations/send-contact`,
        { to, contacts: contactsToSend, conversationId: activeChatId },
      );
      if (res.data?.success) {
        setShowContactPickerModal(false);
        setSelectedContactsToShare([]);
        setContactPickerSearch("");
        toast.success(
          `${contactsToSend.length} contact(s) shared successfully!`,
        );
      } else {
        toast.error(res.data?.message || "Failed to share contact");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to share contact",
      );
    }
    setSendingContact(false);
  };

    const toggleContactSelection = (contact) => {
    setSelectedContactsToShare((prev) => {
      const exists = prev.some((c) => c.id === contact.id);
      if (exists) return prev.filter((c) => c.id !== contact.id);
      return [...prev, contact];
    });
  };

  // ── Send Location ──
  const handleSendLocation = async () => {
    setLocationError("");
    const lat = parseFloat(locationForm.latitude);
    const lng = parseFloat(locationForm.longitude);

    if (!locationForm.latitude || !locationForm.longitude) {
      setLocationError("Latitude and longitude are required");
      return;
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setLocationError("Latitude must be between -90 and 90");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setLocationError("Longitude must be between -180 and 180");
      return;
    }
    if (!activeChat?.contact?.phone) {
      setLocationError("Contact phone number not found");
      return;
    }

    setSendingLocation(true);
    try {
      const to = activeChat.contact.phone.replace(/^\+/, "");
      const res = await sendLocation({
        to,
        latitude: lat,
        longitude: lng,
        name: locationForm.name || undefined,
        address: locationForm.address || undefined,
        conversationId: activeChatId,
      });
      if (res.success) {
        setShowLocationModal(false);
        setShowAttachMenu(false);
        setLocationForm({
          name: "",
          address: "",
          latitude: "",
          longitude: "",
        });
        toast.success("Location sent!");
      } else {
        setLocationError(res.message || "Failed to send location");
      }
    } catch {
      setLocationError("Something went wrong");
    }
    setSendingLocation(false);
  };

  return {
    // File staging
    selectedFile,
    filePreview,
    fileCaption,
    setFileCaption,
    uploadingFile,
    showStagingEmojiPicker,
    setShowStagingEmojiPicker,
    stagingEmojiPickerRef,
    fileInputRef,
    // Input refs
    documentInputRef,
    photoVideoInputRef,
    audioInputRef,
    cameraInputRef,
    // Recording
    isRecording,
    recordingTime,
    // Attach menu
    showAttachMenu,
    setShowAttachMenu,
    attachMenuRef,
    // Contact picker
    showContactPickerModal,
    setShowContactPickerModal,
    contactPickerSearch,
    setContactPickerSearch,
    selectedContactsToShare,
    sendingContact,
    // Location
    showLocationModal,
    setShowLocationModal,
    locationForm,
    setLocationForm,
    locationError,
    setLocationError,
    sendingLocation,
    // Right panel
    showContactPanel,
    setShowContactPanel,
    rightPanelSubView,
    setRightPanelSubView,
    mediaActiveTab,
    setMediaActiveTab,
    mediaItems,
    loadingMediaItems,
    mediaCategoryCounts,
    previewImageModal,
    setPreviewImageModal,
    // Actions
    handleFileSelect,
    handleCancelFile,
    handleStagingEmojiClick,
    handleSendFile,
    handleStartRecording,
    handleStopRecording,
    handleCancelRecording,
    handleAttachMenuClick,
    handleShareContacts,
    toggleContactSelection,
    handleSendLocation,
    loadMediaCategory,
  };
};