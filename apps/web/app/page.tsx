"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import AuthModal from "../components/AuthModal";

export default function Home() {
  const { user, logout, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Redirect to dashboard if user is logged in
  useEffect(() => {
    if (user && !loading) {
      window.location.href = "/dashboard";
    }
  }, [user, loading]);

  console.log("Home component - user:", user, "loading:", loading);

  // Show loading while checking auth
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          backgroundColor: "#0E1115",
          color: "#E6E8EB",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              fontSize: "20px",
            }}
          >
            ✶
          </div>
          <div style={{ fontSize: "14px", color: "#9BA3AF" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#0E1115",
        color: "#E6E8EB",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: "280px",
          background:
            "linear-gradient(90deg, #0B0F12 0%, #0E131A 45%, #121826 100%)",
          borderRight: "1px solid #1F2630",
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
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
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              fontSize: "20px",
            }}
          >
            ✶
          </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.25em",
              color: "#E6E8EB",
              lineHeight: "1.2",
            }}
          >
            AURA
            <br />
            ENGINE
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: "24px" }}>
            <a
              href="/dashboard"
              style={{
                display: "flex",
                alignItems: "center",
                height: "44px",
                padding: "12px",
                borderRadius: "10px",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "#FFFFFF",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "600",
                letterSpacing: "0.18em",
                marginBottom: "4px",
              }}
            >
              DASHBOARD
            </a>
            <a
              href="/campaigns"
              style={{
                display: "flex",
                alignItems: "center",
                height: "44px",
                padding: "12px",
                borderRadius: "10px",
                color: "#C7CDD6",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "500",
                letterSpacing: "0.18em",
                marginBottom: "4px",
              }}
            >
              CAMPAIGNS
            </a>
            <a
              href="/products"
              style={{
                display: "flex",
                alignItems: "center",
                height: "44px",
                padding: "12px",
                borderRadius: "10px",
                color: "#C7CDD6",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "500",
                letterSpacing: "0.18em",
                marginBottom: "4px",
              }}
            >
              PRODUCTS
            </a>
            <a
              href="/models"
              style={{
                display: "flex",
                alignItems: "center",
                height: "44px",
                padding: "12px",
                borderRadius: "10px",
                color: "#C7CDD6",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "500",
                letterSpacing: "0.18em",
                marginBottom: "4px",
              }}
            >
              MODELS
            </a>
            <a
              href="/scenes"
              style={{
                display: "flex",
                alignItems: "center",
                height: "44px",
                padding: "12px",
                borderRadius: "10px",
                color: "#C7CDD6",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "500",
                letterSpacing: "0.18em",
                marginBottom: "4px",
              }}
            >
              SCENES
            </a>
            <a
              href="/credits"
              style={{
                display: "flex",
                alignItems: "center",
                height: "44px",
                padding: "12px",
                borderRadius: "10px",
                color: "#C7CDD6",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "500",
                letterSpacing: "0.18em",
                marginBottom: "4px",
              }}
            >
              CREDITS
            </a>
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
            <a href="/help">HELP</a>
            <a href="/terms">TERMS</a>
            */}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
              }}
            >
              🔍
            </div>
            <input
              type="text"
              placeholder="Search for a project or a product…"
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
              }}
            />
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
        <main style={{ padding: "32px", flex: 1, backgroundColor: "#FFFFFF" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                backgroundColor: "rgba(139, 92, 246, 0.1)",
                border: "2px solid rgba(139, 92, 246, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                fontSize: "32px",
              }}
            >
              ✶
            </div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "#1E293B",
                marginBottom: "16px",
                lineHeight: "1.2",
              }}
            >
              Welcome to Aura Engine
            </h1>
            <p
              style={{
                fontSize: "18px",
                color: "#64748B",
                marginBottom: "32px",
                maxWidth: "500px",
                lineHeight: "1.6",
              }}
            >
              Create stunning AI-powered campaigns with virtual try-on
              technology. Upload your products, models, and scenes to generate
              professional marketing content.
            </p>
            <div style={{ display: "flex", gap: "16px" }}>
              <button
                onClick={() => {
                  setAuthMode("register");
                  setShowAuthModal(true);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#d42f48",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Get Started
              </button>
              <button
                onClick={() => {
                  setAuthMode("login");
                  setShowAuthModal(true);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "transparent",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#374151",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Sign In
              </button>
            </div>
          </div>
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
