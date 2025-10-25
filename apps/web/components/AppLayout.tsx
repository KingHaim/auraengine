"use client";
import { useAuth } from "../contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import AuthModal from "./AuthModal";
import { useState, useEffect, useRef } from "react";

const SIDEBAR_WIDTH = 200; // px

interface AppLayoutProps {
  children: React.ReactNode;
}

interface SearchResult {
  id: string;
  type: "campaign" | "product" | "model" | "scene";
  name: string;
  description?: string;
  image_url?: string;
  url: string;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, loading, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Search functionality
  const performSearch = async (query: string) => {
    if (!query.trim() || !token) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      const [campaignsRes, productsRes, modelsRes, scenesRes] =
        await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/models`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/scenes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

      const [campaigns, products, models, scenes] = await Promise.all([
        campaignsRes.ok ? campaignsRes.json() : [],
        productsRes.ok ? productsRes.json() : [],
        modelsRes.ok ? modelsRes.json() : [],
        scenesRes.ok ? scenesRes.json() : [],
      ]);

      const results: SearchResult[] = [];

      // Filter and add campaigns
      campaigns
        .filter((campaign: any) =>
          campaign.name.toLowerCase().includes(query.toLowerCase())
        )
        .forEach((campaign: any) => {
          results.push({
            id: campaign.id,
            type: "campaign",
            name: campaign.name,
            description: `Campaign with ${
              campaign.settings?.generated_images?.length || 0
            } images`,
            url: "/campaigns",
          });
        });

      // Filter and add products
      products
        .filter(
          (product: any) =>
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.description?.toLowerCase().includes(query.toLowerCase())
        )
        .forEach((product: any) => {
          results.push({
            id: product.id,
            type: "product",
            name: product.name,
            description: product.description || "Product",
            image_url: product.image_url,
            url: "/products",
          });
        });

      // Filter and add models
      models
        .filter(
          (model: any) =>
            model.name.toLowerCase().includes(query.toLowerCase()) ||
            model.description?.toLowerCase().includes(query.toLowerCase())
        )
        .forEach((model: any) => {
          results.push({
            id: model.id,
            type: "model",
            name: model.name,
            description: model.description || "Model",
            image_url: model.image_url,
            url: "/models",
          });
        });

      // Filter and add scenes
      scenes
        .filter(
          (scene: any) =>
            scene.name.toLowerCase().includes(query.toLowerCase()) ||
            scene.description?.toLowerCase().includes(query.toLowerCase()) ||
            scene.tags?.some((tag: string) =>
              tag.toLowerCase().includes(query.toLowerCase())
            )
        )
        .forEach((scene: any) => {
          results.push({
            id: scene.id,
            type: "scene",
            name: scene.name,
            description: scene.description || "Scene",
            image_url: scene.image_url,
            url: "/scenes",
          });
        });

      setSearchResults(results.slice(0, 8)); // Limit to 8 results
      setShowSearchResults(results.length > 0);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, token]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchResults) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedResultIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (
          selectedResultIndex >= 0 &&
          selectedResultIndex < searchResults.length
        ) {
          const result = searchResults[selectedResultIndex];
          router.push(result.url);
          setSearchQuery("");
          setShowSearchResults(false);
          setSelectedResultIndex(-1);
        }
        break;
      case "Escape":
        setShowSearchResults(false);
        setSelectedResultIndex(-1);
        searchInputRef.current?.blur();
        break;
    }
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setSearchQuery("");
    setShowSearchResults(false);
    setSelectedResultIndex(-1);
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
        setSelectedResultIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigationItems = [
    { href: "/dashboard", label: "DASHBOARD" },
    { href: "/campaigns", label: "CAMPAIGNS" },
    { href: "/products", label: "PRODUCTS" },
    { href: "/models", label: "MODELS" },
    { href: "/scenes", label: "SCENES" },
    { href: "/credits", label: "CREDITS" },
  ];

  return (
    <div
      style={{
        backgroundColor: "#0E1115",
        color: "#E6E8EB",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        minHeight: "100vh",
        paddingLeft: `${SIDEBAR_WIDTH}px`,
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: `${SIDEBAR_WIDTH}px`,
          background:
            "linear-gradient(180deg, #090a0c 0%, #090a0c 60%, #1a1a1a 80%, #8b1a2a 100%)",
          borderRight: "1px solid #1F2630",
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 0,
        }}
      >
        {/* Radial glow overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(600px 220px at 20% 20%, rgba(34,211,238,0.15) 0%, transparent 60%), radial-gradient(520px 220px at 80% 75%, rgba(139,92,246,0.12) 0%, transparent 60%)",
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
        {/* Logo */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "40px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: "160px",
              height: "160px",
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: "24px" }}>
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "44px",
                    padding: "12px",
                    borderRadius: "10px",
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.08)"
                      : "transparent",
                    color: isActive ? "#FFFFFF" : "#C7CDD6",
                    textDecoration: "none",
                    fontSize: "12px",
                    fontWeight: isActive ? "600" : "500",
                    letterSpacing: "0.18em",
                    marginBottom: "4px",
                    transition: "all 0.2s",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* White dashed separator */}
          <div
            style={{
              borderTop: "1px dashed rgba(255,255,255,0.2)",
              marginBottom: "24px",
            }}
          />

          <div
            style={{
              paddingTop: "0px",
            }}
          >
            {/* Help and Terms pages not yet created
            <Link href="/help">HELP</Link>
            <Link href="/terms">TERMS</Link>
            */}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Topbar */}
        <header
          style={{
            padding: "24px 32px",
            height: "72px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#11161C",
          }}
        >
          <div
            style={{ position: "relative", width: "100%", maxWidth: "640px" }}
          >
            <div
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.7)",
                fontSize: "18px",
                zIndex: 1,
              }}
            >
              {searchLoading ? "⏳" : "🔍"}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for a project or a product…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowSearchResults(true);
                }
              }}
              style={{
                width: "100%",
                height: "44px",
                backgroundColor: "#161B22",
                border: "1px solid #202632",
                borderRadius: "12px",
                paddingLeft: "44px",
                paddingRight: "16px",
                color: "#E6E8EB",
                fontSize: "14px",
                outline: "none",
              }}
            />

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div
                ref={searchResultsRef}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: "12px",
                  marginTop: "4px",
                  maxHeight: "400px",
                  overflowY: "auto",
                  zIndex: 1000,
                  boxShadow: "0 10px 25px rgba(9, 10, 12, 0.3)",
                }}
              >
                {searchResults.map((result, index) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      borderBottom:
                        index < searchResults.length - 1
                          ? "1px solid #374151"
                          : "none",
                      backgroundColor:
                        selectedResultIndex === index
                          ? "#374151"
                          : "transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                    onMouseEnter={() => setSelectedResultIndex(index)}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                        backgroundColor: "#4B5563",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        flexShrink: 0,
                      }}
                    >
                      {result.type === "campaign" && "📋"}
                      {result.type === "product" && "📦"}
                      {result.type === "model" && "👤"}
                      {result.type === "scene" && "🏞️"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#F9FAFB",
                          marginBottom: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {result.name}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#9CA3AF",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {result.description}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        flexShrink: 0,
                      }}
                    >
                      {result.type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Authentication buttons or user info */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ fontSize: "14px", color: "#9BA3AF" }}>
                Loading...
              </div>
            </div>
          ) : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#E6E8EB",
                  }}
                >
                  {user.full_name || user.email}
                </div>
                <div style={{ fontSize: "12px", color: "#9BA3AF" }}>
                  {user.credits} credits
                </div>
              </div>
              <button
                onClick={logout}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  border: "1px solid #242B35",
                  borderRadius: "8px",
                  color: "#C7CDD6",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  setAuthMode("login");
                  setShowAuthModal(true);
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  border: "1px solid #242B35",
                  borderRadius: "8px",
                  color: "#C7CDD6",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setAuthMode("register");
                  setShowAuthModal(true);
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#d42f48",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Sign Up
              </button>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main
          style={{
            padding: "32px",
            backgroundColor: "#FFFFFF",
            minHeight: "calc(100vh - 72px)",
          }}
        >
          {children}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
      />
    </div>
  );
}
