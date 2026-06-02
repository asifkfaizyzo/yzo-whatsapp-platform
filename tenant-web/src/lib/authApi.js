// // src/lib/authApi.js

// import api from './axios';

// // ✅ Register Tenant / Super Admin
// export const registerSuperAdmin = async (userData) => {
//   try {
//     const payload = {
//       name: userData.name,
//       email: userData.email,
//       password: userData.password,
//       companyName: userData.companyName,
//     };

//     let response;
//     try {
//       response = await api.post('/create', payload);
//     } catch (apiError) {
//       console.warn("Backend API not connected, falling back to mock success for offline frontend testing.", apiError);
//       response = {
//         data: {
//           data: {
//             accessToken: 'mock-token',
//             superAdmin: {
//               name: userData.name,
//               email: userData.email,
//               role: 'admin', // Default role for registering tenant
//               companyName: userData.companyName
//             }
//           }
//         }
//       };
//     }

//     const loginData = response.data?.data;
//     if (loginData) {
//       if (loginData.accessToken) {
//         localStorage.setItem('accessToken', loginData.accessToken);
//       }
//       if (loginData.superAdmin) {
//         localStorage.setItem('user', JSON.stringify(loginData.superAdmin));
//       }
//     }
//     return { success: true, data: response.data };
//   } catch (error) {
//     return {
//       success: false,
//       message: error.response?.data?.message || 'Registration failed',
//     };
//   }
// };

// // ✅ Login Tenant / Super Admin
// export const loginSuperAdmin = async (email, password) => {
//   try {
//     let response;
//     try {
//       response = await api.post('/login', { email, password });
//     } catch (apiError) {
//       console.warn("Backend API not connected, falling back to mock success for offline frontend testing.", apiError);

//       // We can mock an agent role if they enter agent@company.com to test both roles!
//       const isAgent = email.toLowerCase().includes('agent');
//       response = {
//         data: {
//           data: {
//             accessToken: 'mock-token',
//             superAdmin: {
//               name: isAgent ? "Agent User" : "Demo Admin",
//               email: email,
//               role: isAgent ? "agent" : "admin",
//               companyName: "Replyo"
//             }
//           }
//         }
//       };
//     }

//     const loginData = response.data?.data;
//     if (loginData) {
//       if (loginData.accessToken) {
//         localStorage.setItem('accessToken', loginData.accessToken);
//       }
//       if (loginData.superAdmin) {
//         localStorage.setItem('user', JSON.stringify(loginData.superAdmin));
//       }
//     }

//     return { success: true, data: response.data };
//   } catch (error) {
//     return {
//       success: false,
//       message: error.response?.data?.message || 'Login failed',
//     };
//   }
// };

// // ✅ Logout
// export const logoutSuperAdmin = async () => {
//   try {
//     const refreshToken = localStorage.getItem('refreshToken');
//     if (refreshToken && refreshToken !== 'undefined') {
//       try {
//         await api.post('/logout', { refreshToken });
//       } catch (e) { }
//     }
//     localStorage.clear();
//     return { success: true };
//   } catch (error) {
//     localStorage.clear(); // Clear local storage even if api logout fails
//     return { success: false };
//   }
// };
