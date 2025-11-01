"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

// Add CSS for spinner animation
const spinnerCSS = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

interface Scene {
  id: string;
  name: string;
  description: string;
  image_url: string;
  is_standard: boolean;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export default function ScenesPage() {
  const { user, token, loading } = useAuth();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [newScene, setNewScene] = useState({
    name: "",
    description: "",
    category: "",
    tags: "",
    image: null as File | null,
  });

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Inject spinner CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = spinnerCSS;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Fetch scenes when user is authenticated
  useEffect(() => {
    if (user && token) {
      fetchScenes();
    }
  }, [user, token]);

  const fetchScenes = async () => {
    try {
      setScenesLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/scenes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const scenesData = await response.json();
        setScenes(scenesData);
      } else {
        console.error("Failed to fetch scenes");
      }
    } catch (error) {
      console.error("Error fetching scenes:", error);
    } finally {
      setScenesLoading(false);
    }
  };

  const handleUploadScene = async () => {
    if (!newScene.name || !newScene.image) {
      alert("Please fill in scene name and select an image");
      return;
    }

    if (!token) {
      alert("Please log in to upload scenes");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newScene.name);
      formData.append("description", newScene.description);
      formData.append("category", newScene.category);
      formData.append("tags", newScene.tags);
      formData.append("image", newScene.image);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/scenes/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Scene uploaded:", result);
        alert(`✅ Scene "${result.name}" uploaded successfully!`);

        // Refresh scenes list
        await fetchScenes();

        // Reset form
        setNewScene({
          name: "",
          description: "",
          category: "",
          tags: "",
          image: null,
        });
        setShowUploadModal(false);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Scene upload failed:", error);
      alert(`❌ Scene upload failed: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: "#0E1115",
          color: "#E6E8EB",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <img
            src="/beating.gif"
            alt="Loading"
            style={{
              width: "60px",
              height: "60px",
              objectFit: "contain",
              margin: "0 auto 12px",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <div style={{ fontSize: "14px", color: "#9BA3AF" }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user || !token) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
        <h2 style={{ marginBottom: "16px" }}>Authentication Required</h2>
        <p style={{ marginBottom: "24px", color: "#9BA3AF" }}>
          Please log in to access your scene library
        </p>
        <a
          href="/"
          style={{
            padding: "12px 24px",
            backgroundColor: "#d42f48",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "500",
          }}
        >
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: isMobile ? "16px" : "32px" }}>
        <div
          style={{
            marginBottom: isMobile ? "20px" : "32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: isMobile ? "20px" : "24px",
                fontWeight: "700",
                color: "#1E293B",
                marginBottom: "8px",
              }}
            >
              Scene Library
            </h1>
            {!isMobile && (
              <p
                style={{
                  fontSize: "14px",
                  color: "#64748B",
                  margin: "4px 0 0 0",
                }}
              >
                Manage your background scenes for campaigns
              </p>
            )}
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              width: isMobile ? "48px" : "auto",
              height: isMobile ? "48px" : "auto",
              padding: isMobile ? "0" : "12px 24px",
              backgroundColor: isMobile ? "transparent" : "#d42f48",
              color: isMobile ? "#d42f48" : "white",
              border: isMobile ? "2px solid #d42f48" : "none",
              borderRadius: isMobile ? "50%" : "8px",
              fontSize: isMobile ? "24px" : "14px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (isMobile) {
                e.currentTarget.style.backgroundColor = "#d42f48";
                e.currentTarget.style.color = "white";
              } else {
                e.currentTarget.style.transform = "scale(1.05)";
              }
            }}
            onMouseLeave={(e) => {
              if (isMobile) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#d42f48";
              } else {
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            {isMobile ? (
              <span>+</span>
            ) : (
              <>
                <span>+</span> Add Scene
              </>
            )}
          </button>
        </div>

        {scenesLoading ? (
          <div
            className="scenes-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              alignItems: "start",
            }}
          >
            {[...Array(6)].map((_, index) => (
              <div
                key={`loading-${index}`}
                className="scene-card"
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  position: "relative",
                  background: "#E5E7EB",
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  maxWidth: "100%",
                  aspectRatio: "1",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    position: "relative",
                    overflow: "hidden",
                    backgroundColor: "#D1D5DB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src="/beating.gif"
                    alt="Loading"
                    style={{
                      width: "48px",
                      height: "48px",
                      animation: "pulse 2s ease-in-out infinite",
                    }}
                    onError={(e) => {
                      // Fallback to heart.png if beating.gif doesn't exist
                      e.currentTarget.src = "/heart.png";
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : scenes.length === 0 ? (
          <div
            style={{
              backgroundColor: "#F9FAFB",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              padding: "40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏞️</div>
            <h4
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1F2937",
                marginBottom: "8px",
              }}
            >
              No scenes yet
            </h4>
            <p
              style={{
                fontSize: "14px",
                color: "#6B7280",
                marginBottom: "16px",
              }}
            >
              Upload your first scene to get started
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#d42f48",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Add Scene
            </button>
          </div>
        ) : (
          <div
            className="scenes-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              alignItems: "start",
            }}
          >
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className="scene-card"
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                  position: "relative",
                  background: "#FFFFFF",
                  aspectRatio: "1",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(9, 10, 12, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={scene.image_url}
                    alt={scene.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      e.currentTarget.src =
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjE1NyIgdmlld0JveD0iMCAwIDI4MCAxNTciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMTU3IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjAgNzguNUgxNjBWMTA4LjVIMTIwVjc4LjVaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0xMjAgMTE4LjVIMTYwVjEyOC41SDEyMFYxMTguNVoiIGZpbGw9IiM5Q0EzQUYiLz4KPHRleHQgeD0iMTQwIiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzZCNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U2NlbmUgVW5hdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPg==";
                      e.currentTarget.alt = "Scene unavailable";
                    }}
                  />
                  {scene.is_standard && (
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        backgroundColor: "rgba(212, 47, 72, 0.9)",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: "600",
                        letterSpacing: "0.5px",
                        zIndex: 2,
                      }}
                    >
                      STANDARD
                    </div>
                  )}
                  {/* Scene name overlay - mobile only */}
                  <div
                    className="scene-title-overlay"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background:
                        "linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent)",
                      padding: "8px 12px",
                      color: "#FFFFFF",
                      fontSize: isMobile ? "11px" : "12px",
                      fontWeight: "600",
                      display: isMobile ? "block" : "none",
                    }}
                  >
                    {scene.name}
                  </div>
                </div>
                {/* Scene info section - desktop only */}
                {!isMobile && (
                  <div style={{ padding: "12px" }}>
                    <h3
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#1F2937",
                        marginBottom: "4px",
                      }}
                    >
                      {scene.name}
                    </h3>
                    {scene.description && (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6B7280",
                          marginBottom: "8px",
                          lineHeight: "1.4",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {scene.description}
                      </p>
                    )}
                    {scene.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                        }}
                      >
                        {scene.tags.slice(0, 2).map((tag, index) => (
                          <span
                            key={index}
                            style={{
                              backgroundColor: "#F3F4F6",
                              color: "#6B7280",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: "500",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {scene.tags.length > 2 && (
                          <span
                            style={{
                              backgroundColor: "#F3F4F6",
                              color: "#6B7280",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: "500",
                            }}
                          >
                            +{scene.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(9, 10, 12, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              width: "500px",
              maxWidth: "90vw",
              maxHeight: "85vh",
              overflow: "auto",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  color: "#1F2937",
                  fontSize: "20px",
                  fontWeight: "600",
                  margin: 0,
                }}
              >
                Upload New Scene
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6B7280",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Scene Name *
              </label>
              <input
                type="text"
                value={newScene.name}
                onChange={(e) =>
                  setNewScene({ ...newScene, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "#F9FAFB",
                  color: "#1F2937",
                }}
                placeholder="Enter scene name"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Description
              </label>
              <textarea
                value={newScene.description}
                onChange={(e) =>
                  setNewScene({ ...newScene, description: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  minHeight: "60px",
                  resize: "vertical",
                  backgroundColor: "#F9FAFB",
                  color: "#1F2937",
                }}
                placeholder="Enter scene description"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Category
              </label>
              <select
                value={newScene.category}
                onChange={(e) =>
                  setNewScene({ ...newScene, category: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <option value="">Select a category</option>
                <option value="studio">Studio</option>
                <option value="outdoor">Outdoor</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="urban">Urban</option>
                <option value="nature">Nature</option>
                <option value="indoor">Indoor</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Tags
              </label>
              <input
                type="text"
                value={newScene.tags}
                onChange={(e) =>
                  setNewScene({ ...newScene, tags: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "#F9FAFB",
                  color: "#1F2937",
                }}
                placeholder="Enter tags separated by commas (e.g., modern, bright, professional)"
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Scene Image *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setNewScene({
                    ...newScene,
                    image: e.target.files?.[0] || null,
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "#F9FAFB",
                }}
              />
              {newScene.image && (
                <div
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={URL.createObjectURL(newScene.image)}
                    alt="Preview"
                    style={{
                      width: "80px",
                      height: "80px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      backgroundColor: "#FFF",
                    }}
                  />
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>
                    {newScene.image.name}
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#F3F4F6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadScene}
                disabled={uploading || !newScene.name || !newScene.image}
                style={{
                  padding: "12px 24px",
                  backgroundColor:
                    uploading || !newScene.name || !newScene.image
                      ? "#D1D5DB"
                      : "#d42f48",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor:
                    uploading || !newScene.name || !newScene.image
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {uploading ? "Uploading..." : "Upload Scene"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
