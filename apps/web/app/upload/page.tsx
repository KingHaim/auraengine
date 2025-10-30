"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";

export default function UploadPage() {
  const { user, token, loading } = useAuth();
  const [mode, setMode] = useState<"packshot" | "backshot">("packshot");
  const [product, setProduct] = useState<File | null>(null);
  const [scene, setScene] = useState<File | null>(null);
  const [mods, setMods] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0E1115",
          color: "#E6E8EB",
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  async function handleGenerate() {
    if (!product) return alert("Upload a product image");

    setIsGenerating(true);

    try {
      const fd = new FormData();
      fd.append("mode", mode);
      fd.append("user_mods", mods);
      fd.append("angle", "front");
      fd.append("background", "white");
      fd.append("reflection", "false");
      fd.append("shadow_strength", "0.35");
      fd.append("variants", "1");
      fd.append("product", product);
      if (mode === "backshot" && scene) fd.append("scene_or_model", scene);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        }
      );

      if (!res.ok) {
        throw new Error("Generation failed");
      }

      const json = await res.json();
      console.log(json.urls);

      // Redirect to preview with results
      router.push(
        `/preview?urls=${encodeURIComponent(JSON.stringify(json.urls))}`
      );
    } catch (error) {
      console.error("Generation error:", error);
      alert("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
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
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "#FFFFFF",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: "600",
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
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          ></div>
        </header>

        {/* Main Content */}
        <main style={{ padding: "32px", flex: 1, backgroundColor: "#FFFFFF" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#9BA3AF",
              letterSpacing: "0.18em",
              marginTop: "8px",
              marginBottom: "16px",
            }}
          >
            UPLOAD PRODUCT
          </div>

          <div style={{ maxWidth: "800px" }}>
            {/* Mode Selection */}
            <div style={{ marginBottom: "32px" }}>
              <div
                style={{ display: "flex", gap: "12px", marginBottom: "16px" }}
              >
                <button
                  onClick={() => setMode("packshot")}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    fontWeight: "500",
                    transition: "all 0.2s",
                    backgroundColor:
                      mode === "packshot"
                        ? "#d42f48"
                        : "rgba(255,255,255,0.05)",
                    color: mode === "packshot" ? "#FFFFFF" : "#C7CDD6",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  📦 Packshot
                </button>
                <button
                  onClick={() => setMode("backshot")}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    fontWeight: "500",
                    transition: "all 0.2s",
                    backgroundColor:
                      mode === "backshot"
                        ? "#d42f48"
                        : "rgba(255,255,255,0.05)",
                    color: mode === "backshot" ? "#FFFFFF" : "#C7CDD6",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  👕 Virtual Try-On
                </button>
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#6B7280",
                  padding: "12px",
                  backgroundColor: "#F9FAFB",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <strong>
                  {mode === "packshot" ? "Packshot:" : "Virtual Try-On:"}
                </strong>{" "}
                {mode === "packshot"
                  ? "Generate professional product photos with clean backgrounds"
                  : "See how clothing looks on models using AI (requires model photo)"}
              </div>
            </div>

            {/* Product Upload */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#090a0c",
                  marginBottom: "8px",
                }}
              >
                Product image (photo or PNG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProduct(e.target.files?.[0] || null)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#090a0c",
                }}
              />
              {product && (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6B7280",
                    marginTop: "4px",
                  }}
                >
                  Selected: {product.name}
                </p>
              )}
            </div>

            {/* Model Upload (Virtual Try-On only) */}
            {mode === "backshot" && (
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#090a0c",
                    marginBottom: "8px",
                  }}
                >
                  Model photo (person wearing the clothing)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setScene(e.target.files?.[0] || null)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#090a0c",
                  }}
                />
                {scene && (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      marginTop: "4px",
                    }}
                  >
                    Selected: {scene.name}
                  </p>
                )}
              </div>
            )}

            {/* Modifications */}
            <div style={{ marginBottom: "32px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#090a0c",
                  marginBottom: "8px",
                }}
              >
                Modifications (optional)
              </label>
              <textarea
                placeholder="Example: Add sunlight from the right, change shirt to navy blue…"
                value={mods}
                onChange={(e) => setMods(e.target.value)}
                style={{
                  width: "100%",
                  height: "120px",
                  padding: "12px",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#090a0c",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!product || isGenerating}
              style={{
                width: "100%",
                padding: "16px 24px",
                borderRadius: "12px",
                backgroundColor:
                  !product || isGenerating ? "#9CA3AF" : "#d42f48",
                color: "#FFFFFF",
                fontWeight: "500",
                border: "none",
                cursor: !product || isGenerating ? "not-allowed" : "pointer",
                fontSize: "16px",
                transition: "all 0.2s",
              }}
            >
              {isGenerating ? "Generating..." : "Generate Mockups"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
