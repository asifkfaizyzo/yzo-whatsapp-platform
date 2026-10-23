import React from 'react';
import { MapPin, X, RefreshCw } from 'lucide-react';
export default function LocationModal({ showLocationModal, setShowLocationModal, locationForm, setLocationForm, locationError, setLocationError, sendingLocation, handleSendLocation }) {
return (
<>

      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-[#111B21]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">

            {/* Header */}
            <div className="px-6 py-4 bg-[#075E54] flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <MapPin size={16} className="text-white" />
                <h2 className="text-base font-bold text-white">Share Location</h2>
              </div>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setLocationError("");
                  setLocationForm({ name: "", address: "", latitude: "", longitude: "" });
                }}
                className="text-white/60 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">

              {/* Name */}
              <div>
                <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                  Place Name{" "}
                  <span className="text-[#667781] font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Office"
                  value={locationForm.name}
                  onChange={(e) =>
                    setLocationForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                  Address{" "}
                  <span className="text-[#667781] font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. MG Road, Bangalore"
                  value={locationForm.address}
                  onChange={(e) =>
                    setLocationForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                />
              </div>

              {/* Lat / Lng */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                    Latitude <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 12.9716"
                    value={locationForm.latitude}
                    onChange={(e) =>
                      setLocationForm((prev) => ({ ...prev, latitude: e.target.value }))
                    }
                    step="any"
                    className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-[#075E54] uppercase tracking-wider">
                    Longitude <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 77.5946"
                    value={locationForm.longitude}
                    onChange={(e) =>
                      setLocationForm((prev) => ({ ...prev, longitude: e.target.value }))
                    }
                    step="any"
                    className="mt-1.5 w-full px-3 py-2.5 text-sm bg-[#F0F2F5] rounded-xl border-0 text-[#111B21] placeholder-[#667781] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 transition"
                  />
                </div>
              </div>

              {/* Helper */}
              <p className="text-[10px] text-[#667781] flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Find coordinates: Google Maps → right click → copy lat/long
              </p>

              {/* Error */}
              {locationError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-xs text-red-600 font-medium">{locationError}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    setLocationError("");
                    setLocationForm({ name: "", address: "", latitude: "", longitude: "" });
                  }}
                  disabled={sendingLocation}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#F0F2F5] text-[#667781] hover:bg-gray-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendLocation}
                  disabled={
                    sendingLocation ||
                    !locationForm.latitude ||
                    !locationForm.longitude
                  }
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#075E54] hover:bg-[#064E47] text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingLocation ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <MapPin size={12} />
                      Send Location
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}