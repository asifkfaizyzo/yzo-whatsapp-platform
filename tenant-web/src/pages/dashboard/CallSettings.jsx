import React, { useState, useEffect } from 'react';
import { PhoneCall, PhoneForwarded, Upload, X, Loader2, Save, Sliders, History } from 'lucide-react';
import api from '../../lib/axios';
import { useToast } from '../../context/ToastContext';
import { useWhatsAppStore } from '../../store/useWhatsAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import CallLogsTable from '../../components/calls/CallLogsTable';

export default function CallSettings() {
  const [activeSubTab, setActiveSubTab] = useState('logs');
  const [settings, setSettings] = useState({
    status: 'ENABLED',
    callIconVisibility: 'DEFAULT'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voicemailFile, setVoicemailFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { phoneNumberId, loading: waLoading, fetchStatus } = useWhatsAppStore();
  const user = useAuthStore((s) => s.user);
  const phoneId = phoneNumberId || user?.whatsappPhoneId || user?.tenant?.whatsappPhoneId;
  const toast = useToast();

  useEffect(() => {
    if (!phoneNumberId && typeof fetchStatus === 'function') {
      fetchStatus();
    }
  }, [phoneNumberId, fetchStatus]);

  useEffect(() => {
    if (phoneId) {
      fetchSettings();
    }
  }, [phoneId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/whatsapp/calls/settings/${phoneId}`);
      if (res.data?.success && res.data?.data) {
        setSettings({
          status: res.data.data.status || 'ENABLED',
          callIconVisibility: res.data.data.callIconVisibility || 'DEFAULT'
        });
      }
    } catch (err) {
      console.error('Failed to fetch call settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!phoneId) return toast.error('WhatsApp Phone ID not found');
    setSaving(true);
    try {
      const res = await api.put(`/whatsapp/calls/settings/${phoneId}`, settings);
      if (res.data?.success) {
        toast.success('Call settings updated via Meta API!');
      } else {
        toast.error(res.data?.message || 'Failed to update settings');
      }
    } catch (err) {
      toast.error('Error updating call settings');
    } finally {
      setSaving(false);
    }
  };

  const handleVoicemailUpload = async () => {
    if (!voicemailFile) return toast.error('Please select an audio file first');
    if (!phoneId) return toast.error('WhatsApp Phone ID not found');

    const formData = new FormData();
    formData.append('audio', voicemailFile);

    setUploading(true);
    try {
      const res = await api.post(`/whatsapp/calls/settings/${phoneId}/voicemail-greeting`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        toast.success('Custom Voicemail Greeting uploaded successfully!');
        setVoicemailFile(null);
      } else {
        toast.error(res.data?.message || 'Failed to upload greeting');
      }
    } catch (err) {
      toast.error('Error uploading voicemail greeting');
    } finally {
      setUploading(false);
    }
  };

  if (loading || (waLoading && !phoneId)) {
    return (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#125EF2]" />
        <span className="text-sm font-medium">Loading WhatsApp call settings...</span>
      </div>
    );
  }

  if (!phoneId) {
    return (
      <div className="p-6 text-center text-slate-500">
        Please connect your WhatsApp Cloud API account in the Connectors tab to manage call settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Sub-Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-[#125EF2]" />
          WhatsApp Calling
        </h2>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'logs'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#125EF2]" />
            <span>Call Logs & Recordings</span>
          </button>

          <button
            onClick={() => setActiveSubTab('config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'config'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Settings & Voicemail</span>
          </button>
        </div>
      </div>

      {/* ── Tab 1: Call Logs & Recordings ── */}
      {activeSubTab === 'logs' && <CallLogsTable />}

      {/* ── Tab 2: Meta Configuration ── */}
      {activeSubTab === 'config' && (
        <div className="space-y-6 animate-in fade-in duration-200">

      {/* Meta API Settings */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Calling Status
          </label>
          <p className="text-xs text-slate-500 mb-2">Enable or disable inbound WhatsApp calls entirely.</p>
          <select 
            value={settings.status}
            onChange={(e) => setSettings({ ...settings, status: e.target.value })}
            className="w-full text-sm font-semibold text-slate-700 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] outline-none"
          >
            <option value="ENABLED">Enabled (Accept Calls)</option>
            <option value="DISABLED">Disabled (Reject All Calls)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mt-2">
            Call Icon Visibility
          </label>
          <p className="text-xs text-slate-500 mb-2">Controls if the Call button appears in the WhatsApp App for customers.</p>
          <select 
            value={settings.callIconVisibility}
            onChange={(e) => setSettings({ ...settings, callIconVisibility: e.target.value })}
            className="w-full text-sm font-semibold text-slate-700 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] outline-none"
          >
            <option value="DEFAULT">Default (Visible)</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </div>

        <button 
          onClick={handleSaveSettings}
          disabled={saving || loading}
          className="bg-[#125EF2] hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2 mt-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sync Settings to Meta
        </button>
      </div>

      <div className="my-8 border-t border-slate-100"></div>

      {/* Voicemail Greeting */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
          <PhoneForwarded className="w-4 h-4 text-slate-500" />
          Voicemail Greeting
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Upload a custom audio file (OGG format) that will play to customers if their call goes unanswered. Meta will then allow them to leave a voice message.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
             <input 
                type="file" 
                accept="audio/ogg" 
                onChange={(e) => setVoicemailFile(e.target.files[0])}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition"
             />
          </div>
          <button 
            onClick={handleVoicemailUpload}
            disabled={!voicemailFile || uploading}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Greeting
          </button>
        </div>
        {voicemailFile && <p className="text-xs text-emerald-600 mt-2 font-medium">Selected: {voicemailFile.name}</p>}
      </div>
    </div>
  )}

</div>
);
}
