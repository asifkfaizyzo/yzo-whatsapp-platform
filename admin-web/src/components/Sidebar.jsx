import React from "react";
import {
  Megaphone,
  Inbox,
  Users,
  Box,
  Share2,
  ShoppingCart,
  MousePointerClick,
  PieChart,
  Wrench,
  Settings,
  ChevronLeft,
} from "lucide-react";

const Sidebar = () => {
  const menuItems = [
    { icon: <Megaphone size={20} />, active: true },
    { icon: <Inbox size={20} /> },
    { icon: <Users size={20} /> },
    { icon: <Box size={20} /> },
    { icon: <Share2 size={20} /> },
    { icon: <ShoppingCart size={20} /> },
    { icon: <MousePointerClick size={20} /> },
    { icon: <PieChart size={20} /> },
    { icon: <Wrench size={20} /> },
    { icon: <Settings size={20} /> },
  ];

  return (
    <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-4 justify-between min-h-[calc(100vh-64px)]">
      <div className="flex flex-col gap-5">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={`p-2 rounded-lg transition ${item.active
                ? "bg-green-50 text-green-600"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              }`}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Collapse button */}
      <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
        <ChevronLeft size={20} />
      </button>
    </div>
  );
};

export default Sidebar;