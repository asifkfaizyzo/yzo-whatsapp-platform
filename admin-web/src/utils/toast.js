// src/utils/toast.js

import toast from 'react-hot-toast';

// ✅ Success — green check
export const showSuccess = (message) => {
  toast.success(message);
};

// ⚠️ Error — red alert (stays longer)
export const showError = (message = "Something went wrong") => {
  toast.error(message);
};

// 🔔 Info / Notification — custom blue
export const showInfo = (message) => {
  toast(message, {
    icon: '🔔',
    style: {
      background:  '#EAF2FE',
      color:       '#125EF2',
      border:      '1px solid #CFE0FD',
    },
  });
};

// ⚠️ Warning — amber
export const showWarning = (message) => {
  toast(message, {
    icon: '⚠️',
    style: {
      background:  '#FEF3C7',
      color:       '#92400E',
      border:      '1px solid #FDE68A',
    },
  });
};

// 🗑️ Confirmation (destructive) — used for critical actions
export const showLoading = (message = "Processing...") => {
  return toast.loading(message);
};

// Dismiss a specific loading toast
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};