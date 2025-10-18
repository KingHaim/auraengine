"use client";
import { Search } from "lucide-react";

export default function Topbar() {
  return (
    <header className="flex items-center justify-between px-8 py-6">
      <div className="w-1/2 max-w-xl relative">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
          size={16}
        />
        <input
          className="w-full h-11 rounded-xl bg-[#161B22] border border-[#202632] pl-10 pr-4 text-sm placeholder:text-gray-500 text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          placeholder="Search for a project or a product…"
        />
      </div>
      <div className="h-9 w-9 rounded-full bg-white/10"></div>
    </header>
  );
}
