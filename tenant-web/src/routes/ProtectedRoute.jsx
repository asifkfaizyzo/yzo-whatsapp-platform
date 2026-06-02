// src/routes/ProtectedRoute.jsx

import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children, allowedRoles }) => {

  // Get from localStorage (temporary)
  const token = localStorage.getItem('accessToken')
  const user  = JSON.parse(localStorage.getItem('user') || 'null')

  // Not logged in
  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  // Wrong role
  const role = user.type === "TENANT" ? "admin" : "agent";
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute