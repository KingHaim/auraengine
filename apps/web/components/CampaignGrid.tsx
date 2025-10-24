"use client";

import { useEffect, useState } from "react";

type ApiCampaign = {
  id: string;
  name: string;
  generation_status: string;
  settings?: any;
};

type CampaignGridProps = {
  refreshTrigger?: number;
};

export default function CampaignGrid({ refreshTrigger }: CampaignGridProps) {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<ApiCampaign | null>(null);

  // Function to open campaign modal
  const openCampaignModal = (campaign: ApiCampaign) => {
    setSelectedCampaign(campaign);
    setShowCampaignModal(true);
  };

  // Function to check campaign status
  const checkCampaignStatus = async (campaignId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/status`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const statusData = await res.json();
        return statusData;
      }
    } catch (e) {
      console.error("Failed to check campaign status", e);
    }
    return null;
  };

  // Function to fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        console.log("🔍 CampaignGrid - fetchCampaigns data:", data);
        console.log(
          "🔍 CampaignGrid - First campaign generated_images:",
          data[0]?.settings?.generated_images
        );
        console.log(
          "🔍 CampaignGrid - First campaign generated_images length:",
          data[0]?.settings?.generated_images?.length
        );
        console.log(
          "🔍 CampaignGrid - First campaign first image:",
          data[0]?.settings?.generated_images?.[0]
        );
        console.log(
          "🔍 CampaignGrid - First campaign first image URL:",
          data[0]?.settings?.generated_images?.[0]?.image_url
        );
        setCampaigns(data);
      }
    } catch (e) {
      console.error("Failed to load campaigns", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Refresh campaigns when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchCampaigns();
    }
  }, [refreshTrigger]);

  // Polling for generating campaigns
  useEffect(() => {
    const generatingCampaigns = campaigns.filter(
      (campaign) => campaign.generation_status === "generating"
    );

    console.log("🔍 CampaignGrid - Polling check:", {
      totalCampaigns: campaigns.length,
      generatingCampaigns: generatingCampaigns.length,
      generatingIds: generatingCampaigns.map((c) => c.id),
    });

    if (generatingCampaigns.length === 0) return;

    const interval = setInterval(async () => {
      console.log("🔍 CampaignGrid - Polling interval triggered");
      for (const campaign of generatingCampaigns) {
        const statusData = await checkCampaignStatus(campaign.id);
        console.log(
          `🔍 CampaignGrid - Status check for ${campaign.id}:`,
          statusData
        );
        if (statusData && statusData.generation_status !== "generating") {
          // Campaign finished generating, refresh the list
          console.log(
            `🔍 CampaignGrid - Campaign ${campaign.id} finished, refreshing...`
          );
          fetchCampaigns();
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white uppercase tracking-wideish">
        CAMPAIGNS
      </h1>
      {loading ? (
        <div className="text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => {
            const thumb =
              campaign.settings?.generated_images?.[0]?.image_url || "";
            console.log(
              `🔍 CampaignGrid - Campaign ${campaign.id} thumb:`,
              thumb
            );
            console.log(
              `🔍 CampaignGrid - Campaign ${campaign.id} generated_images:`,
              campaign.settings?.generated_images
            );
            return (
              <div
                key={campaign.id}
                className={`bg-gray-800 rounded-2xl p-4 border border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors ${
                  campaign.generation_status === "generating"
                    ? "opacity-75"
                    : ""
                }`}
                onClick={() => openCampaignModal(campaign)}
              >
                <div className="aspect-video bg-gray-700 rounded-lg mb-4 flex items-center justify-center relative">
                  {campaign.generation_status === "generating" ? (
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                      <div className="text-white text-sm font-medium">
                        Generando...
                      </div>
                    </div>
                  ) : thumb ? (
                    <img
                      src={thumb}
                      alt={campaign.name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        console.log(
                          `🔍 CampaignGrid - Image load error for ${campaign.id}:`,
                          thumb
                        );
                        console.log(`🔍 CampaignGrid - Error event:`, e);
                        (
                          e.currentTarget as HTMLImageElement
                        ).src = `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`;
                      }}
                      onLoad={() => {
                        console.log(
                          `🔍 CampaignGrid - Image loaded successfully for ${campaign.id}:`,
                          thumb
                        );
                      }}
                    />
                  ) : (
                    <div className="text-gray-500">No images yet</div>
                  )}
                </div>
                <h3 className="font-semibold text-white mb-2">
                  {campaign.name}
                </h3>
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>
                    🖼️ {campaign.settings?.generated_images?.length || 0}
                  </span>
                  {campaign.generation_status === "generating" && (
                    <span className="text-blue-400">⏳ Generando...</span>
                  )}
                  {campaign.generation_status === "failed" && (
                    <span className="text-red-400">❌ Error</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campaign Details Modal */}
      {showCampaignModal && selectedCampaign && (
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
            overflow: "auto",
          }}
          onClick={() => setShowCampaignModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              width: "1000px",
              position: "relative",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1F2937",
                }}
              >
                {selectedCampaign.name}
              </h2>
              <button
                onClick={() => setShowCampaignModal(false)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#6B7280",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                backgroundColor: "#F9FAFB",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Status: {selectedCampaign.generation_status}
              </p>
              <p
                style={{
                  margin: "0",
                  fontSize: "14px",
                  color: "#6B7280",
                }}
              >
                Campaign ID: {selectedCampaign.id}
              </p>
            </div>

            {selectedCampaign.settings?.generated_images && selectedCampaign.settings.generated_images.length > 0 && (
              <div>
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Generated Images ({selectedCampaign.settings.generated_images.length})
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {selectedCampaign.settings.generated_images.map((image: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <img
                        src={image.image_url}
                        alt={`Generated image ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "200px",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`;
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
