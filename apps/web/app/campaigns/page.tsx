"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

// Add CSS for spinner animation
const spinnerCSS = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  packshots: string[];
  category?: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

interface Model {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  gender?: string;
  poses?: string[];
  created_at: string;
  updated_at?: string;
}

interface Scene {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  is_standard: boolean;
  category?: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

interface Generation {
  id: string;
  product_id: string;
  model_id: string;
  scene_id: string;
  mode: string;
  prompt: string;
  output_urls: string[];
  video_urls?: string[];
  status: string;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  generation_status: string;
  settings: any;
  generations?: Generation[];
  created_at: string;
  updated_at?: string;
}

export default function CampaignsPage() {
  const { user, token, loading } = useAuth();

  // Inject spinner CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = spinnerCSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [showBulkVideoModal, setShowBulkVideoModal] = useState(false);
  const [selectedCampaignForBulkVideo, setSelectedCampaignForBulkVideo] = useState<any>(null);
  const [showCampaignProfileModal, setShowCampaignProfileModal] = useState(false);
  const [selectedCampaignForProfile, setSelectedCampaignForProfile] = useState<any>(null);
  const [lastGeneratedImages, setLastGeneratedImages] = useState<string[]>([]);
  const [currentDisplayedImage, setCurrentDisplayedImage] = useState<string | null>(null);
  const [showVideoModelDropdown, setShowVideoModelDropdown] = useState(false);
  const [forceLoaded, setForceLoaded] = useState(false);
  const [generatingCampaignId, setGeneratingCampaignId] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim() || !token) return;

    setCreatingCampaign(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newCampaignName.trim(),
        }),
      });

      if (response.ok) {
        const newCampaign = await response.json();
        setCampaigns([newCampaign, ...campaigns]);
        setNewCampaignName("");
        setShowCreateModal(false);
      } else {
        throw new Error("Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign. Please try again.");
    } finally {
      setCreatingCampaign(false);
    }
  };

  // Function to get last generated images from campaigns
  const getLastGeneratedImages = () => {
    const allImages: string[] = [];

    campaigns.forEach((campaign) => {
      if (campaign.settings?.generated_images?.length > 0) {
        campaign.settings.generated_images.forEach((img: any) => {
          if (img.image_url) {
            allImages.push(img.image_url);
          }
        });
      }
    });

    // Sort by campaign creation date (most recent first) and take last 2
    const sortedImages = allImages.slice(-2).reverse();
    setLastGeneratedImages(sortedImages);

    // Set the most recent image as current displayed image
    if (sortedImages.length > 0 && !currentDisplayedImage) {
      setCurrentDisplayedImage(sortedImages[0]);
    }

    console.log("🖼️ Last generated images:", sortedImages);
  };

  // Function to fetch data from API
  const fetchData = async () => {
    if (!token) {
      console.log("No token available, skipping fetch");
      return null;
    }

    try {
      console.log("🔍 Fetching campaigns data from API...");
      console.log("Token:", token.substring(0, 20) + "...");

      // Fetch all data in parallel
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

      console.log("API Response statuses:", {
        campaigns: campaignsRes.status,
        products: productsRes.status,
        models: modelsRes.status,
        scenes: scenesRes.status,
      });

      let campaignsData = [];
      if (campaignsRes.ok) {
        campaignsData = await campaignsRes.json();
        console.log("🔍 fetchData - Raw campaigns data:", campaignsData);
        console.log(
          "🔍 fetchData - Number of campaigns:",
          campaignsData.length
        );
        campaignsData.forEach((campaign: any, index: number) => {
          console.log(`🔍 fetchData - Campaign ${index}:`, {
            id: campaign.id,
            name: campaign.name,
            generation_status: campaign.generation_status,
            status: campaign.status,
          });
        });
        setCampaigns(campaignsData);
        console.log(
          "🔍 fetchData - setCampaigns called with:",
          campaignsData.length,
          "campaigns"
        );
      } else {
        console.error(
          "Campaigns fetch failed:",
          campaignsRes.status,
          await campaignsRes.text()
        );
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        console.log("Products data:", productsData);
        setProducts(productsData);
      } else {
        console.error(
          "Products fetch failed:",
          productsRes.status,
          await productsRes.text()
        );
      }

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        console.log("Models data:", modelsData);
        setModels(modelsData);
      } else {
        console.error(
          "Models fetch failed:",
          modelsRes.status,
          await modelsRes.text()
        );
      }

      if (scenesRes.ok) {
        const scenesData = await scenesRes.json();
        console.log("🎬 Scenes data:", scenesData);
        console.log("🎬 Scenes count:", scenesData.length);
        console.log("🎬 First scene:", scenesData[0]);
        setScenes(scenesData);
      } else {
        console.error(
          "❌ Scenes fetch failed:",
          scenesRes.status,
          await scenesRes.text()
        );
      }

      console.log("✅ Fetched all campaigns data");
      return campaignsData;
    } catch (error) {
      console.error("💥 Error fetching campaigns data:", error);
      return [];
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    console.log("📊 Fetching real data from API...");
    if (token) {
      fetchData();
    }
  }, [token]);

  // Debug modal state
  useEffect(() => {
    console.log("🎭 Modal state changed:", showCreateModal);
  }, [showCreateModal]);

  // Debug data state
  useEffect(() => {
    console.log("📊 Data state:", {
      campaigns: campaigns.length,
      products: products.length,
      models: models.length,
      scenes: scenes.length,
      user: user?.email,
      token: token ? "present" : "missing",
    });
    console.log("📊 Products data:", products);
    console.log("📊 Models data:", models);
    console.log("📊 Scenes data:", scenes);
  }, [campaigns, products, models, scenes, user, token]);

  // Close video model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showVideoModelDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-dropdown="video-model"]')) {
          setShowVideoModelDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVideoModelDropdown]);

  // Force loading to resolve after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("⏰ Force loading timeout reached");
      setForceLoaded(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Clear generating state when campaign is completed
  useEffect(() => {
    if (generatingCampaignId) {
      const campaign = campaigns.find((c) => c.id === generatingCampaignId);
      if (campaign && campaign.generation_status === "completed") {
        console.log(
          "🔍 Campaign completed, clearing generating state for:",
          generatingCampaignId
        );
        setGeneratingCampaignId(null);

        // Show the first generated image in the left panel
        if (campaign.settings?.generated_images?.length > 0) {
          const firstImage = campaign.settings.generated_images[0];
          console.log("🖼️ First image object from polling:", firstImage);
          console.log(
            "🖼️ Setting generated image URL from polling:",
            firstImage.image_url
          );
          setGeneratedImageUrl(firstImage.image_url);
          setCurrentDisplayedImage(firstImage.image_url);
        } else {
          console.log("❌ No generated images found in campaign from polling");
        }
      }
    }
  }, [campaigns, generatingCampaignId]);

  // Update last generated images when campaigns change
  useEffect(() => {
    getLastGeneratedImages();
  }, [campaigns]);

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
          <div style={{ fontSize: "24px", marginBottom: "16px" }}>⏳</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user || !token) {
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
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
          <h2 style={{ marginBottom: "16px" }}>Authentication Required</h2>
          <p style={{ marginBottom: "24px", color: "#9BA3AF" }}>
            Please log in to access your campaigns
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
      </div>
    );
  }

  return (
    <AppLayout>
      <div
        style={{
          padding: "0",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {/* Main Content Area */}
        <div style={{ padding: "32px", flex: 1, backgroundColor: "#FFFFFF" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "#1F2937",
                margin: 0,
              }}
            >
              Campaigns
            </h1>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#d42f48",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#b0263c";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#d42f48";
              }}
            >
              + Create Campaign
            </button>
          </div>

          {/* Campaign Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "24px",
            }}
          >
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  border: "1px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: 0,
                    }}
                  >
                    {campaign.name}
                  </h3>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => {
                        setSelectedCampaignForBulkVideo(campaign);
                        setShowBulkVideoModal(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#d42f48",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#b0263c";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#d42f48";
                      }}
                    >
                      🎬 Videos
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCampaignForProfile(campaign);
                        setShowCampaignProfileModal(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#6B7280",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#4B5563";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#6B7280";
                      }}
                    >
                      👁️ View
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    color: "#6B7280",
                    marginBottom: "16px",
                  }}
                >
                  {campaign.settings?.generated_images?.length || 0} images
                  {campaign.settings?.generated_images?.length > 0 && (
                    <span style={{ marginLeft: "8px", color: "#10B981" }}>
                      ✓ Generated
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "#9CA3AF",
                  }}
                >
                  Created: {new Date(campaign.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                color: "#1F2937",
                margin: "0 0 24px 0",
              }}
            >
              Create New Campaign
            </h2>
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Campaign Name
              </label>
              <input
                type="text"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="Enter campaign name..."
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "16px",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "transparent",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={!newCampaignName.trim() || creatingCampaign}
                style={{
                  padding: "12px 24px",
                  backgroundColor: newCampaignName.trim() && !creatingCampaign ? "#d42f48" : "#D1D5DB",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontSize: "16px",
                  cursor: newCampaignName.trim() && !creatingCampaign ? "pointer" : "not-allowed",
                }}
              >
                {creatingCampaign ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

