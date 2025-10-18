"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "CAMPAIGNS" },
    { href: "/products", label: "PRODUCTS" },
    { href: "/models", label: "MODELS" },
    { href: "/scenes", label: "SCENES" },
  ];

  const bottomItems = [
    { href: "/help", label: "HELP" },
    { href: "/terms", label: "TERMS" },
  ];

  return (
    <div className="relative w-64 shrink-0 text-gray-300">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0F12] via-[#0E131A] to-[#121826]"></div>
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(600px_200px_at_20%_20%,rgba(34,211,238,0.15),transparent),radial-gradient(500px_200px_at_80%_70%,rgba(139,92,246,0.12),transparent)]"></div>
      <aside className="relative h-full flex flex-col px-6 pt-8 pb-6 border-r border-[#1F2630]">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <div className="grid place-items-center">
            <div className="h-10 w-10 rounded-full grid place-items-center bg-white/5 border border-white/10">
              ✶
            </div>
            <div className="mt-3 text-center text-sm font-semibold tracking-widerbrand leading-tight">
              AURA
              <br />
              ENGINE
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-10 space-y-1 text-xs font-medium tracking-wideish">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:bg-white/5 ${
                pathname === item.href
                  ? "text-white bg-white/10 font-semibold"
                  : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Dashed separator */}
        <div className="mt-6 border-t border-dashed border-white/20"></div>

        {/* Bottom links */}
        <div className="mt-6">
          <div className="space-y-1 text-[11px] tracking-[0.22em] text-gray-400">
            {bottomItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
