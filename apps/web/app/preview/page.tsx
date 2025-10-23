"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function PreviewPage() {
  const searchParams = useSearchParams();
  const [urls, setUrls] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const urlsParam = searchParams.get("urls");
    if (urlsParam) {
      try {
        const parsedUrls = JSON.parse(decodeURIComponent(urlsParam));
        setUrls(parsedUrls);
        if (parsedUrls.length > 0) {
          setSelectedImage(parsedUrls[0]);
        }
      } catch (error) {
        console.error("Error parsing URLs:", error);
      }
    }
  }, [searchParams]);

  const handleDownload = async (url: string, index: number) => {
    setIsDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `aura-mockup-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      for (let i = 0; i < urls.length; i++) {
        await handleDownload(urls[i], i);
        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  if (urls.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          backgroundColor: "#0E1115",
          color: "#E6E8EB",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>
            No images to preview
          </h1>
          <a
            href="/upload"
            style={{
              color: "#d42f48",
              textDecoration: "none",
              fontSize: "16px",
            }}
          >
            ← Back to Upload
          </a>
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
          width: "256px",
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
            PREVIEW RESULTS
          </div>

          <div
            style={{
              display: "flex",
              gap: "24px",
              height: "calc(100vh - 200px)",
            }}
          >
            {/* Thumbnail Grid */}
            <div
              style={{
                width: "200px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                overflowY: "auto",
              }}
            >
              {urls.map((url, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedImage(url)}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: "8px",
                    overflow: "hidden",
                    cursor: "pointer",
                    border:
                      selectedImage === url
                        ? "2px solid #d42f48"
                        : "2px solid transparent",
                    transition: "all 0.2s",
                  }}
                >
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Main Preview */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#F9FAFB",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  overflow: "hidden",
                }}
              >
                {selectedImage && (
                  <img
                    src={selectedImage}
                    alt="Selected preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() =>
                    selectedImage &&
                    handleDownload(selectedImage, urls.indexOf(selectedImage))
                  }
                  disabled={!selectedImage || isDownloading}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    borderRadius: "8px",
                    backgroundColor:
                      !selectedImage || isDownloading ? "#9CA3AF" : "#d42f48",
                    color: "#FFFFFF",
                    fontWeight: "500",
                    border: "none",
                    cursor:
                      !selectedImage || isDownloading
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s",
                  }}
                >
                  {isDownloading ? "Downloading..." : "Download Selected"}
                </button>
                <button
                  onClick={handleDownloadAll}
                  disabled={isDownloading}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    borderRadius: "8px",
                    backgroundColor: isDownloading ? "#9CA3AF" : "#22D3EE",
                    color: "#FFFFFF",
                    fontWeight: "500",
                    border: "none",
                    cursor: isDownloading ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    transition: "all 0.2s",
                  }}
                >
                  {isDownloading ? "Downloading..." : "Download All"}
                </button>
                <a
                  href="/upload"
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    color: "#090a0c",
                    fontWeight: "500",
                    textDecoration: "none",
                    textAlign: "center",
                    fontSize: "14px",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Generate More
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
