"use client";
import { User, ShoppingBag, Image as ImageIcon } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  thumbnail: string;
  models: number;
  products: number;
  images: number;
}

interface CampaignCardProps {
  campaign: Campaign;
}

export default function CampaignCard({ campaign }: CampaignCardProps) {
  return (
    <article className="bg-ui-card rounded-2xl overflow-hidden hover:bg-[#1A1F26] transition-colors border border-ui-border">
      <div className="aspect-[16/9] relative">
        <img
          src={campaign.thumbnail}
          alt={campaign.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-white">{campaign.title}</h3>
        <div className="mt-2 flex items-center gap-4 text-sm text-gray-400">
          <span className="inline-flex items-center gap-1">
            <User size={16} className="text-gray-500" />
            {campaign.models}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShoppingBag size={16} className="text-gray-500" />
            {campaign.products}
          </span>
          <span className="inline-flex items-center gap-1">
            <ImageIcon size={16} className="text-gray-500" />
            {campaign.images}
          </span>
        </div>
      </div>
    </article>
  );
}
