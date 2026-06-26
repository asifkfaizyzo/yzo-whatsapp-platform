// import Navbar from "../components/landing/layout/Navbar";
// import Footer from "../components/landing/layout/Footer";

// export default function Status() {
//   const services = [
//     { name: "API Server", status: "operational" },
//     { name: "WhatsApp Gateway", status: "operational" },
//     { name: "Broadcasting Service", status: "operational" },
//     { name: "Contact Management", status: "operational" },
//     { name: "Analytics Dashboard", status: "operational" },
//     { name: "Authentication", status: "operational" },
//   ];

//   const getStatusStyle = (status) => {
//     switch (status) {
//       case "operational":
//         return {
//           dot: "bg-[#125EF2]",
//           text: "text-[#125EF2]",
//           label: "Operational",
//         };
//       case "degraded":
//         return {
//           dot: "bg-yellow-500",
//           text: "text-yellow-600",
//           label: "Degraded",
//         };
//       case "down":
//         return {
//           dot: "bg-red-500",
//           text: "text-red-600",
//           label: "Down",
//         };
//       default:
//         return {
//           dot: "bg-gray-500",
//           text: "text-gray-600",
//           label: "Unknown",
//         };
//     }
//   };

//   return (
//     <div>
//       <Navbar />

//       <section className="py-20 bg-white">
//         <div className="max-w-3xl mx-auto px-6">

//           {/* Header */}
//           <div className="text-center mb-14">
//             <span className="text-[#125EF2] font-semibold text-sm 
//                              uppercase tracking-wider">
//               Status
//             </span>
//             <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-4">
//               System Status
//             </h1>

//             {/* Overall Status */}
//             <div className="inline-flex items-center gap-2 
//                             bg-[#EAF2FE] border border-[#CFE0FD] 
//                             rounded-full px-5 py-2">
//               <span className="w-2.5 h-2.5 bg-[#125EF2] 
//                               rounded-full animate-pulse"></span>
//               <span className="text-sm font-medium text-[#0F4FCC]">
//                 All Systems Operational
//               </span>
//             </div>
//           </div>

//           {/* Service List */}
//           <div className="space-y-3">
//             {services.map((service) => {
//               const style = getStatusStyle(service.status);
//               return (
//                 <div
//                   key={service.name}
//                   className="flex items-center justify-between 
//                              bg-gray-50 rounded-xl px-6 py-4 
//                              border border-gray-100"
//                 >
//                   <span className="text-sm font-medium text-gray-900">
//                     {service.name}
//                   </span>
//                   <div className="flex items-center gap-2">
//                     <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
//                     <span className={`text-sm ${style.text}`}>
//                       {style.label}
//                     </span>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>

//           {/* Uptime */}
//           <div className="mt-10 bg-gray-50 rounded-xl p-6 
//                           border border-gray-100">
//             <div className="flex items-center justify-between mb-3">
//               <span className="text-sm font-medium text-gray-900">
//                 Overall Uptime (Last 30 days)
//               </span>
//               <span className="text-sm font-bold text-[#125EF2]">
//                 99.98%
//               </span>
//             </div>
//             {/* Progress Bar */}
//             <div className="w-full bg-gray-200 rounded-full h-2">
//               <div className="bg-[#125EF2] h-2 rounded-full" 
//                    style={{ width: "99.98%" }}></div>
//             </div>
//           </div>

//           {/* Recent Incidents */}
//           <div className="mt-10">
//             <h2 className="text-lg font-semibold text-gray-900 mb-4">
//               Recent Incidents
//             </h2>
//             <div className="bg-gray-50 rounded-xl p-6 
//                             border border-gray-100 text-center">
//               <p className="text-sm text-gray-400">
//                 ✅ No incidents reported in the last 30 days
//               </p>
//             </div>
//           </div>

//           {/* Subscribe */}
//           <div className="text-center mt-10">
//             <p className="text-sm text-gray-400">
//               Want status updates?{" "}
//               <a href="mailto:support@wati.io" 
//                  className="text-[#125EF2] hover:underline">
//                 Subscribe to notifications
//               </a>
//             </p>
//           </div>

//         </div>
//       </section>

//       <Footer />
//     </div>
//   );
// }