"use client";

import { useEffect, useState } from "react";

type ApiCampaign = {
  id: string;
  name: string;
  settings?: any;
};

export default function CampaignGrid() {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data);
        }
      } catch (e) {
        console.error("Failed to load campaigns", e);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

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
          const thumb = campaign.settings?.generated_images?.[0]?.image_url || "";
          return (
          <div
            key={campaign.id}
            className="bg-gray-800 rounded-2xl p-4 border border-gray-700"
          >
            <div className="aspect-video bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
              {thumb ? (
                <img
                  src={thumb}
                  alt={campaign.name}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`;
                  }}
                />
              ) : (
                <div className="text-gray-500">No images yet</div>
              )}
            </div>
            <h3 className="font-semibold text-white mb-2">{campaign.name}</h3>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>🖼️ {campaign.settings?.generated_images?.length || 0}</span>
            </div>
          </div>
          );
        })}
      </div>) }
    </div>
  );
}
