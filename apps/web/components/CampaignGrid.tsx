"use client";

import CampaignCard from "./CampaignCard";

const sampleCampaigns = [
  {
    id: "1",
    title: "Harry Potter x Blvck",
    thumbnail: "https://picsum.photos/800/600?random=1",
    models: 2,
    products: 2,
    images: 9,
  },
  {
    id: "2",
    title: "Harry Potter x Blvck",
    thumbnail: "https://picsum.photos/800/600?random=2",
    models: 2,
    products: 2,
    images: 9,
  },
  {
    id: "3",
    title: "Harry Potter x Blvck",
    thumbnail: "https://picsum.photos/800/600?random=3",
    models: 2,
    products: 2,
    images: 9,
  },
  {
    id: "4",
    title: "Harry Potter x Blvck",
    thumbnail: "https://picsum.photos/800/600?random=4",
    models: 2,
    products: 2,
    images: 9,
  },
  {
    id: "5",
    title: "Harry Potter x Blvck",
    thumbnail: "https://picsum.photos/800/600?random=5",
    models: 2,
    products: 2,
    images: 9,
  },
];

export default function CampaignGrid() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white uppercase tracking-wideish">
        CAMPAIGNS
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleCampaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="bg-gray-800 rounded-2xl p-4 border border-gray-700"
          >
            <div className="aspect-video bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
              <img
                src={campaign.thumbnail}
                alt={campaign.title}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <h3 className="font-semibold text-white mb-2">{campaign.title}</h3>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>👥 {campaign.models}</span>
              <span>🛍️ {campaign.products}</span>
              <span>🖼️ {campaign.images}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
