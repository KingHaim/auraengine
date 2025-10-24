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
                className={`bg-gray-800 rounded-2xl p-4 border border-gray-700 ${
                  campaign.generation_status === "generating"
                    ? "opacity-75"
                    : ""
                }`}
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
    </div>
  );
}
