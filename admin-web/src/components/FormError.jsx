// tenant-web/src/components/ui/FormError.jsx
import React from 'react';

export default function FormError({ message }) {
  if (!message) return null;

  return (
    <p className="mt-1 text-xs text-red-500 font-medium animate-fadeIn">
      {message}
    </p>
  );
}
