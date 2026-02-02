"use client";
// Force rebuild - workflow buttons deployment v2
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

// Add CSS for spinner animation
const spinnerCSS = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes heartbeat {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
`;

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  packshots: string[];
  packshot_front_url?: string;
  packshot_back_url?: string;
  category?: string;
  clothing_type?: string; // Important: clothing_type field
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
  const [isMobile, setIsMobile] = useState(false);

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
      document.head.removeChild(style);
    };
  }, []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    description: "",
  });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const scenesSliderRef = useRef<HTMLDivElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingInModal, setIsGeneratingInModal] = useState(false);
  const [generatingCampaign, setGeneratingCampaign] = useState<string | null>(
    null
  );
  const [forceLoaded, setForceLoaded] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [selectedPoses, setSelectedPoses] = useState<{
    [modelId: string]: string[];
  }>({});
  const [selectedManikinPose, setSelectedManikinPose] =
    useState<string>("Pose-neutral.jpg");
  const [poseImageUrls, setPoseImageUrls] = useState<{ [key: string]: string }>(
    {}
  );
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState<{
    [key: string]: string;
  }>({});
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptModalData, setPromptModalData] = useState<{
    generationId: string;
    imageIndex: number;
  } | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [videoQuality, setVideoQuality] = useState("480p");
  const [videoModel, setVideoModel] = useState("wan");
  const [videoDuration, setVideoDuration] = useState("5s");

  // Parameter selection modal state
  const [showParameterModal, setShowParameterModal] = useState(false);
  const [selectedCampaignForGeneration, setSelectedCampaignForGeneration] =
    useState<Campaign | null>(null);
  const [selectedProductsForGeneration, setSelectedProductsForGeneration] =
    useState<string[]>([]);
  const [selectedModelForGeneration, setSelectedModelForGeneration] =
    useState<string>("");
  const [selectedScenesForGeneration, setSelectedScenesForGeneration] =
    useState<string[]>([]);
  const [selectedPosesForGeneration, setSelectedPosesForGeneration] = useState<{
    [key: string]: string[];
  }>({});
  const [numberOfImagesToGenerate, setNumberOfImagesToGenerate] = useState(1);
  const [showCampaignProfileModal, setShowCampaignProfileModal] =
    useState(false);
  const [selectedCampaignForProfile, setSelectedCampaignForProfile] =
    useState<Campaign | null>(null);
  const [showEnlargedImage, setShowEnlargedImage] = useState(false);
  const [generatingFullCampaign, setGeneratingFullCampaign] = useState<
    string | null
  >(null);
  const [generatingCampaignVideos, setGeneratingCampaignVideos] = useState<
    string | null
  >(null);
  
  // NEW: Keyframe generation modal state
  const [showKeyframeModal, setShowKeyframeModal] = useState(false);
  const [keyframeCount, setKeyframeCount] = useState(4);
  const [generatingKeyframes, setGeneratingKeyframes] = useState(false);
  const [keyframeProgress, setKeyframeProgress] = useState({ current: 0, total: 0, currentName: "" });
  const [keyframeStartTime, setKeyframeStartTime] = useState<number | null>(null);
  const [generatingUnifiedVideo, setGeneratingUnifiedVideo] = useState<
    string | null
  >(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string>("");
  const [enlargedImageAlt, setEnlargedImageAlt] = useState<string>("");
  const [showBulkVideoModal, setShowBulkVideoModal] = useState(false);
  const [selectedCampaignForBulkVideo, setSelectedCampaignForBulkVideo] =
    useState<Campaign | null>(null);
  const [bulkVideoCustomPrompt, setBulkVideoCustomPrompt] = useState("");
  const [bulkVideoQuality, setBulkVideoQuality] = useState("480p");
  const [bulkVideoModel, setBulkVideoModel] = useState("wan");
  const [bulkVideoDuration, setBulkVideoDuration] = useState("5s");
  const [generatingBulkVideos, setGeneratingBulkVideos] = useState(false);
  const [showVideoModelDropdown, setShowVideoModelDropdown] = useState(false);

  // Helper function to get video model information
  const getVideoModelInfo = (model: string) => {
    const models = {
      wan: {
        name: "Wan 2.2 I2V Fast",
        icon: "⚡",
        badge: "FAST",
        badgeColor: "#DCFCE7",
        badgeTextColor: "#166534",
        description: "Quick and efficient video generation",
        pricing: "480p (1 credit) • 720p (2 credits)",
      },
      seedance: {
        name: "Seedance 1 Pro",
        icon: "🎭",
        badge: "PRO",
        badgeColor: "#FEF3C7",
        badgeTextColor: "#D97706",
        description:
          "High-quality video generation with multiple duration options",
        pricing: "480p/1080p • 5s/10s • 2-6 credits",
      },
      veo: {
        name: "Google Veo 3.1",
        icon: "⭐",
        badge: "PREMIUM",
        badgeColor: "#F0F9FF",
        badgeTextColor: "#0EA5E9",
        description: "Premium AI video generation with advanced capabilities",
        pricing: "480p/720p/1080p • 5s/10s • 3-8 credits",
      },
      kling: {
        name: "Kling 2.5 Turbo Pro",
        icon: "⚡",
        badge: "PRO",
        badgeColor: "#FEF3C7",
        badgeTextColor: "#D97706",
        description: "Professional-grade video generation with turbo speed",
        pricing: "480p/720p/1080p • 5s/10s • 2-6 credits",
      },
    };
    return models[model as keyof typeof models];
  };
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(
    new Set()
  );
  const [selectMode, setSelectMode] = useState(false);
  const [showTweakModal, setShowTweakModal] = useState(false);
  const [tweakPrompt, setTweakPrompt] = useState("");
  const [tweaking, setTweaking] = useState(false);
  const [currentImageForTweak, setCurrentImageForTweak] = useState<string>("");
  const [reapplyingClothes, setReapplyingClothes] = useState(false);
  const [addingProductToImage, setAddingProductToImage] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState<
    string | null
  >(null);
  const [productSelectionMode, setProductSelectionMode] = useState<
    "campaign" | "image"
  >("campaign");
  const [currentImageMetadata, setCurrentImageMetadata] = useState<any>(null);
  const [selectedImagesForVideo, setSelectedImagesForVideo] = useState<
    Set<number>
  >(new Set());
  const [veoDirectMode, setVeoDirectMode] = useState(false);
  const [generatingCampaignId, setGeneratingCampaignId] = useState<
    string | null
  >(null);
  const [showModelSelectionModal, setShowModelSelectionModal] = useState(false);
  const [showProductSelectionModal, setShowProductSelectionModal] =
    useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [showDownloadTooltip, setShowDownloadTooltip] = useState(false);
  const [showTweakTooltip, setShowTweakTooltip] = useState(false);
  const [showAddProductTooltip, setShowAddProductTooltip] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [lastGeneratedImages, setLastGeneratedImages] = useState<string[]>([]);
  const [currentDisplayedImage, setCurrentDisplayedImage] = useState<
    string | null
  >(null);

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
      setIsLoadingCampaigns(false);
      return null;
    }

    try {
      setIsLoadingCampaigns(true);
      console.log("🔍 Fetching campaigns data from API...");
      console.log("Token:", token.substring(0, 20) + "...");

      // Fetch all data in parallel
      const [campaignsRes, productsRes, modelsRes, scenesRes, posesRes] =
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
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/poses`),
        ]);

      // Handle pose URLs
      if (posesRes.ok) {
        const posesData = await posesRes.json();
        if (posesData.poses) {
          setPoseImageUrls(posesData.poses);
        }
      } else {
        console.error("Error fetching pose URLs:", posesRes.status);
      }

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

        // Debug: Check if any campaign has videos
        campaignsData.forEach((campaign: any) => {
          if (campaign.settings?.videos) {
            console.log(
              `📹 Campaign ${campaign.id} (${campaign.name}) has ${campaign.settings.videos.length} videos in settings`
            );
          }
          if (campaign.settings?.generated_images) {
            const imagesWithVideos = campaign.settings.generated_images.filter(
              (img: any) => img.video_url
            );
            if (imagesWithVideos.length > 0) {
              console.log(
                `📹 Campaign ${campaign.id} (${campaign.name}) has ${imagesWithVideos.length} images with video_url`
              );
            }
          }
        });

        // Ensure all campaigns have required properties
        campaignsData = campaignsData.map((campaign: any) => ({
          ...campaign,
          settings: campaign.settings || {},
          generation_status: campaign.generation_status || "pending",
          status: campaign.status || "draft",
        }));
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
        // Log detailed product info, especially clothing_type
        productsData.forEach((product: any) => {
          console.log(`🔍 Product "${product.name}":`, {
            id: product.id,
            clothing_type: product.clothing_type,
            clothingType: product.clothingType,
            category: product.category,
            all_keys: Object.keys(product),
          });
        });
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
      setIsLoadingCampaigns(false);
      return campaignsData;
    } catch (error) {
      console.error("💥 Error fetching campaigns data:", error);
      setIsLoadingCampaigns(false);
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

  const handleCreateCampaign = async () => {
    console.log("🔍 handleCreateCampaign called");

    if (
      !newCampaign.name ||
      selectedProducts.length === 0 ||
      !selectedModel ||
      selectedScenes.length === 0
    ) {
      console.log("❌ Validation failed - missing fields");
      alert(
        "Please fill in campaign name and select at least one product, model, and scene"
      );
      return;
    }

    if (!token) {
      alert("Please log in to create campaigns");
      return;
    }

    console.log("🎯 Creating campaign with:", {
      name: newCampaign.name,
      products: selectedProducts.length,
      models: selectedModel ? 1 : 0,
      scenes: selectedScenes.length,
    });

    setIsCreating(true);
    setIsGeneratingInModal(true);
    console.log("🔍 Set isCreating to true and starting generation in modal");

    // Clear any previous generated image
    setGeneratedImageUrl(null);

    try {
      const formData = new FormData();
      formData.append("name", newCampaign.name);
      formData.append("description", newCampaign.description);
      formData.append("product_ids", JSON.stringify(selectedProducts));
      formData.append("model_ids", JSON.stringify([selectedModel]));
      formData.append("scene_ids", JSON.stringify(selectedScenes));
      formData.append("selected_poses", JSON.stringify(selectedPoses));
      formData.append("manikin_pose", selectedManikinPose);
      formData.append("number_of_images", numberOfImagesToGenerate.toString());

      console.log("🔍 About to make fetch request to create campaign");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/create`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );
      console.log("🔍 Fetch request completed");

      console.log("🔍 Response status:", response.status);
      console.log("🔍 Response ok:", response.ok);

      if (response.ok) {
        console.log("🔍 Response is OK, processing...");
        const result = await response.json();
        console.log("✅ Campaign created:", result);
        console.log("🔍 Campaign ID from result:", result.campaign?.id);

        // Set generating state immediately for instant feedback
        console.log("🔍 About to set generatingCampaignId...");
        console.log("🔍 result.campaign:", result.campaign);
        console.log("🔍 result.campaign.id:", result.campaign?.id);
        console.log(
          "🔍 typeof result.campaign.id:",
          typeof result.campaign?.id
        );

        if (!result.campaign?.id) {
          console.error("❌ ERROR: result.campaign.id is undefined or null!");
          throw new Error("Campaign ID is missing from response");
        }

        setGeneratingCampaignId(result.campaign.id);
        console.log("🔍 Set generatingCampaignId to:", result.campaign.id);

        // Add the new campaign to the list immediately with generating status
        const newCampaignWithGeneratingStatus = {
          ...result.campaign,
          generation_status: "generating",
        };
        console.log(
          "🔍 Adding new campaign to list immediately:",
          newCampaignWithGeneratingStatus
        );
        setCampaigns((prevCampaigns) => [
          newCampaignWithGeneratingStatus,
          ...prevCampaigns,
        ]);

        // Refresh campaigns list to get the real campaign data
        console.log("🔍 Before fetchData, campaigns count:", campaigns.length);
        const freshCampaignsData = await fetchData();
        console.log(
          "🔍 After fetchData, fresh campaigns data:",
          freshCampaignsData
        );
        console.log("🔍 Looking for campaign with ID:", result.campaign.id);
        const newCampaign = freshCampaignsData?.find(
          (c: any) => c.id === result.campaign.id
        );
        console.log("🔍 Found campaign:", newCampaign);
        if (newCampaign) {
          console.log(
            "🔍 Campaign generation_status:",
            newCampaign.generation_status
          );
          console.log("🔍 Campaign settings:", newCampaign.settings);
          console.log(
            "🔍 Generated images:",
            newCampaign.settings?.generated_images
          );
          // Replace the temporary campaign with the real one from the server
          setCampaigns((prevCampaigns) =>
            prevCampaigns.map((campaign) =>
              campaign.id === result.campaign.id ? newCampaign : campaign
            )
          );
          // If campaign is already completed, clear the generating state and show the image
          if (newCampaign.generation_status === "completed") {
            console.log(
              "🔍 Campaign already completed, clearing generating state"
            );
            setGeneratingCampaignId(null);

            // Show the first generated image in the left panel
            if (newCampaign.settings?.generated_images?.length > 0) {
              const firstImage = newCampaign.settings.generated_images[0];
              console.log("🖼️ First image object:", firstImage);
              console.log(
                "🖼️ Setting generated image URL:",
                firstImage.image_url
              );
              setGeneratedImageUrl(firstImage.image_url);
              setCurrentDisplayedImage(firstImage.image_url);
            } else {
              console.log("❌ No generated images found in campaign");
            }
          }
        }

        // Reset form
        setNewCampaign({ name: "", description: "" });
        setSelectedProducts([]);
        setSelectedModel("");
        setSelectedScenes([]);

        // Show alert after UI has been updated
        alert(
          `✅ Campaign "${result.campaign.name}" created successfully! Generating preview image...`
        );

        // Poll for campaign completion
        const campaignId = result.campaign.id;
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/status`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log("📊 Campaign status:", statusData);

              if (statusData.generation_status === "completed") {
                clearInterval(pollInterval);
                await fetchData(); // Refresh campaigns list
                alert(
                  "✅ Preview image generated! Open the campaign to see it."
                );
              } else if (statusData.generation_status === "failed") {
                clearInterval(pollInterval);
                alert("❌ Preview generation failed");
              }
            }
          } catch (pollError) {
            console.error("Error polling campaign status:", pollError);
          }
        }, 3000); // Poll every 3 seconds

        // Clear interval after 5 minutes timeout
        setTimeout(() => {
          clearInterval(pollInterval);
        }, 300000);
      } else {
        console.log("❌ Response not OK - Status:", response.status);
        console.log("❌ Response not OK - StatusText:", response.statusText);
        const error = await response.text();
        console.error("❌ Campaign creation failed:", response.status);
        console.error("Error details:", error);
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign creation failed:", error);
      alert(
        "Campaign creation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsCreating(false);
      setIsGeneratingInModal(false);
    }
  };

  const handleGenerateCampaign = async (campaignId: string) => {
    if (!token) {
      alert("Please log in to generate campaign images");
      return;
    }

    setGeneratingCampaign(campaignId);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Campaign generation completed:", result);
        alert(
          `✅ Campaign generation completed! Generated ${result.completed}/${result.total} images.`
        );

        // Refresh campaigns list
        await fetchData();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign generation failed:", error);
      alert(
        "Campaign generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setGeneratingCampaign(null);
    }
  };

  const handleGenerateFullCampaign = async (campaignId: string) => {
    console.log("🚀 Generate All Poses clicked! Campaign ID:", campaignId);
    console.log("🔑 Token exists:", !!token);
    console.log("🌐 API URL:", process.env.NEXT_PUBLIC_API_URL);

    if (!token) {
      alert("Please log in to generate full campaign");
      return;
    }

    setGeneratingFullCampaign(campaignId);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/generate-all-poses`;
      console.log("📡 Calling endpoint:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("📬 Response status:", response.status);
      console.log("📬 Response ok:", response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Full campaign generation started:", result);
        alert(
          `✅ Generating ${result.remaining_poses.length} additional poses for full campaign!`
        );

        // Poll for completion and fetch data for real-time updates
        const pollInterval = setInterval(async () => {
          // Fetch updated campaign data to show new images
          await fetchData();

          const statusResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/status`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.generation_status === "completed") {
              clearInterval(pollInterval);
              setGeneratingFullCampaign(null);
              await fetchData();
              alert("🎉 Full campaign completed with all poses!");
            } else if (statusData.generation_status === "failed") {
              clearInterval(pollInterval);
              setGeneratingFullCampaign(null);
              alert("❌ Full campaign generation failed");
            }
          }
        }, 3000); // Poll every 3 seconds for faster updates

        // Clear interval after 10 minutes timeout
        setTimeout(() => {
          clearInterval(pollInterval);
          setGeneratingFullCampaign(null);
        }, 600000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Full campaign generation failed:", error);
      alert(
        "Full campaign generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      setGeneratingFullCampaign(null);
    }
  };

  const handleGenerateCampaignVideos = async (campaignId: string) => {
    if (!token) {
      alert("Please log in to generate videos");
      return;
    }

    setGeneratingCampaignVideos(campaignId);
    try {
      const formData = new FormData();
      formData.append("duration", "5"); // 5 seconds
      formData.append("cfg_scale", "0.5");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/generate-videos`,
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
        console.log("✅ Video generation started:", result);
        alert(
          `🎬 Generating videos for ${result.image_count} images! This may take a few minutes...`
        );

        // Poll for completion
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/status`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const videoStatus =
              statusData.campaign?.settings?.video_generation_status;

            if (videoStatus === "completed") {
              clearInterval(pollInterval);
              setGeneratingCampaignVideos(null);
              await fetchData();

              // Update the selected campaign modal if it's open for this campaign
              if (selectedCampaignForProfile?.id === campaignId) {
                setSelectedCampaignForProfile(statusData.campaign);
              }

              alert("🎉 All campaign videos generated successfully!");
            }
          }
        }, 10000); // Poll every 10 seconds (videos take longer)

        // Clear interval after 30 minutes timeout
        setTimeout(() => {
          clearInterval(pollInterval);
          setGeneratingCampaignVideos(null);
        }, 1800000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Video generation failed:", error);
      alert(
        "Video generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      setGeneratingCampaignVideos(null);
    }
  };

  const handleGenerateUnifiedVideo = async (campaignId: string) => {
    if (!token) {
      alert("Please log in to generate unified video");
      return;
    }

    console.log("🎬 Generating unified campaign video for:", campaignId);
    setGeneratingUnifiedVideo(campaignId);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/generate-unified-video`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Unified video generation started:", result);
        alert(
          `🎥 Creating final campaign video with ${result.video_count} clips! This may take a few minutes...`
        );

        // Poll for completion
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/status`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const unifiedStatus =
              statusData.campaign?.settings?.unified_video_status;

            if (unifiedStatus === "completed") {
              clearInterval(pollInterval);
              setGeneratingUnifiedVideo(null);
              await fetchData();

              // Update the selected campaign modal if it's open for this campaign
              if (selectedCampaignForProfile?.id === campaignId) {
                setSelectedCampaignForProfile(statusData.campaign);
              }

              alert("🎉 Final campaign video created successfully!");
            } else if (unifiedStatus === "failed") {
              clearInterval(pollInterval);
              setGeneratingUnifiedVideo(null);
              alert("❌ Unified video generation failed. Please try again.");
            }
          }
        }, 10000); // Poll every 10 seconds

        // Clear interval after 30 minutes timeout
        setTimeout(() => {
          clearInterval(pollInterval);
          setGeneratingUnifiedVideo(null);
        }, 1800000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Unified video generation failed:", error);
      alert(
        "Unified video generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      setGeneratingUnifiedVideo(null);
    }
  };

  const toggleSelection = (
    id: string,
    type: "products" | "models" | "scenes"
  ) => {
    switch (type) {
      case "products":
        setSelectedProducts((prev) =>
          prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        );
        break;
      case "models":
        if (selectedModel === id) {
          // Deselecting the currently selected model - clear all poses for this model
          setSelectedPoses((prevPoses) => ({
            ...prevPoses,
            [id]: [],
          }));
          setSelectedModel("");
        } else {
          // Selecting a new model - clear poses for the previous model and select new one
          setSelectedPoses((prevPoses) => ({
            ...prevPoses,
            [selectedModel]: [], // Clear poses for previous model
          }));
          setSelectedModel(id);
        }
        break;
      case "scenes":
        setSelectedScenes((prev) =>
          prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
        break;
    }
  };

  const viewCampaignDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowCampaignModal(true);
  };

  const handleOpenCampaignProfile = (campaign: Campaign) => {
    console.log("📹 Opening campaign profile:", campaign.name);
    console.log("📹 Campaign videos:", campaign.settings?.videos);
    console.log("📹 Video count:", campaign.settings?.videos?.length || 0);
    setSelectedCampaignForProfile(campaign);
    setShowCampaignProfileModal(true);
  };

  const handleEnlargeImage = (
    imageUrl: string,
    alt: string,
    metadata?: any
  ) => {
    setEnlargedImageUrl(imageUrl);
    setEnlargedImageAlt(alt);
    setCurrentImageForTweak(imageUrl);
    setCurrentImageMetadata(metadata || null);
    setShowEnlargedImage(true);
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename || "campaign-image.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reapplyClothes = async () => {
    if (!token) {
      alert("Please log in to reapply clothes");
      return;
    }

    // Try to get product_id from image metadata or from campaign settings
    let productId = currentImageMetadata?.product_id;
    let clothingType = currentImageMetadata?.clothing_type || "top";

    // If no product_id in image, try to get from campaign settings
    const productIds = selectedCampaignForProfile?.settings?.product_ids;
    if (!productId && productIds?.length && productIds.length > 0) {
      productId = productIds[0];
      console.log("Using product_id from campaign settings:", productId);
    }

    if (!productId) {
      alert("❌ Cannot reapply clothes: product information not available");
      return;
    }

    setReapplyingClothes(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reapply-clothes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            image_url: currentImageForTweak,
            product_id: productId,
            clothing_type: clothingType,
            campaign_id: selectedCampaignForProfile?.id || null,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update the enlarged image with the new result immediately
        setEnlargedImageUrl(data.reapplied_url);
        setCurrentImageForTweak(data.reapplied_url);

        // Refresh campaign data to show updated image in the grid
        await fetchData();

        // Show success message after refresh
        alert(
          `✅ ${data.message}\n\nThe image has been updated with the new try-on result.`
        );
      } else {
        const error = await response.json();
        alert(`❌ Reapply clothes failed: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error reapplying clothes:", error);
      alert("❌ Failed to reapply clothes. Please try again.");
    } finally {
      setReapplyingClothes(false);
    }
  };

  const addProductToImage = async (productId: string) => {
    if (!token) {
      alert("Please log in to add products");
      return;
    }

    if (!productId) {
      alert("❌ Please select a product");
      return;
    }

    // Get product to find clothing_type
    const product = products.find((p) => p.id === productId);
    if (!product) {
      alert("❌ Product not found");
      return;
    }

    // Get clothing_type from product - check both snake_case and camelCase, and category as fallback
    // API returns clothing_type as null but category has the correct value ("pants", "tshirt", etc.)
    let clothingType =
      product.clothing_type ||
      (product as any).clothingType ||
      product.category ||
      "";

    console.log("🔍 Raw clothing_type from product:", product.clothing_type);
    console.log(
      "🔍 Raw clothingType from product:",
      (product as any).clothingType
    );
    console.log(
      "🔍 Raw category from product (using as fallback):",
      product.category
    );

    // If clothing_type is missing or wrong, try to detect from product name
    if (!clothingType || clothingType === "top") {
      const productNameLower = (product.name || "").toLowerCase();
      if (
        productNameLower.includes("pant") ||
        productNameLower.includes("bottom")
      ) {
        clothingType = "pants";
      } else if (productNameLower.includes("short")) {
        clothingType = "shorts";
      } else if (productNameLower.includes("skirt")) {
        clothingType = "skirt";
      } else if (
        productNameLower.includes("shirt") ||
        productNameLower.includes("tshirt")
      ) {
        clothingType = "tshirt";
      } else if (productNameLower.includes("sweater")) {
        clothingType = "sweater";
      } else if (productNameLower.includes("jacket")) {
        clothingType = "jacket";
      } else if (!clothingType) {
        clothingType = "top"; // Default fallback
      }
    }

    console.log(
      "👕 Adding product to image - Product:",
      product.name,
      "Clothing Type:",
      clothingType
    );
    console.log("🔍 Product data:", product);

    // Validate required fields
    if (!currentImageForTweak) {
      console.error("❌ No image selected for adding product");
      alert("❌ Please select an image first by clicking on it");
      return;
    }

    console.log("🔍 API Request details:", {
      image_url: currentImageForTweak?.substring(0, 80) + "...",
      product_id: productId,
      clothing_type: clothingType,
      campaign_id: selectedCampaignForProfile?.id || null,
    });

    setAddingProductToImage(true);
    setShowProductSelectionModal(false);

    try {
      const requestBody = {
        image_url: currentImageForTweak,
        product_id: productId,
        clothing_type: clothingType,
        campaign_id: selectedCampaignForProfile?.id || null,
      };

      console.log("📤 Making API call to /reapply-clothes:", {
        url: `${process.env.NEXT_PUBLIC_API_URL}/reapply-clothes`,
        method: "POST",
        body: requestBody,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reapply-clothes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log(
        "📥 API Response status:",
        response.status,
        response.statusText
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ API Response data:", data);
        console.log("✅ Reapplied URL:", data.reapplied_url);

        // Update the enlarged image with the new result immediately
        if (data.reapplied_url) {
          setEnlargedImageUrl(data.reapplied_url);
          setCurrentImageForTweak(data.reapplied_url);
          console.log("✅ Updated enlarged image URL");

          // Refresh campaign data to show updated image in the grid
          await fetchData();
          console.log("✅ Refreshed campaign data");

          // Show success message after refresh
          alert(
            `✅ Successfully added ${
              data.product_name || product.name
            } to the image!\n\nThe image has been updated.`
          );
        } else {
          console.error("❌ API response missing reapplied_url:", data);
          alert("❌ API response is missing the updated image URL");
        }
      } else {
        const errorText = await response.text();
        console.error("❌ API Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        let errorDetail = "Unknown error";
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorJson.message || errorText;
        } catch {
          errorDetail = errorText;
        }
        alert(`❌ Failed to add product (${response.status}): ${errorDetail}`);
      }
    } catch (error) {
      console.error("❌ Error adding product to image:", error);
      if (error instanceof Error) {
        console.error("❌ Error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      alert(
        `❌ Failed to add product: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setAddingProductToImage(false);
      setSelectedProductForImage(null);
      setProductSelectionMode("campaign");
    }
  };

  const tweakImage = async () => {
    if (!tweakPrompt.trim()) {
      alert("Please enter a prompt for tweaking");
      return;
    }

    if (!token) {
      alert("Please log in to tweak images");
      return;
    }

    setTweaking(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tweak-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: currentImageForTweak,
            prompt: tweakPrompt,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Tweak result:", result);

        // Update the enlarged image with the tweaked version
        setEnlargedImageUrl(result.tweaked_url);
        setCurrentImageForTweak(result.tweaked_url);
        setShowTweakModal(false);
        setTweakPrompt("");

        alert("✅ Image tweaked successfully!");
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Tweak failed");
      }
    } catch (error) {
      console.error("Tweak failed:", error);
      alert(
        "❌ Tweak failed:\n" +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setTweaking(false);
    }
  };

  const deleteCampaignImage = async (
    campaignId: string,
    imageIndex: number
  ) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    if (!token) {
      alert("Please log in to delete images");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/images/${imageIndex}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Image deleted:", result);

        alert(
          `✅ Image deleted successfully! ${result.remaining_images} images remaining.`
        );

        // Refresh campaign data
        await fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Delete failed");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert(
        "❌ Delete failed:\n" +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const toggleCampaignSelection = (campaignId: string) => {
    setSelectedCampaigns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };

  const selectAllCampaigns = () => {
    if (selectedCampaigns.size === campaigns.length) {
      setSelectedCampaigns(new Set());
    } else {
      setSelectedCampaigns(new Set(campaigns.map((c) => c.id)));
    }
  };

  const bulkDeleteCampaigns = async () => {
    if (selectedCampaigns.size === 0) {
      alert("No campaigns selected");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedCampaigns.size} campaign(s)?`
      )
    ) {
      return;
    }

    if (!token) {
      alert("Please log in to delete campaigns");
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const campaignId of selectedCampaigns) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            console.error(
              `Failed to delete campaign ${campaignId}:`,
              await response.text()
            );
          }
        } catch (error) {
          failCount++;
          console.error(`Error deleting campaign ${campaignId}:`, error);
        }
      }

      alert(
        `Bulk delete completed:\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`
      );

      // Refresh campaigns and reset selection
      await fetchData();
      setSelectedCampaigns(new Set());
      setSelectMode(false);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Bulk delete failed: " + String(error));
    }
  };

  const editCampaign = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setEditingCampaign(campaign);
    setEditForm({
      name: campaign.name,
      description: campaign.description || "",
    });
    setShowEditModal(true);
  };

  const deleteCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click

    if (
      !confirm(
        "Are you sure you want to delete this campaign? This action cannot be undone."
      )
    ) {
      return;
    }

    if (!token) {
      alert("Please log in to delete campaigns");
      return;
    }

    setIsDeleting(campaignId);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert("Campaign deleted successfully!");
        // Refresh campaigns list
        await fetchData();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign deletion failed:", error);
      alert(
        "Campaign deletion failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateCampaign = async () => {
    if (!editingCampaign || !token) {
      return;
    }

    if (!editForm.name.trim()) {
      alert("Campaign name is required");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${editingCampaign.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: editForm.name,
            description: editForm.description,
          }),
        }
      );

      if (response.ok) {
        alert("Campaign updated successfully!");
        // Refresh campaigns list
        await fetchData();
        setShowEditModal(false);
        setEditingCampaign(null);
        setEditForm({ name: "", description: "" });
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign update failed:", error);
      alert(
        "Campaign update failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const generateMoreImages = async (campaign: Campaign) => {
    if (!token) {
      alert("Please log in to generate images");
      return;
    }

    // Check if campaign has a base image - if yes, show keyframe modal
    const generatedImages = campaign.settings?.generated_images || [];
    if (generatedImages.length > 0) {
      // Campaign has images - show simpler keyframe generation modal
      setSelectedCampaignForGeneration(campaign);
      setShowKeyframeModal(true);
      return;
    }

    // No base image yet - show full parameter modal
    setSelectedCampaignForGeneration(campaign);
    setSelectedProductsForGeneration(campaign.settings?.product_ids || []);
    setSelectedModelForGeneration(campaign.settings?.model_ids?.[0] || "");
    setSelectedScenesForGeneration(campaign.settings?.scene_ids || []);
    setSelectedPosesForGeneration(campaign.settings?.selected_poses || {});
    setShowParameterModal(true);
  };
  
  // NEW: Generate keyframe variations from existing base image
  const executeKeyframeGeneration = async () => {
    if (!selectedCampaignForGeneration || !token) {
      return;
    }

    setGeneratingKeyframes(true);
    setKeyframeProgress({ current: 0, total: keyframeCount, currentName: "Starting..." });
    setKeyframeStartTime(Date.now());
    
    try {
      const formData = new FormData();
      formData.append("number_of_keyframes", keyframeCount.toString());

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${selectedCampaignForGeneration.id}/generate-keyframes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        // Start polling for progress AND refresh images in real-time
        const campaignId = selectedCampaignForGeneration.id;
        let lastSeenProgress = 0;
        
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/keyframe-progress`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (statusRes.ok) {
              const status = await statusRes.json();
              const currentProgress = status.current || 0;
              
              setKeyframeProgress({
                current: currentProgress,
                total: status.total || keyframeCount,
                currentName: status.current_name || "Processing...",
              });
              
              // Refresh campaign data whenever a new image is completed
              // This shows images as they're generated!
              if (currentProgress > lastSeenProgress) {
                console.log(`🖼️ New keyframe completed (${currentProgress}/${status.total}), refreshing...`);
                await fetchData();
                lastSeenProgress = currentProgress;
              }
              
              if (status.status === "completed" || status.status === "failed") {
                clearInterval(pollInterval);
                setGeneratingKeyframes(false);
                setShowKeyframeModal(false);
                setKeyframeStartTime(null);
                await fetchData();
                if (status.status === "completed") {
                  alert(`✅ Generated ${status.current} keyframes successfully!`);
                }
              }
            }
          } catch (pollError) {
            console.error("Polling error:", pollError);
          }
        }, 3000); // Poll every 3 seconds
        
        // Safety timeout after 15 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setGeneratingKeyframes(false);
          fetchData();
        }, 15 * 60 * 1000);
        
      } else {
        const error = await response.json();
        alert(`Failed to generate keyframes: ${error.detail || "Unknown error"}`);
        setGeneratingKeyframes(false);
      }
    } catch (error) {
      console.error("Error generating keyframes:", error);
      alert("Failed to generate keyframes. Please try again.");
      setGeneratingKeyframes(false);
    }
  };

  const executeImageGeneration = async () => {
    if (!selectedCampaignForGeneration || !token) {
      return;
    }

    setGeneratingMore(true);
    try {
      const formData = new FormData();
      formData.append(
        "product_ids",
        JSON.stringify(selectedProductsForGeneration)
      );
      formData.append(
        "model_ids",
        JSON.stringify([selectedModelForGeneration])
      );
      formData.append("scene_ids", JSON.stringify(selectedScenesForGeneration));
      formData.append(
        "selected_poses",
        JSON.stringify(selectedPosesForGeneration)
      );
      formData.append("number_of_images", numberOfImagesToGenerate.toString());

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${selectedCampaignForGeneration.id}/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        alert("Generating more images for this campaign!");
        // Refresh campaigns list to show updated images
        await fetchData();
        setShowParameterModal(false);
        setShowGenerateModal(false);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Image generation failed:", error);
      alert(
        "Image generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setGeneratingMore(false);
    }
  };

  const generateVideo = async (
    generationId: string,
    imageIndex: number,
    customPrompt?: string,
    videoQuality: string = "480p",
    videoModel: string = "wan",
    videoDuration: string = "5s"
  ) => {
    if (!token) {
      alert("Please log in to generate videos");
      return;
    }

    setGeneratingVideo(generationId);
    setVideoGenerationStatus((prev) => ({
      ...prev,
      [generationId]: "generating",
    }));

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/generations/${generationId}/generate-video`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video_quality: videoQuality,
            duration: videoDuration,
            model: videoModel,
            custom_prompt: customPrompt || null,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Video generated:", result);
        alert(
          `✅ Video generated successfully! Credits remaining: ${result.credits_remaining}`
        );

        // Update the campaign data to include the video
        if (selectedCampaign && selectedCampaign.settings?.generated_images) {
          const updatedImages = [...selectedCampaign.settings.generated_images];
          if (updatedImages[imageIndex]) {
            updatedImages[imageIndex].video_url = result.video_url;
          }

          setSelectedCampaign({
            ...selectedCampaign,
            settings: {
              ...selectedCampaign.settings,
              generated_images: updatedImages,
            },
          });
        }

        setVideoGenerationStatus((prev) => ({
          ...prev,
          [generationId]: "completed",
        }));
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Video generation failed:", error);
      alert(
        "Video generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      setVideoGenerationStatus((prev) => ({
        ...prev,
        [generationId]: "failed",
      }));
    } finally {
      setGeneratingVideo(null);
    }
  };

  const toggleModelDropdown = (modelId: string) => {
    setExpandedModel(expandedModel === modelId ? null : modelId);
  };

  const closeModelDropdown = () => {
    setExpandedModel(null);
  };

  const togglePoseSelection = (modelId: string, poseUrl: string) => {
    setSelectedPoses((prev) => {
      const currentPoses = prev[modelId] || [];
      const isSelected = currentPoses.includes(poseUrl);

      if (isSelected) {
        // Remove pose
        const newPoses = {
          ...prev,
          [modelId]: currentPoses.filter((url) => url !== poseUrl),
        };

        // If no poses left for this model, deselect the model
        if (newPoses[modelId].length === 0) {
          setSelectedModel("");
        }

        return newPoses;
      } else {
        // Add pose and automatically select the model
        setSelectedModel(modelId);

        return {
          ...prev,
          [modelId]: [...currentPoses, poseUrl],
        };
      }
    });
  };

  const selectAllPoses = (modelId: string, poses: string[]) => {
    setSelectedPoses((prev) => ({
      ...prev,
      [modelId]: poses,
    }));

    // Automatically select the model when selecting all poses
    setSelectedModel(modelId);
  };

  const clearPoseSelection = (modelId: string) => {
    setSelectedPoses((prev) => ({
      ...prev,
      [modelId]: [],
    }));

    // Deselect the model when clearing poses
    setSelectedModel("");
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
    console.log("🔐 No user or token, showing login prompt");
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
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={() => {
                console.log("🧪 Test modal button clicked!");
                setShowCreateModal(true);
              }}
              style={{
                padding: "12px 24px",
                backgroundColor: "#22D3EE",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "500",
                cursor: "pointer",
                marginRight: "12px",
              }}
            >
              🧪 Test Modal (No Auth)
            </button>
          </div>
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
      <style>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
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
            <div>
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: "600",
                  color: "#1E293B",
                  margin: 0,
                }}
              >
                Campaigns
              </h1>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {selectMode && (
                <>
                  <button
                    onClick={selectAllCampaigns}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#64748B",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    {selectedCampaigns.size === campaigns.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                  <button
                    onClick={bulkDeleteCampaigns}
                    disabled={selectedCampaigns.size === 0}
                    style={{
                      padding: "12px 24px",
                      backgroundColor:
                        selectedCampaigns.size === 0 ? "#CBD5E1" : "#EF4444",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor:
                        selectedCampaigns.size === 0
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    🗑️ Delete ({selectedCampaigns.size})
                  </button>
                  <button
                    onClick={() => {
                      setSelectMode(false);
                      setSelectedCampaigns(new Set());
                    }}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#F1F5F9",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      color: "#475569",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
              {!selectMode && (
                <button
                  onClick={() => setSelectMode(true)}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#F1F5F9",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    color: "#475569",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                  className="select-button"
                >
                  ☑️ Select
                </button>
              )}
              <button
                onClick={() => {
                  if (products.length === 0) {
                    alert("Please upload at least one product before creating a campaign. Go to Products page to add products.");
                    return;
                  }
                  console.log("🎯 Create Campaign button clicked!");
                  console.log(
                    "Current showCreateModal state:",
                    showCreateModal
                  );
                  console.log("🎬 Current scenes state:", scenes);
                  console.log("🎬 Scenes length:", scenes.length);
                  setShowCreateModal(true);
                  console.log("Set showCreateModal to true");
                }}
                disabled={products.length === 0}
                title={products.length === 0 ? "Upload products first" : "Create new campaign"}
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: products.length === 0 ? "#4B5563" : "#d42f48",
                  border: "none",
                  borderRadius: "50%",
                  color: "#FFFFFF",
                  fontSize: "24px",
                  fontWeight: "500",
                  cursor: products.length === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  opacity: products.length === 0 ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (products.length > 0) {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.backgroundColor = "#b0263c";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.backgroundColor = products.length === 0 ? "#4B5563" : "#d42f48";
                }}
              >
                +
              </button>
            </div>
          </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#9BA3AF",
              letterSpacing: "0.18em",
              marginBottom: "16px",
            }}
          >
            YOUR CAMPAIGNS ({isLoadingCampaigns ? "..." : campaigns.length})
          </div>

          {isLoadingCampaigns ? (
            <div
              className="campaign-grid"
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
                  className="campaign-card"
                  style={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    position: "relative",
                    background: "#E5E7EB",
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
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
                        animation: "heartbeat 1s ease-in-out infinite",
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
          ) : campaigns.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 32px",
                color: "#6B7280",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: "16px",
                }}
              >
                🎯
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                No campaigns yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                {products.length === 0 
                  ? "First, upload products in the Products page, then come back to create your campaign"
                  : "Create your first campaign by selecting products, models, and scenes"
                }
              </p>
              <button
                onClick={() => {
                  if (products.length === 0) {
                    window.location.href = "/products";
                  } else {
                    setShowCreateModal(true);
                  }
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: products.length === 0 ? "#3B82F6" : "#d42f48",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                {products.length === 0 ? "Go to Products" : "Create Campaign"}
              </button>
            </div>
          ) : (
            <div
              className="campaign-grid"
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
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="campaign-card"
                  style={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    position: "relative",
                    background: "#FFFFFF",
                    opacity:
                      campaign.generation_status === "generating" ||
                      generatingCampaignId === campaign.id
                        ? 0.75
                        : 1,
                    boxShadow: selectedCampaigns.has(campaign.id)
                      ? "0 0 0 3px #d42f48"
                      : "0 2px 8px rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    aspectRatio: "1",
                  }}
                  onClick={(e) => {
                    if (selectMode) {
                      e.stopPropagation();
                      toggleCampaignSelection(campaign.id);
                    } else {
                      handleOpenCampaignProfile(campaign);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 30px rgba(0,0,0,0.15)";
                    const overlay = e.currentTarget.querySelector(
                      "[data-hover-overlay]"
                    ) as HTMLElement;
                    if (overlay) {
                      overlay.style.opacity = "1";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.08)";
                    const overlay = e.currentTarget.querySelector(
                      "[data-hover-overlay]"
                    ) as HTMLElement;
                    if (overlay) {
                      overlay.style.opacity = "0";
                    }
                  }}
                >
                  {/* Checkbox (in select mode) */}
                  {selectMode && (
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        zIndex: 10,
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        backgroundColor: selectedCampaigns.has(campaign.id)
                          ? "#d42f48"
                          : "#FFFFFF",
                        border: selectedCampaigns.has(campaign.id)
                          ? "2px solid #d42f48"
                          : "2px solid #CBD5E1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCampaignSelection(campaign.id);
                      }}
                    >
                      {selectedCampaigns.has(campaign.id) && (
                        <span
                          style={{
                            color: "#FFFFFF",
                            fontSize: "18px",
                            lineHeight: 1,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  )}
                  {/* Campaign Image */}
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      position: "relative",
                      overflow: "hidden",
                      backgroundColor: "#F3F4F6",
                    }}
                  >
                    {/* Semi-transparent title overlay for mobile */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background:
                          "linear-gradient(transparent, rgba(0,0,0,0.7))",
                        color: "white",
                        padding: "8px",
                        fontSize: "12px",
                        fontWeight: "500",
                        textAlign: "center",
                        zIndex: 1,
                        display: "none", // Hidden by default, shown via CSS on mobile
                      }}
                      className="campaign-title-overlay"
                    >
                      {campaign.name}
                    </div>
                    {(() => {
                      const isGenerating =
                        campaign.generation_status === "generating" ||
                        generatingCampaignId === campaign.id;
                      console.log(`🔍 Rendering campaign ${campaign.id}:`, {
                        name: campaign.name,
                        generation_status: campaign.generation_status,
                        generatingCampaignId: generatingCampaignId,
                        isGenerating: isGenerating,
                        hasImages:
                          campaign.settings?.generated_images?.length > 0,
                      });
                      return isGenerating;
                    })() ? (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#454545",
                        }}
                      >
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            border: "2px solid #ffffff",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                            marginBottom: "8px",
                          }}
                        />
                        <div
                          style={{
                            color: "#ffffff",
                            fontSize: "14px",
                            fontWeight: "500",
                          }}
                        >
                          Generando...
                        </div>
                      </div>
                    ) : campaign.settings?.generated_images?.[0]?.image_url ? (
                      <img
                        src={campaign.settings.generated_images[0].image_url}
                        alt={campaign.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          cursor: "pointer",
                        }}
                        onError={(e) => {
                          e.currentTarget.src =
                            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04NSA3NUgxMTVWMTI1SDg1Vjc1WiIgZmlsbD0iIzlDQTNBRiIvPgo8dGV4dCB4PSIxMDAiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNkI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "48px",
                          color: "#9CA3AF",
                        }}
                      >
                        📁
                      </div>
                    )}
                  </div>

                  {/* Campaign Info */}
                  <div
                    style={{
                      padding: "20px",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#1F2937",
                          margin: "0 0 8px 0",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {campaign.name}
                      </h3>
                      {campaign.description && (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#6B7280",
                            margin: 0,
                            lineHeight: 1.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {campaign.description}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        fontSize: "12px",
                        color: "#6B7280",
                        marginTop: "12px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🖼️ {campaign.settings?.generated_images?.length || 0}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🎬{" "}
                        {campaign.settings?.generated_images?.filter(
                          (img: any) => img.video_url
                        )?.length || 0}
                      </span>
                      {(campaign.generation_status === "generating" ||
                        generatingCampaignId === campaign.id) && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "#d42f48",
                            fontWeight: "500",
                          }}
                        >
                          ⏳ Generando...
                        </span>
                      )}
                      {campaign.generation_status === "failed" && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "#EF4444",
                            fontWeight: "500",
                          }}
                        >
                          ❌ Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div
                    data-hover-overlay
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px",
                      opacity: 0,
                      transition: "all 0.3s ease",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "rgba(212, 47, 72, 0.9)",
                        color: "#FFFFFF",
                        padding: "10px 20px",
                        borderRadius: "24px",
                        fontSize: "14px",
                        fontWeight: "600",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      Click to Edit/Delete
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Campaign Modal */}
        {showCreateModal && (
          <div
            style={{
              position: "fixed",
              top: isMobile ? "50px" : 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1001,
              overflow: "auto",
              paddingTop: isMobile ? "0px" : "0px",
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                backgroundColor: "#1F2937",
                borderRadius: isMobile ? "0px" : "16px",
                maxWidth: "100vw",
                maxHeight: isMobile ? "100vh" : "95vh",
                width: isMobile ? "100%" : "min(1400px, 95vw)",
                height: isMobile ? "100%" : "min(800px, 95vh)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
              }}
              onClick={(e) => {
                e.stopPropagation();
                closeModelDropdown();
              }}
            >
              {/* Mobile Close Button */}
              {isMobile && (
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    width: "40px",
                    height: "40px",
                    backgroundColor: "rgba(0, 0, 0, 0.7)",
                    border: "none",
                    borderRadius: "50%",
                    color: "#FFFFFF",
                    fontSize: "24px",
                    cursor: "pointer",
                    zIndex: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              )}

              {/* Left Panel - Visual Display (40% width) */}
              <div
                style={{
                  width: isMobile ? "100%" : "40%",
                  height: isMobile ? "200px" : "100%",
                  backgroundColor: "#111827",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  order: isMobile ? -1 : 0,
                }}
              >
                {/* Generation Overlay */}
                {isGeneratingInModal && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      backdropFilter: "blur(8px)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 100,
                      gap: "20px",
                    }}
                  >
                    <img
                      src="/beating.gif"
                      alt="Generating..."
                      style={{
                        width: "150px",
                        height: "150px",
                        objectFit: "contain",
                      }}
                    />
                    <div
                      style={{
                        color: "#FFFFFF",
                        fontSize: "18px",
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      Generating Campaign...
                    </div>
                    <div
                      style={{
                        color: "#E5E7EB",
                        fontSize: "14px",
                        textAlign: "center",
                        maxWidth: "200px",
                      }}
                    >
                      Creating your campaign with AI models
                    </div>
                  </div>
                )}
                {/* History/Previous Generations - Top Left */}
                <div
                  style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {/* Undo/Refresh Icon */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      backgroundColor: "rgba(9, 10, 12, 0.7)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#FFFFFF",
                      fontSize: "18px",
                    }}
                    title="Undo/Refresh"
                  >
                    ↶
                  </div>

                  {/* History Thumbnails */}
                  {lastGeneratedImages.length > 0 ? (
                    lastGeneratedImages.slice(0, 2).map((imageUrl, index) => (
                      <div
                        key={index}
                        onClick={() => setCurrentDisplayedImage(imageUrl)}
                        style={{
                          width: "60px",
                          height: "60px",
                          backgroundImage: `url(${imageUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          borderRadius: "8px",
                          cursor: "pointer",
                          border:
                            currentDisplayedImage === imageUrl
                              ? "2px solid #d42f48"
                              : "1px solid #6B7280",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {currentDisplayedImage === imageUrl && (
                          <div
                            style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              width: "16px",
                              height: "16px",
                              backgroundColor: "#d42f48",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              color: "#FFFFFF",
                              fontWeight: "bold",
                            }}
                          >
                            ✓
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <>
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          backgroundColor: "#454545",
                          borderRadius: "8px",
                          border: "1px solid #6B7280",
                          backgroundImage:
                            'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23454545"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="white" font-size="12">Preview</text></svg>\')',
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          opacity: 0.5,
                        }}
                      />
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          backgroundColor: "#454545",
                          borderRadius: "8px",
                          border: "1px solid #6B7280",
                          backgroundImage:
                            'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23454545"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="white" font-size="12">Previous</text></svg>\')',
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          opacity: 0.5,
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Main Image Display - Takes whole left side */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#454545",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundImage:
                      currentDisplayedImage || generatedImageUrl
                        ? `url(${currentDisplayedImage || generatedImageUrl})`
                        : 'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="600" fill="%23454545"/><text x="200" y="300" text-anchor="middle" dy=".3em" fill="white" font-size="18">Generated Image Will Appear Here</text></svg>\')',
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: "2px solid #4B5563",
                    position: "relative",
                  }}
                >
                  {generatingCampaignId &&
                    !currentDisplayedImage &&
                    !generatedImageUrl && (
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          backgroundColor: "rgba(9, 10, 12, 0.8)",
                          color: "#FFFFFF",
                          padding: "20px 30px",
                          borderRadius: "12px",
                          fontSize: "16px",
                          fontWeight: "500",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            border: "2px solid #FFFFFF",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Generating...
                      </div>
                    )}
                </div>
              </div>

              {/* Right Panel - Control Panel (60% width) */}
              <div
                style={{
                  width: isMobile ? "100%" : "60%",
                  height: "100%",
                  backgroundColor: "#454545",
                  padding: isMobile ? "16px" : "20px",
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                  boxSizing: "border-box",
                  paddingTop: isMobile ? "60px" : "20px",
                }}
              >
                {/* Campaign Name Input */}
                <div style={{ marginBottom: "16px" }}>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, name: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      backgroundColor: "#4B5563",
                      border: "1px solid #6B7280",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#FFFFFF",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    placeholder="Enter campaign name"
                  />
                </div>

                {/* SCENES Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    SCENES ({scenes.length})
                    {selectedScenes.length > 0 && (
                      <span
                        style={{
                          fontSize: "12px",
                          backgroundColor: "#d42f48",
                          color: "#FFFFFF",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {selectedScenes.length} selected
                      </span>
                    )}
                  </h3>
                  {/* Scenes Slider with Navigation Arrows */}
                  <div style={{ position: "relative" }}>
                    {/* Left Arrow */}
                    {scenes.length > 3 && (
                      <button
                        onClick={() => {
                          if (scenesSliderRef.current) {
                            scenesSliderRef.current.scrollBy({ left: -264, behavior: "smooth" });
                          }
                        }}
                        style={{
                          position: "absolute",
                          left: "-12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          zIndex: 10,
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(212, 47, 72, 0.9)",
                          border: "none",
                          color: "#FFFFFF",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "18px",
                          fontWeight: "bold",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#d42f48";
                          e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(212, 47, 72, 0.9)";
                          e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                        }}
                      >
                        ‹
                      </button>
                    )}
                    
                    {/* Scenes Container */}
                    <div
                      ref={scenesSliderRef}
                    style={{
                      display: "flex",
                      gap: "12px",
                      overflowX: "auto",
                      paddingBottom: "8px",
                      scrollbarWidth: "thin",
                      scrollbarColor: "#4B5563 #374151",
                        scrollBehavior: "smooth",
                        paddingLeft: scenes.length > 3 ? "24px" : "0",
                        paddingRight: scenes.length > 3 ? "24px" : "0",
                    }}
                  >
                    {scenes.length === 0 ? (
                      <div
                        style={{
                          color: "#9CA3AF",
                          fontSize: "14px",
                          padding: "20px",
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        No scenes available
                      </div>
                    ) : (
                      scenes.map((scene) => {
                        console.log("🎬 Rendering scene:", scene);
                        return (
                          <div
                            key={scene.id}
                            onClick={() => toggleSelection(scene.id, "scenes")}
                            style={{
                              minWidth: "120px",
                              height: "80px",
                              backgroundColor: "#4B5563",
                              borderRadius: "8px",
                              backgroundImage: `url(${scene.image_url})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              cursor: "pointer",
                              border: selectedScenes.includes(scene.id)
                                ? "2px solid #d42f48"
                                : "1px solid #6B7280",
                              position: "relative",
                              overflow: "hidden",
                              flexShrink: 0,
                                transition: "transform 0.2s ease, border-color 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(1.05)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                bottom: "0",
                                left: "0",
                                right: "0",
                                backgroundColor: "rgba(9, 10, 12, 0.7)",
                                color: "#FFFFFF",
                                padding: "4px 8px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              {scene.name}
                            </div>
                            {selectedScenes.includes(scene.id) && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  width: "20px",
                                  height: "20px",
                                  backgroundColor: "#d42f48",
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "12px",
                                  color: "#FFFFFF",
                                  fontWeight: "bold",
                                }}
                              >
                                ✓
                              </div>
                            )}
                          </div>
                        );
                      })
                      )}
                    </div>
                    
                    {/* Right Arrow */}
                    {scenes.length > 3 && (
                      <button
                        onClick={() => {
                          if (scenesSliderRef.current) {
                            scenesSliderRef.current.scrollBy({ left: 264, behavior: "smooth" });
                          }
                        }}
                        style={{
                          position: "absolute",
                          right: "-12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          zIndex: 10,
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(212, 47, 72, 0.9)",
                          border: "none",
                          color: "#FFFFFF",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "18px",
                          fontWeight: "bold",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#d42f48";
                          e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(212, 47, 72, 0.9)";
                          e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                        }}
                      >
                        ›
                      </button>
                    )}
                  </div>
                </div>

                {/* MODELS Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    MODELS
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedModel ? (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          backgroundColor: "#4B5563",
                          borderRadius: "8px",
                          backgroundImage: `url(${
                            models.find((m) => m.id === selectedModel)
                              ?.image_url
                          })`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          cursor: "pointer",
                          border: "2px solid #d42f48",
                          position: "relative",
                        }}
                        onClick={() => setShowModelSelectionModal(true)}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            backgroundColor: "rgba(9, 10, 12, 0.7)",
                            color: "#FFFFFF",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "500",
                          }}
                        >
                          ✓
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          backgroundColor: "#4B5563",
                          borderRadius: "8px",
                          border: "2px dashed #6B7280",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          textAlign: "center",
                        }}
                        onClick={() => setShowModelSelectionModal(true)}
                      >
                        + Model
                      </div>
                    )}
                  </div>
                </div>

                {/* PRODUCTS Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    PRODUCTS
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedProducts.length > 0 ? (
                      selectedProducts.slice(0, 2).map((productId) => {
                        const product = products.find(
                          (p) => p.id === productId
                        );
                        return (
                          <div
                            key={productId}
                            style={{
                              width: "120px",
                              height: "80px",
                              backgroundColor: "#4B5563",
                              borderRadius: "8px",
                              backgroundImage: `url(${product?.image_url})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              cursor: "pointer",
                              border: "2px solid #d42f48",
                              position: "relative",
                            }}
                            onClick={() => {
                              setProductSelectionMode("campaign");
                              setShowProductSelectionModal(true);
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                backgroundColor: "rgba(9, 10, 12, 0.7)",
                                color: "#FFFFFF",
                                padding: "2px 4px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: "500",
                              }}
                            >
                              ✓
                            </div>
                            <div
                              style={{
                                position: "absolute",
                                bottom: "0",
                                left: "0",
                                right: "0",
                                backgroundColor: "rgba(9, 10, 12, 0.7)",
                                color: "#FFFFFF",
                                padding: "4px 8px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              {product?.name}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          width: "120px",
                          height: "80px",
                          backgroundColor: "#4B5563",
                          borderRadius: "8px",
                          border: "2px dashed #6B7280",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#FFFFFF",
                        }}
                        onClick={() => setShowProductSelectionModal(true)}
                      >
                        <div style={{ fontSize: "24px", marginBottom: "4px" }}>
                          👔
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "500" }}>
                          ADD PRODUCT
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* MANIKIN POSES Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    INITIAL POSE
                  </h3>
                  <div
                    style={{
                      color: "#9CA3AF",
                      fontSize: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    Select a manikin pose for the first image
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      overflowX: "auto",
                      paddingBottom: "8px",
                      scrollbarWidth: "thin",
                      scrollbarColor: "#4B5563 #374151",
                    }}
                  >
                    {[
                      "Pose-neutral.jpg",
                      "Pose-handneck.jpg",
                      "Pose-thinking.jpg",
                    ].map((poseName) => {
                      // Use Cloudinary URL if available, otherwise fallback to static URL
                      const poseUrl =
                        poseImageUrls[poseName] ||
                        `${
                          process.env.NEXT_PUBLIC_API_URL ||
                          "http://localhost:8000"
                        }/static/poses/${poseName}`;
                      const isSelected = selectedManikinPose === poseName;
                      return (
                        <div
                          key={poseName}
                          onClick={() => setSelectedManikinPose(poseName)}
                          style={{
                            minWidth: "100px",
                            height: "120px",
                            backgroundColor: "#4B5563",
                            borderRadius: "8px",
                            backgroundImage: `url(${poseUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            cursor: "pointer",
                            border: isSelected
                              ? "2px solid #d42f48"
                              : "1px solid #6B7280",
                            position: "relative",
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              bottom: "0",
                              left: "0",
                              right: "0",
                              backgroundColor: "rgba(9, 10, 12, 0.7)",
                              color: "#FFFFFF",
                              padding: "4px 8px",
                              fontSize: "11px",
                              fontWeight: "500",
                              textTransform: "capitalize",
                            }}
                          >
                            {poseName
                              .replace("Pose-", "")
                              .replace(".jpg", "")
                              .replace("-", " ")}
                          </div>
                          {isSelected && (
                            <div
                              style={{
                                position: "absolute",
                                top: "6px",
                                right: "6px",
                                width: "20px",
                                height: "20px",
                                backgroundColor: "#d42f48",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                color: "#FFFFFF",
                                fontWeight: "bold",
                              }}
                            >
                              ✓
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* REGENERATE Button */}
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "16px",
                  }}
                >
                  <button
                    onClick={() => {
                      console.log("🔍 REGENERATE button clicked!");
                      console.log("🔍 Button state:", {
                        isCreating,
                        hasName: !!newCampaign.name,
                        hasProducts: selectedProducts.length > 0,
                        hasModel: !!selectedModel,
                        hasScenes: selectedScenes.length > 0,
                        disabled:
                          isCreating ||
                          !newCampaign.name ||
                          selectedProducts.length === 0 ||
                          !selectedModel ||
                          selectedScenes.length === 0,
                      });
                      handleCreateCampaign();
                    }}
                    disabled={
                      isCreating ||
                      isGeneratingInModal ||
                      !newCampaign.name ||
                      selectedProducts.length === 0 ||
                      !selectedModel ||
                      selectedScenes.length === 0
                    }
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      backgroundColor:
                        isCreating || isGeneratingInModal
                          ? "#6B7280"
                          : !newCampaign.name ||
                            selectedProducts.length === 0 ||
                            !selectedModel ||
                            selectedScenes.length === 0
                          ? "#4B5563"
                          : "#EF4444",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor:
                        isCreating ||
                        isGeneratingInModal ||
                        !newCampaign.name ||
                        selectedProducts.length === 0 ||
                        !selectedModel ||
                        selectedScenes.length === 0
                          ? "not-allowed"
                          : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "all 0.2s",
                      opacity:
                        isCreating ||
                        !newCampaign.name ||
                        selectedProducts.length === 0 ||
                        !selectedModel ||
                        selectedScenes.length === 0
                          ? 0.6
                          : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isCreating) {
                        e.currentTarget.style.backgroundColor = "#DC2626";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCreating) {
                        e.currentTarget.style.backgroundColor = "#EF4444";
                      }
                    }}
                  >
                    {isCreating
                      ? "Creating Campaign..."
                      : !newCampaign.name ||
                        selectedProducts.length === 0 ||
                        !selectedModel ||
                        selectedScenes.length === 0
                      ? "Complete Selection"
                      : "REGENERATE"}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      <span>🪙</span>
                      <span>5</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Model Selection Modal */}
        {showModelSelectionModal && (
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
              zIndex: 2000,
            }}
            onClick={() => setShowModelSelectionModal(false)}
          >
            <div
              style={{
                backgroundColor: "#1F2937",
                borderRadius: "16px",
                padding: "24px",
                width: "400px",
                maxHeight: "600px",
                overflowY: "auto",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  color: "#FFFFFF",
                  fontSize: "18px",
                  fontWeight: "600",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                Select Model
              </h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {models.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => {
                      toggleSelection(model.id, "models");
                      setShowModelSelectionModal(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      backgroundColor:
                        selectedModel === model.id ? "#374151" : "#4B5563",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border:
                        selectedModel === model.id
                          ? "2px solid #d42f48"
                          : "1px solid #6B7280",
                      transition: "all 0.2s",
                    }}
                  >
                    <img
                      src={model.image_url}
                      alt={model.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "#FFFFFF",
                          fontSize: "16px",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                      >
                        {model.name}
                      </div>
                      <div
                        style={{
                          color: "#9CA3AF",
                          fontSize: "14px",
                        }}
                      >
                        {model.poses?.length || 0} poses available
                      </div>
                    </div>
                    {selectedModel === model.id && (
                      <div
                        style={{
                          color: "#d42f48",
                          fontSize: "20px",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowModelSelectionModal(false)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#6B7280",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  marginTop: "20px",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Product Selection Modal */}
        {showProductSelectionModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3000,
            }}
            onClick={() => setShowProductSelectionModal(false)}
          >
            <div
              style={{
                backgroundColor: "#1F2937",
                borderRadius: "16px",
                padding: "24px",
                width: "500px",
                maxHeight: "600px",
                overflowY: "auto",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button (X) */}
              <button
                onClick={() => {
                  setShowProductSelectionModal(false);
                  if (productSelectionMode === "image") {
                    setSelectedProductForImage(null);
                    setProductSelectionMode("campaign");
                  }
                }}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#FFFFFF",
                  fontSize: "20px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                ×
              </button>

              <h3
                style={{
                  color: "#FFFFFF",
                  fontSize: "18px",
                  fontWeight: "600",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                {productSelectionMode === "image"
                  ? "Add Product to Image"
                  : "Select Products"}
              </h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (productSelectionMode === "image") {
                        // Just select the product, don't apply yet
                        setSelectedProductForImage(product.id);
                      } else {
                        // Campaign mode - toggle selection
                        toggleSelection(product.id, "products");
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      backgroundColor:
                        productSelectionMode === "image"
                          ? selectedProductForImage === product.id
                            ? "#374151"
                            : "#4B5563"
                          : selectedProducts.includes(product.id)
                        ? "#374151"
                        : "#4B5563",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border:
                        productSelectionMode === "image"
                          ? selectedProductForImage === product.id
                            ? "2px solid #d42f48"
                            : "1px solid #6B7280"
                          : selectedProducts.includes(product.id)
                        ? "2px solid #d42f48"
                        : "1px solid #6B7280",
                      transition: "all 0.2s",
                    }}
                  >
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "#FFFFFF",
                          fontSize: "16px",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                      >
                        {product.name}
                      </div>
                      <div
                        style={{
                          color: "#9CA3AF",
                          fontSize: "14px",
                        }}
                      >
                        {product.packshots.length} packshots
                      </div>
                    </div>
                    {productSelectionMode === "campaign" && (
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => {}}
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#d42f48",
                      }}
                    />
                    )}
                    {productSelectionMode === "image" &&
                      selectedProductForImage === product.id && (
                        <div style={{ color: "#d42f48", fontSize: "20px" }}>
                          ✓
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {productSelectionMode === "image" && selectedProductForImage && (
              <button
                  onClick={() => {
                    if (selectedProductForImage) {
                      addProductToImage(selectedProductForImage);
                    }
                  }}
                  disabled={addingProductToImage}
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor: addingProductToImage
                      ? "#6B7280"
                      : "#F59E0B",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: addingProductToImage ? "not-allowed" : "pointer",
                    marginTop: "20px",
                    opacity: addingProductToImage ? 0.6 : 1,
                  }}
                >
                  {addingProductToImage
                    ? "Adding Product..."
                    : "➕ Add Product to Image"}
                </button>
              )}
              <button
                onClick={() => {
                  setShowProductSelectionModal(false);
                  if (productSelectionMode === "image") {
                    setSelectedProductForImage(null);
                    setProductSelectionMode("campaign");
                  }
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#6B7280",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  marginTop:
                    productSelectionMode === "image" && selectedProductForImage
                      ? "12px"
                      : "20px",
                }}
              >
                {productSelectionMode === "image" ? "Cancel" : "Close"}
              </button>
            </div>
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
                  onClick={() => generateMoreImages(selectedCampaign)}
                  disabled={generatingMore}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: generatingMore ? "#9CA3AF" : "#d42f48",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: generatingMore ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {generatingMore ? "⏳ Generating..." : "✨ Generate More"}
                </button>
              </div>

              {selectedCampaign.description && (
                <p
                  style={{
                    margin: "0 0 32px 0",
                    color: "#6B7280",
                    fontSize: "16px",
                    lineHeight: "1.5",
                  }}
                >
                  {selectedCampaign.description}
                </p>
              )}

              {/* Campaign Status & Workflow */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "24px",
                  padding: "16px",
                  backgroundColor: "#F9FAFB",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "16px" }}
                >
                  {selectedCampaign.settings?.total_combinations && (
                    <span
                      style={{
                        fontSize: "14px",
                        color: "#6B7280",
                      }}
                    >
                      {selectedCampaign.settings.total_combinations} images
                      generated
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>
                    🛍️ Products:{" "}
                    {selectedCampaign.settings?.product_ids?.length || 0}
                  </span>
                  <span>•</span>
                  <span>
                    👤 Models:{" "}
                    {selectedCampaign.settings?.model_ids?.length || 0}
                  </span>
                  <span>•</span>
                  <span>
                    🎬 Scenes:{" "}
                    {selectedCampaign.settings?.scene_ids?.length || 0}
                  </span>
                </div>
              </div>

              {/* Generated Images */}
              {selectedCampaign.settings?.generated_images &&
              selectedCampaign.settings.generated_images.length > 0 ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
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
                      Generated Images (
                      {selectedCampaign.settings.generated_images.length})
                    </h3>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#6B7280",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span>📸</span>
                      <span>Click to view full size</span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: "16px",
                      marginBottom: "24px",
                    }}
                  >
                    {/* Show generated images */}
                    {selectedCampaign.settings.generated_images.map(
                      (img: any, index: number) => (
                        <div
                          key={`generated-${index}`}
                          style={{
                            border: "1px solid #E5E7EB",
                            borderRadius: "12px",
                            overflow: "hidden",
                            backgroundColor: "#F9FAFB",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            position: "relative",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                            e.currentTarget.style.boxShadow =
                              "0 8px 25px rgba(0,0,0,0.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                          onClick={() => {
                            if (img.video_url) {
                              window.open(img.video_url, "_blank");
                            } else {
                              window.open(img.image_url, "_blank");
                            }
                          }}
                        >
                          <div style={{ position: "relative" }}>
                            {img.video_url ? (
                              <video
                                src={img.video_url}
                                style={{
                                  width: "100%",
                                  height: "200px",
                                  objectFit: "cover",
                                }}
                                controls
                                loop
                                muted
                                autoPlay
                                preload="metadata"
                                onError={(e) => {
                                  // Fallback to image if video fails
                                  const videoElement = e.currentTarget;
                                  const imgElement =
                                    videoElement.nextElementSibling as HTMLImageElement;
                                  if (imgElement) {
                                    videoElement.style.display = "none";
                                    imgElement.style.display = "block";
                                  }
                                }}
                              />
                            ) : null}
                            <img
                              src={img.image_url}
                              alt={`${img.product_name} + ${img.model_name} + ${img.scene_name}`}
                              style={{
                                width: "100%",
                                height: "200px",
                                objectFit: "cover",
                                display: img.video_url ? "none" : "block",
                              }}
                              onError={(e) => {
                                e.currentTarget.src =
                                  "https://via.placeholder.com/300x200?text=Image+Error";
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                backgroundColor: "rgba(0,0,0,0.7)",
                                color: "white",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              #{index + 1}
                            </div>
                            {img.video_url && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "8px",
                                  left: "8px",
                                  backgroundColor: "rgba(139, 92, 246, 0.9)",
                                  color: "white",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                🎬 Video
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "12px" }}>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#1F2937",
                                marginBottom: "4px",
                              }}
                            >
                              {img.product_name} + {img.model_name}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#6B7280",
                                marginBottom: "8px",
                              }}
                            >
                              Scene: {img.scene_name}
                            </div>

                            {/* Generate Video Button */}
                            {!img.video_url && (
                              <div style={{ marginBottom: "8px" }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const generationId = img.generation_id;
                                    if (generationId) {
                                      setPromptModalData({
                                        generationId,
                                        imageIndex: index,
                                      });
                                      setCustomPrompt("");
                                      setVideoQuality("480p"); // Reset to default
                                      setVideoModel("wan"); // Reset to default
                                      setVideoDuration("5s"); // Reset to default
                                      setShowPromptModal(true);
                                    } else {
                                      alert(
                                        "Generation ID not found. Please refresh the page."
                                      );
                                    }
                                  }}
                                  disabled={
                                    generatingVideo === img.generation_id
                                  }
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor:
                                      generatingVideo === img.generation_id
                                        ? "#9CA3AF"
                                        : "#d42f48",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    cursor:
                                      generatingVideo === img.generation_id
                                        ? "not-allowed"
                                        : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    width: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  {generatingVideo === img.generation_id ? (
                                    <>
                                      <div
                                        style={{
                                          width: "12px",
                                          height: "12px",
                                          border: "2px solid #ffffff",
                                          borderTop: "2px solid transparent",
                                          borderRadius: "50%",
                                          animation: "spin 1s linear infinite",
                                        }}
                                      />
                                      Generating...
                                    </>
                                  ) : (
                                    <>🎬 Generate Video</>
                                  )}
                                </button>
                              </div>
                            )}

                            <div
                              style={{
                                fontSize: "11px",
                                color: "#9CA3AF",
                                fontStyle: "italic",
                              }}
                            >
                              Click to view full size
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {/* Show placeholder loading cards for images being generated */}
                    {selectedCampaign.generation_status === "generating" &&
                      generatingFullCampaign === selectedCampaign.id &&
                      // Show 5 total slots minus already generated
                      Array.from({
                        length: Math.max(
                          0,
                          5 -
                            (selectedCampaign.settings.generated_images
                              ?.length || 0)
                        ),
                      }).map((_, idx) => (
                        <div
                          key={`placeholder-${idx}`}
                          style={{
                            border: "2px dashed #D1D5DB",
                            borderRadius: "12px",
                            overflow: "hidden",
                            backgroundColor: "#F9FAFB",
                            position: "relative",
                            aspectRatio: "1",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "20px",
                          }}
                        >
                          {/* Beating heart spinner */}
                          <img
                            src="/beating.gif"
                            alt="Loading"
                            style={{
                              width: "80px",
                              height: "80px",
                              marginBottom: "16px",
                            }}
                          />
                          <p
                            style={{
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#6B7280",
                              margin: 0,
                              textAlign: "center",
                            }}
                          >
                            Generating Image{" "}
                            {(selectedCampaign.settings.generated_images
                              ?.length || 0) +
                              idx +
                              1}
                            ...
                          </p>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "#9CA3AF",
                              margin: "8px 0 0 0",
                              textAlign: "center",
                            }}
                          >
                            Please wait
                          </p>
                  </div>
                      ))}
                </div>

                  {/* New Workflow Buttons */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginTop: "24px",
                    }}
                  >
                    {/* Debug Info - Remove after testing */}
                    <div
                      style={{
                        padding: "12px",
                        backgroundColor: "#FEF3C7",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    >
                      <div>🔍 DEBUG INFO:</div>
                      <div>Status: {selectedCampaign.status}</div>
                      <div>
                        Generation Status: {selectedCampaign.generation_status}
                      </div>
                      <div>
                        Images:{" "}
                        {selectedCampaign.settings?.generated_images?.length ||
                          0}
                      </div>
                      <div>
                        Preview Generated:{" "}
                        {String(selectedCampaign.settings?.preview_generated)}
                      </div>
                      <div>
                        Show Button:{" "}
                        {String(
                          selectedCampaign.status === "preview" &&
                            selectedCampaign.generation_status === "completed"
                        )}
                      </div>
                    </div>

                    {/* Generate Full Campaign Button - Show for preview status */}
                    {selectedCampaign.status === "preview" &&
                      selectedCampaign.generation_status === "completed" && (
                        <button
                          onClick={() =>
                            handleGenerateFullCampaign(selectedCampaign.id)
                          }
                          disabled={
                            generatingFullCampaign === selectedCampaign.id
                          }
                          style={{
                            padding: "16px 24px",
                            backgroundColor:
                              generatingFullCampaign === selectedCampaign.id
                                ? "#9CA3AF"
                                : "#10B981",
                            border: "none",
                            borderRadius: "12px",
                            color: "#FFFFFF",
                            fontSize: "16px",
                            fontWeight: "600",
                            cursor:
                              generatingFullCampaign === selectedCampaign.id
                                ? "not-allowed"
                                : "pointer",
                            transition: "all 0.2s ease",
                            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                          }}
                          onMouseEnter={(e) => {
                            if (
                              generatingFullCampaign !== selectedCampaign.id
                            ) {
                              e.currentTarget.style.backgroundColor = "#059669";
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 6px 16px rgba(16, 185, 129, 0.4)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (
                              generatingFullCampaign !== selectedCampaign.id
                            ) {
                              e.currentTarget.style.backgroundColor = "#10B981";
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(16, 185, 129, 0.3)";
                            }
                          }}
                        >
                          {generatingFullCampaign === selectedCampaign.id ? (
                            <>
                              <div
                                style={{
                                  display: "inline-block",
                                  width: "16px",
                                  height: "16px",
                                  border: "2px solid #FFFFFF",
                                  borderTop: "2px solid transparent",
                                  borderRadius: "50%",
                                  animation: "spin 1s linear infinite",
                                  marginRight: "8px",
                                }}
                              />
                              Generating All Poses...
                            </>
                          ) : (
                            "✨ Generate Full Campaign (All Poses)"
                          )}
                        </button>
                      )}

                    {/* Generate Videos Button - Show for completed campaigns */}
                    {selectedCampaign.status === "completed" &&
                      !selectedCampaign.settings?.videos && (
                        <button
                          onClick={() =>
                            handleGenerateCampaignVideos(selectedCampaign.id)
                          }
                          disabled={
                            generatingCampaignVideos === selectedCampaign.id
                          }
                          style={{
                            padding: "16px 24px",
                            backgroundColor:
                              generatingCampaignVideos === selectedCampaign.id
                                ? "#9CA3AF"
                                : "#8B5CF6",
                            border: "none",
                            borderRadius: "12px",
                            color: "#FFFFFF",
                            fontSize: "16px",
                            fontWeight: "600",
                            cursor:
                              generatingCampaignVideos === selectedCampaign.id
                                ? "not-allowed"
                                : "pointer",
                            transition: "all 0.2s ease",
                            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                          }}
                          onMouseEnter={(e) => {
                            if (
                              generatingCampaignVideos !== selectedCampaign.id
                            ) {
                              e.currentTarget.style.backgroundColor = "#7C3AED";
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 6px 16px rgba(139, 92, 246, 0.4)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (
                              generatingCampaignVideos !== selectedCampaign.id
                            ) {
                              e.currentTarget.style.backgroundColor = "#8B5CF6";
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(139, 92, 246, 0.3)";
                            }
                          }}
                        >
                          {generatingCampaignVideos === selectedCampaign.id ? (
                            <>
                              <div
                                style={{
                                  display: "inline-block",
                                  width: "16px",
                                  height: "16px",
                                  border: "2px solid #FFFFFF",
                                  borderTop: "2px solid transparent",
                                  borderRadius: "50%",
                                  animation: "spin 1s linear infinite",
                                  marginRight: "8px",
                                }}
                              />
                              Generating Videos...
                            </>
                          ) : (
                            "🎬 Generate Campaign Videos"
                          )}
                        </button>
                      )}

                    {/* Show Videos if they exist */}
                    {(() => {
                      console.log(
                        "📹 Modal rendering - Checking for videos in selectedCampaign:"
                      );
                      console.log(
                        "📹 selectedCampaign.settings:",
                        selectedCampaign.settings
                      );
                      console.log(
                        "📹 videos array:",
                        selectedCampaign.settings?.videos
                      );
                      console.log(
                        "📹 videos length:",
                        selectedCampaign.settings?.videos?.length
                      );
                      return null;
                    })()}
                    {selectedCampaign.settings?.videos &&
                      selectedCampaign.settings.videos.length > 0 && (
                        <div style={{ marginTop: "24px" }}>
                          <h3
                            style={{
                              fontSize: "18px",
                              fontWeight: "600",
                              color: "#1F2937",
                              marginBottom: "16px",
                            }}
                          >
                            🎬 Campaign Videos (
                            {selectedCampaign.settings.videos.length})
                          </h3>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fill, minmax(300px, 1fr))",
                              gap: "16px",
                            }}
                          >
                            {selectedCampaign.settings.videos.map(
                              (video: any, idx: number) => (
                                <div
                                  key={idx}
                                  style={{
                                    border: "1px solid #E5E7EB",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    backgroundColor: "#F9FAFB",
                                  }}
                                >
                                  {video.video_url ? (
                                    <video
                                      autoPlay
                                      loop
                                      muted
                                      playsInline
                                      controls
                                      style={{ width: "100%", height: "auto" }}
                                      preload="metadata"
                                    >
                                      <source
                                        src={video.video_url}
                                        type="video/mp4"
                                      />
                                      Your browser does not support the video
                                      tag.
                                    </video>
                                  ) : (
                                    <div
                                      style={{
                                        padding: "40px",
                                        textAlign: "center",
                                        color: "#6B7280",
                                      }}
                                    >
                                      {video.error
                                        ? `❌ ${video.error}`
                                        : "⏳ Processing..."}
                                    </div>
                                  )}
                                  <div style={{ padding: "12px" }}>
                                    <p
                                      style={{
                                        fontSize: "14px",
                                        color: "#6B7280",
                                        margin: 0,
                                      }}
                                    >
                                      {video.shot_type || `Video ${idx + 1}`}
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 40px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "12px",
                    marginBottom: "24px",
                    border: "2px dashed #D1D5DB",
                  }}
                >
                  <div style={{ fontSize: "64px", marginBottom: "20px" }}>
                    📁
                  </div>
                  <h3
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "#1F2937",
                      marginBottom: "12px",
                    }}
                  >
                    Empty Campaign Folder
                  </h3>
                  <p
                    style={{
                      color: "#6B7280",
                      marginBottom: "24px",
                      fontSize: "16px",
                    }}
                  >
                    This campaign folder is empty. Generate some images to get
                    started!
                  </p>
                  <button
                    onClick={() => generateMoreImages(selectedCampaign)}
                    disabled={generatingMore}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: generatingMore ? "#9CA3AF" : "#d42f48",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: generatingMore ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      margin: "0 auto",
                    }}
                  >
                    {generatingMore ? (
                      <>
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            border: "2px solid #FFFFFF",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Generating...
                      </>
                    ) : (
                      "✨ Generate First Images"
                    )}
                  </button>
                </div>
              )}

              {/* Close Button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "24px",
                }}
              >
                <button
                  onClick={() => setShowCampaignModal(false)}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#F3F4F6",
                    border: "none",
                    borderRadius: "8px",
                    color: "#374151",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Campaign Modal */}
        {showEditModal && editingCampaign && (
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
            onClick={() => setShowEditModal(false)}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                padding: "32px",
                width: "90%",
                maxWidth: "500px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                color: "#1F2937",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  margin: "0 0 24px 0",
                  fontSize: "24px",
                  fontWeight: "600",
                  color: "#1F2937",
                }}
              >
                Edit Campaign
              </h2>

              <div style={{ marginBottom: "20px" }}>
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
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    color: "#1F2937",
                    fontSize: "14px",
                  }}
                  placeholder="Enter campaign name"
                />
              </div>

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
                  Description (Optional)
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    color: "#1F2937",
                    fontSize: "14px",
                    minHeight: "80px",
                    resize: "vertical",
                  }}
                  placeholder="Enter campaign description"
                />
              </div>

              {/* Number of Images Selection */}
              <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Number of Images to Generate
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <label
                      key={num}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 16px",
                        backgroundColor:
                          numberOfImagesToGenerate === num
                            ? "#d42f48"
                            : "#F3F4F6",
                        color:
                          numberOfImagesToGenerate === num
                            ? "#FFFFFF"
                            : "#374151",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#E5E7EB";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#F3F4F6";
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="numberOfImagesCreate"
                        value={num}
                        checked={numberOfImagesToGenerate === num}
                        onChange={() => setNumberOfImagesToGenerate(num)}
                        style={{ marginRight: "8px" }}
                      />
                      {num} {num === 1 ? "Image" : "Images"}
                    </label>
                  ))}
                </div>
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "12px",
                    color: "#6B7280",
                  }}
                >
                  Generate a professional photoshoot image with the selected
                  model, product, and scene
                </p>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#F3F4F6",
                    border: "none",
                    borderRadius: "8px",
                    color: "#374151",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateCampaign}
                  disabled={isUpdating || !editForm.name.trim()}
                  style={{
                    padding: "12px 24px",
                    backgroundColor:
                      isUpdating || !editForm.name.trim()
                        ? "#9CA3AF"
                        : "#d42f48",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor:
                      isUpdating || !editForm.name.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isUpdating ? "Updating..." : "Update Campaign"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Generation Prompt Modal */}
        {showPromptModal && promptModalData && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowPromptModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                width: "90%",
                maxWidth: "500px",
                maxHeight: "80vh",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Generate Video
              </h3>
              <p
                style={{
                  margin: "0 0 16px 0",
                  color: "#6B7280",
                  fontSize: "14px",
                }}
              >
                Enter a custom prompt for video generation (optional). Leave
                empty to use the default prompt.
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="A realistic model wearing the product, integrated naturally into the scene..."
                style={{
                  width: "100%",
                  height: "120px",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />

              {/* Video Model Selection */}
              <div style={{ marginTop: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Video Model
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoModel === "wan"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoModel === "wan" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoModel"
                      value="wan"
                      checked={videoModel === "wan"}
                      onChange={(e) => setVideoModel(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        Wan 2.2 I2V Fast
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        Fast generation, 480p/720p
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoModel === "seedance"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoModel === "seedance" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoModel"
                      value="seedance"
                      checked={videoModel === "seedance"}
                      onChange={(e) => setVideoModel(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        Seedance 1 Pro
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        High quality, 480p/720p/1080p
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoModel === "kling"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoModel === "kling" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoModel"
                      value="kling"
                      checked={videoModel === "kling"}
                      onChange={(e) => setVideoModel(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        Kling 2.5 Turbo Pro
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        Pro-level quality with smooth motion
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Video Quality Selection */}
              <div style={{ marginTop: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Video Quality
                </label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoQuality === "480p"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoQuality === "480p" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoQuality"
                      value="480p"
                      checked={videoQuality === "480p"}
                      onChange={(e) => setVideoQuality(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        480p
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        {videoModel === "seedance" ? "1 credit" : "1 credit"} -
                        Standard quality
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoQuality === "720p"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoQuality === "720p" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoQuality"
                      value="720p"
                      checked={videoQuality === "720p"}
                      onChange={(e) => setVideoQuality(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        720p
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        {videoModel === "seedance" ? "2 credits" : "2 credits"}{" "}
                        - High quality
                      </div>
                    </div>
                  </label>
                  {videoModel === "seedance" && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        border:
                          videoQuality === "1080p"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          videoQuality === "1080p" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="videoQuality"
                        value="1080p"
                        checked={videoQuality === "1080p"}
                        onChange={(e) => setVideoQuality(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          1080p
                        </div>
                        <div style={{ fontSize: "12px", color: "#6B7280" }}>
                          3 credits - Ultra high quality
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Video Duration Selection (for Seedance and Kling) */}
              {(videoModel === "seedance" || videoModel === "kling") && (
                <div style={{ marginTop: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Video Duration
                  </label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        border:
                          videoDuration === "5s"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          videoDuration === "5s" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="videoDuration"
                        value="5s"
                        checked={videoDuration === "5s"}
                        onChange={(e) => setVideoDuration(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          5 seconds
                        </div>
                        <div style={{ fontSize: "12px", color: "#6B7280" }}>
                          Standard duration
                        </div>
                      </div>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        border:
                          videoDuration === "10s"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          videoDuration === "10s" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="videoDuration"
                        value="10s"
                        checked={videoDuration === "10s"}
                        onChange={(e) => setVideoDuration(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          10 seconds
                        </div>
                        <div style={{ fontSize: "12px", color: "#6B7280" }}>
                          Extended duration
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button
                  onClick={() => setShowPromptModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
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
                  onClick={() => {
                    generateVideo(
                      promptModalData.generationId,
                      promptModalData.imageIndex,
                      customPrompt,
                      videoQuality,
                      videoModel,
                      videoDuration
                    );
                    setShowPromptModal(false);
                  }}
                  disabled={generatingVideo === promptModalData.generationId}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    backgroundColor:
                      generatingVideo === promptModalData.generationId
                        ? "#9CA3AF"
                        : "#d42f48",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor:
                      generatingVideo === promptModalData.generationId
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {generatingVideo === promptModalData.generationId
                    ? "Generating..."
                    : (() => {
                        let credits = 1;
                        if (videoModel === "seedance") {
                          if (videoQuality === "1080p") credits = 3;
                          else if (videoQuality === "720p") credits = 2;
                          else credits = 1;
                        } else if (videoModel === "kling") {
                          if (videoQuality === "1080p") credits = 4;
                          else if (videoQuality === "720p") credits = 3;
                          else credits = 2;
                        } else {
                          // wan model
                          if (videoQuality === "720p") credits = 2;
                          else credits = 1;
                        }
                        return `Generate Video (${credits} credit${
                          credits > 1 ? "s" : ""
                        })`;
                      })()}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Parameter Selection Modal */}
        {showParameterModal && selectedCampaignForGeneration && (
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
            onClick={() => setShowParameterModal(false)}
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
              <h2
                style={{
                  margin: "0 0 24px 0",
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1F2937",
                }}
              >
                Generate More Images
              </h2>
              <p
                style={{
                  margin: "0 0 32px 0",
                  color: "#6B7280",
                  fontSize: "16px",
                  lineHeight: "1.5",
                }}
              >
                Select products, models, scenes, and poses to generate new
                images for <strong>{selectedCampaignForGeneration.name}</strong>
                .
              </p>

              {/* Products Selection */}
              <div style={{ marginBottom: "32px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "16px",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Products
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    overflowX: "auto",
                    paddingBottom: "8px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {products.map((product) => (
                    <label
                      key={product.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        border: selectedProductsForGeneration.includes(
                          product.id
                        )
                          ? "2px solid #d42f48"
                          : "1px solid #E5E7EB",
                        borderRadius: "12px",
                        cursor: "pointer",
                        backgroundColor: selectedProductsForGeneration.includes(
                          product.id
                        )
                          ? "#F3F4F6"
                          : "white",
                        transition: "all 0.2s ease",
                        boxShadow: selectedProductsForGeneration.includes(
                          product.id
                        )
                          ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                          : "0 1px 2px rgba(9, 10, 12, 0.05)",
                        minWidth: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductsForGeneration.includes(
                          product.id
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductsForGeneration([
                              ...selectedProductsForGeneration,
                              product.id,
                            ]);
                          } else {
                            setSelectedProductsForGeneration(
                              selectedProductsForGeneration.filter(
                                (id) => id !== product.id
                              )
                            );
                          }
                        }}
                        style={{
                          margin: 0,
                          width: "16px",
                          height: "16px",
                          accentColor: "#d42f48",
                        }}
                      />
                      <img
                        src={product.image_url}
                        alt={product.name}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color: selectedProductsForGeneration.includes(
                            product.id
                          )
                            ? "#1F2937"
                            : "#6B7280",
                          textAlign: "center",
                          wordBreak: "break-word",
                        }}
                      >
                        {product.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Models Selection */}
              <div style={{ marginBottom: "32px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "16px",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Models
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    overflowX: "auto",
                    paddingBottom: "8px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {models.map((model) => (
                    <label
                      key={model.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        border:
                          selectedModelForGeneration === model.id
                            ? "2px solid #d42f48"
                            : "1px solid #E5E7EB",
                        borderRadius: "12px",
                        cursor: "pointer",
                        backgroundColor:
                          selectedModelForGeneration === model.id
                            ? "#F3F4F6"
                            : "white",
                        transition: "all 0.2s ease",
                        boxShadow:
                          selectedModelForGeneration === model.id
                            ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                            : "0 1px 2px rgba(9, 10, 12, 0.05)",
                        minWidth: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      <input
                        type="radio"
                        name="selectedModelForGeneration"
                        checked={selectedModelForGeneration === model.id}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Clear poses for previous model
                            setSelectedPosesForGeneration((prevPoses) => ({
                              ...prevPoses,
                              [selectedModelForGeneration]: [],
                            }));
                            setSelectedModelForGeneration(model.id);
                          }
                        }}
                        style={{
                          margin: 0,
                          width: "16px",
                          height: "16px",
                          accentColor: "#d42f48",
                        }}
                      />
                      <img
                        src={model.image_url}
                        alt={model.name}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color:
                            selectedModelForGeneration === model.id
                              ? "#1F2937"
                              : "#6B7280",
                          textAlign: "center",
                          wordBreak: "break-word",
                        }}
                      >
                        {model.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scenes Selection */}
              <div style={{ marginBottom: "32px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "16px",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Scenes
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    overflowX: "auto",
                    paddingBottom: "8px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {scenes.map((scene) => (
                    <label
                      key={scene.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        border: selectedScenesForGeneration.includes(scene.id)
                          ? "2px solid #d42f48"
                          : "1px solid #E5E7EB",
                        borderRadius: "12px",
                        cursor: "pointer",
                        backgroundColor: selectedScenesForGeneration.includes(
                          scene.id
                        )
                          ? "#F3F4F6"
                          : "white",
                        transition: "all 0.2s ease",
                        boxShadow: selectedScenesForGeneration.includes(
                          scene.id
                        )
                          ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                          : "0 1px 2px rgba(9, 10, 12, 0.05)",
                        minWidth: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScenesForGeneration.includes(scene.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScenesForGeneration([
                              ...selectedScenesForGeneration,
                              scene.id,
                            ]);
                          } else {
                            setSelectedScenesForGeneration(
                              selectedScenesForGeneration.filter(
                                (id) => id !== scene.id
                              )
                            );
                          }
                        }}
                        style={{
                          margin: 0,
                          width: "16px",
                          height: "16px",
                          accentColor: "#d42f48",
                        }}
                      />
                      <img
                        src={scene.image_url}
                        alt={scene.name}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color: selectedScenesForGeneration.includes(scene.id)
                            ? "#1F2937"
                            : "#6B7280",
                          textAlign: "center",
                          wordBreak: "break-word",
                        }}
                      >
                        {scene.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Poses Selection for each selected model */}
              {selectedModelForGeneration && (
                <div style={{ marginBottom: "32px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "16px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1F2937",
                    }}
                  >
                    Model Poses (Optional)
                  </label>
                  {[selectedModelForGeneration].map((modelId) => {
                    const model = models.find((m) => m.id === modelId);
                    if (!model || !model.poses || model.poses.length === 0)
                      return null;

                    return (
                      <div key={modelId} style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            marginBottom: "8px",
                            fontWeight: "500",
                          }}
                        >
                          {model.name} poses:
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            overflowX: "auto",
                            paddingBottom: "8px",
                            scrollbarWidth: "thin",
                          }}
                        >
                          {(model.poses || []).map((poseUrl, index) => (
                            <label
                              key={index}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px",
                                border: selectedPosesForGeneration[
                                  modelId
                                ]?.includes(poseUrl)
                                  ? "2px solid #d42f48"
                                  : "1px solid #E5E7EB",
                                borderRadius: "8px",
                                cursor: "pointer",
                                backgroundColor: selectedPosesForGeneration[
                                  modelId
                                ]?.includes(poseUrl)
                                  ? "#F3F4F6"
                                  : "white",
                                transition: "all 0.2s ease",
                                boxShadow: selectedPosesForGeneration[
                                  modelId
                                ]?.includes(poseUrl)
                                  ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                                  : "0 1px 2px rgba(9, 10, 12, 0.05)",
                                minWidth: "80px",
                                maxWidth: "80px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  selectedPosesForGeneration[modelId]?.includes(
                                    poseUrl
                                  ) || false
                                }
                                onChange={(e) => {
                                  const currentPoses =
                                    selectedPosesForGeneration[modelId] || [];
                                  if (e.target.checked) {
                                    // Add pose and automatically select the model
                                    setSelectedPosesForGeneration({
                                      ...selectedPosesForGeneration,
                                      [modelId]: [...currentPoses, poseUrl],
                                    });

                                    setSelectedModelForGeneration(modelId);
                                  } else {
                                    // Remove pose
                                    const newPoses = {
                                      ...selectedPosesForGeneration,
                                      [modelId]: currentPoses.filter(
                                        (url) => url !== poseUrl
                                      ),
                                    };

                                    setSelectedPosesForGeneration(newPoses);

                                    // If no poses left for this model, remove the model from selected models
                                    if (newPoses[modelId].length === 0) {
                                      setSelectedModelForGeneration("");
                                    }
                                  }
                                }}
                                style={{
                                  margin: 0,
                                  width: "12px",
                                  height: "12px",
                                  accentColor: "#d42f48",
                                }}
                              />
                              <img
                                src={poseUrl}
                                alt={`Pose ${index + 1}`}
                                style={{
                                  width: "60px",
                                  height: "60px",
                                  objectFit: "cover",
                                  borderRadius: "6px",
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "500",
                                  color: selectedPosesForGeneration[
                                    modelId
                                  ]?.includes(poseUrl)
                                    ? "#1F2937"
                                    : "#6B7280",
                                  textAlign: "center",
                                }}
                              >
                                Pose {index + 1}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Number of Images Selection */}
              <div style={{ marginTop: "32px" }}>
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Number of Images to Generate
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <label
                      key={num}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 16px",
                        backgroundColor:
                          numberOfImagesToGenerate === num
                            ? "#d42f48"
                            : "#F3F4F6",
                        color:
                          numberOfImagesToGenerate === num
                            ? "#FFFFFF"
                            : "#374151",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#E5E7EB";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#F3F4F6";
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="numberOfImages"
                        value={num}
                        checked={numberOfImagesToGenerate === num}
                        onChange={() => setNumberOfImagesToGenerate(num)}
                        style={{ marginRight: "8px" }}
                      />
                      {num} {num === 1 ? "Image" : "Images"}
                    </label>
                  ))}
                </div>
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "12px",
                    color: "#6B7280",
                  }}
                >
                  Generate a professional photoshoot image with the selected
                  model, product, and scene
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "16px", marginTop: "32px" }}>
                <button
                  onClick={() => setShowParameterModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    backgroundColor: "#F3F4F6",
                    color: "#374151",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeImageGeneration}
                  disabled={
                    generatingMore ||
                    selectedProductsForGeneration.length === 0 ||
                    !selectedModelForGeneration ||
                    selectedScenesForGeneration.length === 0
                  }
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    backgroundColor:
                      generatingMore ||
                      selectedProductsForGeneration.length === 0 ||
                      !selectedModelForGeneration ||
                      selectedScenesForGeneration.length === 0
                        ? "#9CA3AF"
                        : "#d42f48",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor:
                      generatingMore ||
                      selectedProductsForGeneration.length === 0 ||
                      !selectedModelForGeneration ||
                      selectedScenesForGeneration.length === 0
                        ? "not-allowed"
                        : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {generatingMore
                    ? "Generating..."
                    : `Generate Images (${
                        selectedProductsForGeneration.length
                      } × ${selectedModelForGeneration ? 1 : 0} × ${
                        selectedScenesForGeneration.length
                      } = ${
                        selectedProductsForGeneration.length *
                        (selectedModelForGeneration ? 1 : 0) *
                        selectedScenesForGeneration.length
                      } combinations)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Keyframe Generation Modal */}
        {showKeyframeModal && selectedCampaignForGeneration && (
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
            onClick={() => setShowKeyframeModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                padding: "32px",
                maxWidth: "500px",
                width: "90%",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowKeyframeModal(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#6B7280",
                }}
              >
                ✕
              </button>

              <h2
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "22px",
                  fontWeight: "600",
                  color: "#1F2937",
                }}
              >
                🎬 Generate Keyframe Variations
              </h2>
              
              <p
                style={{
                  margin: "0 0 24px 0",
                  color: "#6B7280",
                  fontSize: "15px",
                  lineHeight: "1.6",
                }}
              >
                Generate cinematic keyframes from your base image for <strong>{selectedCampaignForGeneration.name}</strong>.
                <br /><br />
                <span style={{ color: "#059669", fontWeight: "500" }}>
                  ✓ Same person, same clothes, same location
                </span>
                <br />
                <span style={{ color: "#059669", fontWeight: "500" }}>
                  ✓ Candid shots - not always looking at camera
                </span>
                <br />
                <span style={{ color: "#059669", fontWeight: "500" }}>
                  ✓ Interacting with scene - sitting, leaning, exploring
                </span>
              </p>

              {/* Keyframe Types Preview */}
              <div
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "12px" }}>
                  Available Keyframes:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {[
                    { icon: "👀", name: "Looking Away" },
                    { icon: "👕", name: "Shirt Close-up" },
                    { icon: "🪑", name: "Sitting in Scene" },
                    { icon: "👖", name: "Pants Close-up" },
                    { icon: "🧱", name: "Leaning Casual" },
                    { icon: "✨", name: "Outfit Detail" },
                    { icon: "💭", name: "Lost in Thought" },
                    { icon: "🚶", name: "Exploring Space" },
                    { icon: "⬆️", name: "Low Angle" },
                    { icon: "⬇️", name: "High Angle" },
                    { icon: "👤", name: "Side Profile" },
                  ].map((kf, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: idx < keyframeCount ? "#DCFCE7" : "#E5E7EB",
                        color: idx < keyframeCount ? "#166534" : "#6B7280",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "500",
                      }}
                    >
                      {kf.icon} {kf.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Number of Keyframes Selector */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  Number of Keyframes
                </label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[2, 4, 6, 8, 10, 11].map((num) => (
                    <button
                      key={num}
                      onClick={() => setKeyframeCount(num)}
                      style={{
                        flex: 1,
                        padding: "12px",
                        border: keyframeCount === num ? "2px solid #d42f48" : "1px solid #E5E7EB",
                        borderRadius: "8px",
                        backgroundColor: keyframeCount === num ? "#FEF2F2" : "white",
                        color: keyframeCount === num ? "#d42f48" : "#374151",
                        fontWeight: keyframeCount === num ? "600" : "500",
                        fontSize: "16px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Estimate */}
              <div
                style={{
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "18px" }}>⏱️</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#92400E" }}>
                    Estimated time: ~{Math.ceil((keyframeCount * 33.5) / 60)} min {Math.round((keyframeCount * 33.5) % 60)} sec
                  </div>
                  <div style={{ fontSize: "12px", color: "#A16207" }}>
                    {keyframeCount} keyframes × ~33 seconds each
                  </div>
                </div>
              </div>

              {/* Generate Button / Progress */}
              {generatingKeyframes ? (
                <div
                  style={{
                    backgroundColor: "#F3F4F6",
                    borderRadius: "10px",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  {/* Progress Bar */}
                  <div
                    style={{
                      backgroundColor: "#E5E7EB",
                      borderRadius: "999px",
                      height: "12px",
                      overflow: "hidden",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#d42f48",
                        height: "100%",
                        width: `${(keyframeProgress.current / keyframeProgress.total) * 100}%`,
                        transition: "width 0.5s ease",
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                  
                  {/* Progress Text */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
                    <img src="/beating.gif" alt="Loading" style={{ width: "24px", height: "24px" }} />
                    <span style={{ fontSize: "16px", fontWeight: "600", color: "#374151" }}>
                      {keyframeProgress.current} / {keyframeProgress.total} keyframes
                    </span>
                  </div>
                  
                  {/* Current Keyframe Name */}
                  <div style={{ fontSize: "14px", color: "#6B7280", marginBottom: "8px" }}>
                    {keyframeProgress.currentName}
                  </div>
                  
                  {/* Time Estimate */}
                  <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
                    ~{Math.ceil(((keyframeProgress.total - keyframeProgress.current) * 33.5) / 60)} min remaining
                  </div>
                </div>
              ) : (
                <button
                  onClick={executeKeyframeGeneration}
                  style={{
                    width: "100%",
                    padding: "14px",
                    backgroundColor: "#d42f48",
                    border: "none",
                    borderRadius: "10px",
                    color: "white",
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  🎬 Generate {keyframeCount} Keyframes
                </button>
              )}
            </div>
          </div>
        )}

        {/* Campaign Profile Modal */}
        {showCampaignProfileModal && selectedCampaignForProfile && (
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
            onClick={() => setShowCampaignProfileModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                padding: "32px",
                maxWidth: "95vw",
                maxHeight: "95vh",
                width: "1200px",
                position: "relative",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "32px",
                  paddingBottom: "24px",
                  borderBottom: "2px solid #E5E7EB",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "28px",
                    fontWeight: "700",
                    color: "#1F2937",
                  }}
                >
                  {selectedCampaignForProfile.name}
                </h2>
                <button
                  onClick={() => setShowCampaignProfileModal(false)}
                  style={{
                    padding: "12px",
                    backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    color: "#6B7280",
                    fontSize: "24px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#F3F4F6";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6B7280";
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  marginBottom: "24px",
                }}
              >
                {/* Campaign Images Gallery - Enhanced Visualization */}
                {selectedCampaignForProfile.settings?.generated_images &&
                selectedCampaignForProfile.settings.generated_images.length >
                  0 ? (
                  <div>
                    {/* Header with count and stats */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      marginBottom: "20px",
                      paddingBottom: "16px",
                      borderBottom: "1px solid #E5E7EB"
                    }}>
                      <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#1F2937", margin: 0 }}>
                        🎬 Campaign Keyframes
                    </h3>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <span style={{ 
                          backgroundColor: "#DCFCE7", 
                          color: "#166534", 
                          padding: "6px 12px", 
                          borderRadius: "20px", 
                          fontSize: "13px", 
                          fontWeight: "600" 
                        }}>
                          {selectedCampaignForProfile.settings.generated_images.length} images
                        </span>
                        <span style={{ 
                          backgroundColor: "#FEF3C7", 
                          color: "#92400E", 
                          padding: "6px 12px", 
                          borderRadius: "20px", 
                          fontSize: "13px", 
                          fontWeight: "600" 
                        }}>
                          {(selectedCampaignForProfile.settings?.videos?.length || 0) + 
                           selectedCampaignForProfile.settings.generated_images.filter((i: any) => i.video_url).length} videos
                        </span>
                      </div>
                    </div>

                    {/* Base Image - Featured */}
                    {(() => {
                      const baseImg = selectedCampaignForProfile.settings.generated_images.find((i: any) => i.is_base_image);
                      const baseIndex = selectedCampaignForProfile.settings.generated_images.findIndex((i: any) => i.is_base_image);
                      if (baseImg) {
                        return (
                          <div style={{ marginBottom: "24px" }}>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#6B7280", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "18px" }}>⭐</span> BASE IMAGE
                            </div>
                            <div style={{ 
                              display: "flex", 
                              gap: "20px",
                              backgroundColor: "#F8FAFC",
                              borderRadius: "16px",
                              padding: "16px",
                              border: "2px solid #d42f48"
                            }}>
                              <div style={{ 
                                width: "300px", 
                                height: "400px", 
                                borderRadius: "12px", 
                                overflow: "hidden",
                                flexShrink: 0,
                                boxShadow: "0 8px 30px rgba(0,0,0,0.12)"
                              }}>
                                <img 
                                  src={baseImg.image_url} 
                                  alt="Base Image"
                                  style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                                  onClick={() => handleEnlargeImage(baseImg.image_url, "Base Image", baseImg)}
                                />
                              </div>
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <h4 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600", color: "#1F2937" }}>
                                  {baseImg.product_name || "Campaign Look"}
                                </h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", color: "#6B7280", fontSize: "14px" }}>
                                  <div>👤 <strong>Model:</strong> {baseImg.model_name}</div>
                                  <div>🏛️ <strong>Scene:</strong> {baseImg.scene_name}</div>
                                  <div>👕 <strong>Outfit:</strong> {baseImg.clothing_type}</div>
                                </div>
                                <div style={{ marginTop: "16px", fontSize: "12px", color: "#9CA3AF" }}>
                                  This is the source image for all keyframe variations
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Keyframe Variations Grid */}
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#6B7280", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>🎥</span> KEYFRAME VARIATIONS
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "16px",
                        maxHeight: "50vh",
                        overflowY: "auto",
                        padding: "8px",
                      }}
                    >
                      {selectedCampaignForProfile.settings.generated_images
                        .filter((img: any) => !img.is_base_image)
                        .map((img: any, index: number) => {
                          const actualIndex = selectedCampaignForProfile.settings.generated_images.findIndex((i: any) => i === img);
                          // Determine icon based on shot type
                          const getIcon = (shotType: string) => {
                            if (!shotType) return "📷";
                            const s = shotType.toLowerCase();
                            if (s.includes("shirt") || s.includes("top")) return "👕";
                            if (s.includes("pants") || s.includes("bottom")) return "👖";
                            if (s.includes("outfit") || s.includes("detail")) return "✨";
                            if (s.includes("sitting")) return "🪑";
                            if (s.includes("leaning")) return "🧱";
                            if (s.includes("looking") || s.includes("candid")) return "👀";
                            if (s.includes("thought") || s.includes("contemplat")) return "💭";
                            if (s.includes("explor") || s.includes("walk")) return "🚶";
                            if (s.includes("low angle")) return "⬆️";
                            if (s.includes("high angle")) return "⬇️";
                            if (s.includes("profile")) return "👤";
                            return "📷";
                          };
                          return (
                          <div
                            key={index}
                            style={{
                              borderRadius: "12px",
                              overflow: "hidden",
                              backgroundColor: "#FFFFFF",
                                border: "1px solid #E5E7EB",
                              position: "relative",
                              cursor: "pointer",
                                transition: "all 0.2s ease",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-3px)";
                                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
                              e.currentTarget.style.borderColor = "#d42f48";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                              e.currentTarget.style.borderColor = "#E5E7EB";
                            }}
                          >
                              {/* Image */}
                              <div style={{ aspectRatio: "3/4", position: "relative" }}>
                                {img.video_url ? (
                                  <video
                                    src={img.video_url}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onClick={() => handleEnlargeImage(img.video_url, img.shot_type || `Keyframe ${index + 1}`)}
                                    autoPlay muted loop playsInline
                                  />
                                ) : (
                                  <img
                                    src={img.image_url}
                                    alt={img.shot_type || `Keyframe ${index + 1}`}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onClick={() => handleEnlargeImage(img.image_url, img.shot_type || `Keyframe ${index + 1}`, img)}
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                )}
                            {/* Delete Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                    deleteCampaignImage(selectedCampaignForProfile.id, actualIndex);
                                  }}
                                  style={{
                                    position: "absolute", top: "8px", right: "8px", zIndex: 10,
                                    backgroundColor: "rgba(239, 68, 68, 0.85)", border: "none",
                                    borderRadius: "6px", color: "#FFFFFF", padding: "4px 8px",
                                    fontSize: "12px", cursor: "pointer", opacity: 0.8,
                                    transition: "opacity 0.2s"
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                                >
                                  🗑️
                                </button>
                                {/* Video Badge */}
                                {img.video_url && (
                                  <div style={{
                                    position: "absolute", top: "8px", left: "8px",
                                    backgroundColor: "#10B981", color: "white",
                                    padding: "3px 8px", borderRadius: "4px",
                                    fontSize: "10px", fontWeight: "700"
                                  }}>
                                    🎬 VIDEO
                                  </div>
                                )}
                              </div>
                              {/* Label */}
                              <div style={{
                                padding: "10px 12px",
                                backgroundColor: "#F9FAFB",
                                borderTop: "1px solid #E5E7EB"
                              }}>
                                <div style={{
                                  fontSize: "12px", fontWeight: "600", color: "#374151",
                                  display: "flex", alignItems: "center", gap: "6px"
                                }}>
                                  <span style={{ fontSize: "14px" }}>{getIcon(img.shot_type)}</span>
                                  {img.shot_type || `Keyframe ${index + 1}`}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                      {/* Show placeholder loading cards for images being generated */}
                      {selectedCampaignForProfile.generation_status ===
                        "generating" &&
                        generatingFullCampaign ===
                          selectedCampaignForProfile.id &&
                        // Show 5 total slots minus already generated
                        Array.from({
                          length: Math.max(
                            0,
                            5 -
                              (selectedCampaignForProfile.settings
                                .generated_images?.length || 0)
                          ),
                        }).map((_, idx) => (
                          <div
                            key={`placeholder-${idx}`}
                            style={{
                              border: "2px dashed #D1D5DB",
                              borderRadius: "12px",
                              overflow: "hidden",
                              backgroundColor: "#F9FAFB",
                              position: "relative",
                              aspectRatio: "1",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "20px",
                            }}
                          >
                            {/* Beating heart spinner */}
                            <img
                              src="/beating.gif"
                              alt="Loading"
                              style={{
                                width: "80px",
                                height: "80px",
                                marginBottom: "16px",
                              }}
                            />
                            <p
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#6B7280",
                                margin: 0,
                                textAlign: "center",
                              }}
                            >
                              Generating Image{" "}
                              {(selectedCampaignForProfile.settings
                                .generated_images?.length || 0) +
                                idx +
                                1}
                              ...
                            </p>
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#9CA3AF",
                                margin: "8px 0 0 0",
                                textAlign: "center",
                              }}
                            >
                              Please wait
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      aspectRatio: "16/9",
                      borderRadius: "12px",
                      overflow: "hidden",
                      backgroundColor: "#F3F4F6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "48px",
                        color: "#9CA3AF",
                      }}
                    >
                      📁
                    </div>
                    <p
                      style={{
                        fontSize: "16px",
                        color: "#6B7280",
                        margin: 0,
                      }}
                    >
                      No images generated yet
                    </p>
                  </div>
                )}

                {/* Unified Campaign Video */}
                {selectedCampaignForProfile.settings?.unified_video_url && (
                  <div style={{ marginTop: "32px" }}>
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: "700",
                        color: "#1F2937",
                        marginBottom: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      🎥 Final Campaign Video
                    </h3>
                    <div
                      style={{
                        border: "2px solid #10B981",
                        borderRadius: "16px",
                        overflow: "hidden",
                        backgroundColor: "#000",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                      }}
                    >
                      <video
                        src={
                          selectedCampaignForProfile.settings.unified_video_url
                        }
                        controls
                        autoPlay
                        loop
                        style={{
                          width: "100%",
                          height: "auto",
                          display: "block",
                        }}
                      />
                      <div
                        style={{
                          padding: "12px 16px",
                          backgroundColor: "#F9FAFB",
                          borderTop: "1px solid #E5E7EB",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            margin: 0,
                          }}
                        >
                          Complete campaign showcase combining all shots in
                          storytelling sequence
                        </p>
                        <a
                          href={
                            selectedCampaignForProfile.settings
                              .unified_video_url
                          }
                          download={`${selectedCampaignForProfile.name}_unified_campaign.mp4`}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#10B981",
                            color: "white",
                                border: "none",
                            borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: "600",
                                cursor: "pointer",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#059669";
                              }}
                              onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#10B981";
                          }}
                        >
                          💾 Download Video
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unified Video Generation in Progress */}
                {selectedCampaignForProfile.settings?.unified_video_status ===
                  "generating" && (
                  <div style={{ marginTop: "32px" }}>
                    <h3
                      style={{
                        fontSize: "20px",
                        fontWeight: "700",
                        color: "#1F2937",
                        marginBottom: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                              }}
                            >
                      🎥 Final Campaign Video
                    </h3>
                    <div
                      style={{
                        border: "2px solid #10B981",
                        borderRadius: "16px",
                        overflow: "hidden",
                        backgroundColor: "#000",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                        position: "relative",
                        height: "400px",
                      }}
                    >
                      {/* Blurred preview from first video */}
                      {selectedCampaignForProfile.settings?.videos?.[0]
                        ?.video_url && (
                                <video
                          src={
                            selectedCampaignForProfile.settings.videos[0]
                              .video_url
                          }
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                            filter: "blur(10px)",
                            transform: "scale(1.1)",
                                  }}
                                  muted
                                  loop
                          autoPlay
                                />
                      )}

                      {/* Overlay with spinner and text */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(0, 0, 0, 0.6)",
                        }}
                      >
                        {/* Beating heart spinner */}
                                <img
                          src="/beating.gif"
                          alt="Loading..."
                                  style={{
                            width: "120px",
                            height: "120px",
                            marginBottom: "24px",
                          }}
                        />

                        {/* Text */}
                        <p
                          style={{
                            color: "white",
                            fontSize: "24px",
                            fontWeight: "700",
                            margin: 0,
                            textAlign: "center",
                            textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                          }}
                        >
                          Creating Final Campaign Video
                        </p>

                        <p
                          style={{
                            color: "rgba(255,255,255,0.9)",
                            fontSize: "16px",
                            margin: "12px 0 0 0",
                            textAlign: "center",
                                  }}
                        >
                          Stitching{" "}
                          {selectedCampaignForProfile.settings?.videos
                            ?.length || 5}{" "}
                          clips together...
                        </p>

                        <p
                          style={{
                            color: "rgba(255,255,255,0.7)",
                            fontSize: "14px",
                            margin: "8px 0 0 0",
                            textAlign: "center",
                          }}
                        >
                          This may take 2-3 minutes
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Campaign Videos Gallery */}
                {(() => {
                  console.log("📹 PROFILE MODAL - Checking for videos:");
                  console.log(
                    "📹 selectedCampaignForProfile:",
                    selectedCampaignForProfile
                  );
                  console.log(
                    "📹 settings:",
                    selectedCampaignForProfile.settings
                  );
                  console.log(
                    "📹 videos array:",
                    selectedCampaignForProfile.settings?.videos
                  );
                  console.log(
                    "📹 videos length:",
                    selectedCampaignForProfile.settings?.videos?.length
                  );
                  console.log(
                    "📹 generated_images:",
                    selectedCampaignForProfile.settings?.generated_images
                  );
                  console.log(
                    "📹 images with video_url:",
                    selectedCampaignForProfile.settings?.generated_images?.filter(
                      (img: any) => img.video_url
                    )
                  );
                  return null;
                })()}
                {((selectedCampaignForProfile.settings?.videos &&
                  selectedCampaignForProfile.settings.videos.length > 0) ||
                  (selectedCampaignForProfile.settings?.generated_images &&
                    selectedCampaignForProfile.settings.generated_images.some(
                      (img: any) => img.video_url
                    ))) && (
                  <div style={{ marginTop: "32px" }}>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#1F2937",
                        marginBottom: "16px",
                      }}
                    >
                      🎬 Campaign Videos (
                      {selectedCampaignForProfile.settings?.videos
                        ? selectedCampaignForProfile.settings.videos.length
                        : selectedCampaignForProfile.settings.generated_images.filter(
                            (img: any) => img.video_url
                          ).length}
                      )
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(300px, 1fr))",
                        gap: "16px",
                      }}
                    >
                      {(
                        selectedCampaignForProfile.settings?.videos ||
                        selectedCampaignForProfile.settings.generated_images.filter(
                          (img: any) => img.video_url
                        )
                      ).map((video: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid #E5E7EB",
                            borderRadius: "12px",
                            overflow: "hidden",
                            backgroundColor: "#F9FAFB",
                          }}
                        >
                          {video.video_url ? (
                            <video
                              autoPlay
                              loop
                              muted
                              playsInline
                              controls
                              style={{ width: "100%", height: "auto" }}
                              preload="metadata"
                            >
                              <source src={video.video_url} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                            ) : (
                              <div
                                style={{
                                position: "relative",
                                  width: "100%",
                                height: "250px",
                                overflow: "hidden",
                              }}
                            >
                              {/* Blurred thumbnail */}
                              {video.image_url && (
                                <img
                                  src={video.image_url}
                                  alt="Generating video..."
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    filter: "blur(8px)",
                                    transform: "scale(1.1)",
                                }}
                                />
                            )}

                              {/* Overlay with spinner and text */}
                              <div
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                                }}
                              >
                                {/* Beating heart spinner */}
                                <img
                                  src="/beating.gif"
                                  alt="Loading..."
                              style={{
                                    width: "80px",
                                    height: "80px",
                                    marginBottom: "16px",
                                  }}
                                />

                                {/* Text */}
                                <p
                                  style={{
                                color: "white",
                                    fontSize: "16px",
                                fontWeight: "600",
                                    margin: 0,
                                    textAlign: "center",
                                    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                              }}
                            >
                                  {video.error
                                    ? `❌ ${video.error}`
                                    : "Video Generation in Process"}
                                </p>

                                {!video.error && (
                                  <p
                                    style={{
                                      color: "rgba(255,255,255,0.8)",
                                      fontSize: "14px",
                                      margin: "8px 0 0 0",
                                      textAlign: "center",
                                    }}
                                  >
                                    This may take 2-3 minutes...
                                  </p>
                      )}
                    </div>
                  </div>
                          )}
                  <div
                    style={{
                              padding: "12px",
                      display: "flex",
                              justifyContent: "space-between",
                      alignItems: "center",
                      }}
                    >
                    <p
                      style={{
                                fontSize: "14px",
                        color: "#6B7280",
                        margin: 0,
                      }}
                    >
                              {video.shot_type || `Video ${idx + 1}`}
                            </p>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              {video.video_url && (
                                <>
                                  {/* Regenerate Button */}
                                  <button
                                    onClick={async () => {
                                      if (
                                        !confirm(
                                          `Regenerate this video? This will cost 5 credits.`
                                        )
                                      )
                                        return;

                                      try {
                                        const response = await fetch(
                                          `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${selectedCampaignForProfile.id}/regenerate-video/${idx}`,
                                          {
                                            method: "POST",
                                            headers: {
                                              Authorization: `Bearer ${token}`,
                                            },
                                          }
                                        );

                                        if (response.ok) {
                                          const result = await response.json();
                                          alert(
                                            `🔄 Regenerating ${result.shot_type}...`
                                          );
                                          // Refresh to show regenerating state
                                          await fetchData();
                                        } else {
                                          const error = await response.text();
                                          alert(
                                            `Failed to regenerate: ${error}`
                                          );
                                        }
                                      } catch (error) {
                                        console.error(
                                          "Regeneration failed:",
                                          error
                                        );
                                        alert("Failed to start regeneration");
                                      }
                                    }}
                                    style={{
                                      padding: "4px 8px",
                                      backgroundColor: "#F59E0B",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "4px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "#D97706";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "#F59E0B";
                                    }}
                                  >
                                    🔄
                                  </button>

                                  {/* Download Button */}
                                  <a
                                    href={video.video_url}
                                    download={`${
                                      selectedCampaignForProfile.name
                                    }_${
                                      video.shot_name || `video_${idx + 1}`
                                    }.mp4`}
                                    style={{
                                      padding: "4px 8px",
                                      backgroundColor: "#10B981",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "4px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      cursor: "pointer",
                                      textDecoration: "none",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      transition: "all 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "#059669";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "#10B981";
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    💾
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  {/* Generate More Images Button */}
                  <button
                    onClick={() => {
                      setShowCampaignProfileModal(false);
                      // Check if campaign has base image - show keyframe modal
                      const hasBaseImage = (selectedCampaignForProfile?.settings?.generated_images?.length || 0) > 0;
                      setSelectedCampaignForGeneration(selectedCampaignForProfile);
                      if (hasBaseImage) {
                        setShowKeyframeModal(true);
                      } else {
                      setShowParameterModal(true);
                      }
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#d42f48",
                      border: "none",
                      borderRadius: "6px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#d42f48";
                    }}
                  >
                    ➕ Generate More
                  </button>

                  {/* Generate Videos Button */}
                  <button
                    onClick={() => {
                      setSelectedCampaignForBulkVideo(
                        selectedCampaignForProfile
                      );
                      setShowCampaignProfileModal(false);
                      // Reset video generation state
                      setSelectedImagesForVideo(new Set());
                      setVeoDirectMode(false);
                      setBulkVideoCustomPrompt("");
                      setShowBulkVideoModal(true);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#d42f48",
                      border: "none",
                      borderRadius: "6px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#d42f48";
                    }}
                  >
                    🎬 Generate Videos
                  </button>

                  {/* Create Final Campaign Video Button - Show if videos exist */}
                  {selectedCampaignForProfile?.settings?.videos &&
                    selectedCampaignForProfile.settings.videos.length >= 3 && (
                      <button
                        onClick={() => {
                          handleGenerateUnifiedVideo(
                            selectedCampaignForProfile.id
                          );
                        }}
                        disabled={
                          generatingUnifiedVideo ===
                          selectedCampaignForProfile.id
                        }
                        style={{
                          padding: "8px 16px",
                          backgroundColor:
                            generatingUnifiedVideo ===
                            selectedCampaignForProfile.id
                              ? "#9CA3AF"
                              : "#10B981",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "14px",
                          fontWeight: "600",
                          cursor:
                            generatingUnifiedVideo ===
                            selectedCampaignForProfile.id
                              ? "not-allowed"
                              : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (
                            generatingUnifiedVideo !==
                            selectedCampaignForProfile.id
                          ) {
                            e.currentTarget.style.backgroundColor = "#059669";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (
                            generatingUnifiedVideo !==
                            selectedCampaignForProfile.id
                          ) {
                            e.currentTarget.style.backgroundColor = "#10B981";
                          }
                        }}
                      >
                        {generatingUnifiedVideo ===
                        selectedCampaignForProfile.id
                          ? "🎥 Creating..."
                          : "🎥 Create Final Campaign Video"}
                      </button>
                    )}

                  {/* Edit Campaign Button */}
                  <button
                    onClick={(e) => {
                      setShowCampaignProfileModal(false);
                      editCampaign(selectedCampaignForProfile, e);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "transparent",
                      border: "1px solid #E5E7EB",
                      borderRadius: "6px",
                      color: "#6B7280",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#F9FAFB";
                      e.currentTarget.style.borderColor = "#D1D5DB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.borderColor = "#E5E7EB";
                    }}
                  >
                    ✏️ Edit
                  </button>

                  {/* Delete Campaign Button */}
                  <button
                    onClick={(e) => {
                      setShowCampaignProfileModal(false);
                      deleteCampaign(selectedCampaignForProfile.id, e);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "transparent",
                      border: "1px solid #EF4444",
                      borderRadius: "6px",
                      color: "#EF4444",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#FEF2F2";
                      e.currentTarget.style.borderColor = "#DC2626";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.borderColor = "#EF4444";
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  paddingTop: "16px",
                  borderTop: "1px solid #E5E7EB",
                }}
              >
                <button
                  onClick={() => setShowCampaignProfileModal(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "transparent",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    color: "#6B7280",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enlarged Image Modal */}
        {showEnlargedImage && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
              overflow: "visible",
            }}
            onClick={() => setShowEnlargedImage(false)}
          >
            <div
              style={{
                position: "relative",
                maxWidth: "90vw",
                maxHeight: "90vh",
                display: "flex",
                gap: isMobile ? "12px" : "24px",
                alignItems: "center",
                flexDirection: isMobile ? "row" : "row",
                overflow: "visible",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowEnlargedImage(false)}
                style={{
                  position: "absolute",
                  top: "-50px",
                  right: "0",
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  borderRadius: "50%",
                  color: "white",
                  fontSize: "24px",
                  cursor: "pointer",
                  zIndex: 2001,
                }}
              >
                ✕
              </button>

              {/* Main Image/Video Display */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  maxHeight: "90vh",
                  position: "relative",
                }}
              >
                {enlargedImageUrl.endsWith(".mp4") ||
                enlargedImageUrl.includes("/video_") ? (
                  <video
                    src={enlargedImageUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    style={{
                      maxWidth: "100%",
                      maxHeight: "80vh",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                ) : (
                  <img
                    src={enlargedImageUrl}
                    alt={enlargedImageAlt}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "80vh",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                )}
                <p
                  style={{
                    color: "white",
                    marginTop: "16px",
                    fontSize: "16px",
                    textAlign: "center",
                  }}
                >
                  {enlargedImageAlt}
                </p>
              </div>

              {/* Side Menu - Desktop Only */}
              {!isMobile && (
              <div
                style={{
                  width: "300px",
                  backgroundColor: "rgba(30, 30, 30, 0.95)",
                  borderRadius: "12px",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  maxHeight: "90vh",
                  overflowY: "auto",
                    overflowX: "visible",
                    position: "relative",
                    overflow: "visible",
                    justifyContent: "space-between",
                }}
              >
                  {/* Action Buttons Container - Same Line */}
                  <div
                  style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "16px",
                      width: "100%",
                      justifyContent: "center",
                      position: "relative",
                      overflow: "visible",
                  }}
                    onMouseLeave={() => {
                      // Delay clearing tooltip to prevent flickering
                      setTimeout(() => {
                        setShowDownloadTooltip(false);
                        setShowTweakTooltip(false);
                        setShowAddProductTooltip(false);
                        setActiveTooltip(null);
                      }, 100);
                    }}
                  >
                {/* Download Button */}
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        overflow: "visible",
                        zIndex: 1,
                      }}
                      onMouseEnter={(e) => {
                        const button = e.currentTarget.querySelector("button");
                        if (button) button.style.transform = "scale(1.1)";
                        setShowDownloadTooltip(true);
                        setActiveTooltip({
                          title: "Download",
                          description: "Save image to your device",
                        });
                      }}
                      onMouseLeave={(e) => {
                        const button = e.currentTarget.querySelector("button");
                        if (button) button.style.transform = "scale(1)";
                        // Don't clear tooltip here - let parent handle it
                      }}
                    >
                <button
                  onClick={() =>
                    downloadImage(
                      enlargedImageUrl,
                      `campaign-${Date.now()}.jpg`
                    )
                  }
                  style={{
                          padding: "6px",
                          backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                          width: "56px",
                          height: "56px",
                          flexShrink: 0,
                          transition: "transform 0.2s ease",
                  }}
                >
                        <img
                          src="/downloadimage.png"
                          alt="Download Image"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                </button>
                    </div>

                {/* Tweak Button */}
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        overflow: "visible",
                        zIndex: 1,
                      }}
                      onMouseEnter={(e) => {
                        const button = e.currentTarget.querySelector("button");
                        if (button) button.style.transform = "scale(1.1)";
                        setShowTweakTooltip(true);
                        setActiveTooltip({
                          title: "Tweak",
                          description:
                            "AI-powered image editing with custom prompts",
                        });
                      }}
                      onMouseLeave={(e) => {
                        const button = e.currentTarget.querySelector("button");
                        if (button) button.style.transform = "scale(1)";
                        // Don't clear tooltip here - let parent handle it
                      }}
                    >
                <button
                  onClick={() => setShowTweakModal(true)}
                  style={{
                          padding: "6px",
                          backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                          width: "56px",
                          height: "56px",
                          flexShrink: 0,
                          transition: "transform 0.2s ease",
                        }}
                      >
                        <img
                          src="/tweakimage.png"
                          alt="Tweak Image"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      </button>
                    </div>

                    {/* Add Product Button - Opens product selection to add product to existing image */}
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        overflow: "visible",
                        zIndex: 1,
                  }}
                  onMouseEnter={(e) => {
                        if (!addingProductToImage) {
                          const button =
                            e.currentTarget.querySelector("button");
                          if (button) button.style.transform = "scale(1.1)";
                          setShowAddProductTooltip(true);
                          setActiveTooltip({
                            title: "Add Product",
                            description: "Add another product onto this image",
                          });
                        }
                  }}
                  onMouseLeave={(e) => {
                        const button = e.currentTarget.querySelector("button");
                        if (button) button.style.transform = "scale(1)";
                        // Don't clear tooltip here - let parent handle it
                      }}
                    >
                      <button
                        onClick={() => {
                          if (!addingProductToImage) {
                            setProductSelectionMode("image");
                            setSelectedProductForImage(null);
                            setShowProductSelectionModal(true);
                          }
                        }}
                        disabled={addingProductToImage}
                        style={{
                          padding: "6px",
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "8px",
                          cursor: addingProductToImage
                            ? "not-allowed"
                            : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "56px",
                          height: "56px",
                          opacity: addingProductToImage ? 0.6 : 1,
                          transition: "opacity 0.2s ease, transform 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src="/addclothes.png"
                          alt="Add Product"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                </button>
                    </div>
                  </div>

                  {/* Tooltip Display Container - Positioned lower where text used to be */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "24px",
                      minHeight: "80px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {activeTooltip ? (
                      <div
                    style={{
                      padding: "12px 16px",
                          backgroundColor: "rgba(0, 0, 0, 0.6)",
                      borderRadius: "8px",
                          textAlign: "center",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                      fontWeight: "600",
                            marginBottom: "6px",
                            fontSize: "14px",
                            color: "#FFFFFF",
                          }}
                        >
                          {activeTooltip.title}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "rgba(255, 255, 255, 0.8)",
                            lineHeight: "1.4",
                          }}
                        >
                          {activeTooltip.description}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "12px 16px",
                          textAlign: "center",
                          color: "rgba(255, 255, 255, 0.4)",
                          fontSize: "12px",
                          fontStyle: "italic",
                        }}
                      >
                        Hover over an action to see details
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile: Action Buttons on Side of Image */}
              {isMobile && (
                <div
                  style={{
                      display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                      alignItems: "center",
                      justifyContent: "center",
                  }}
                >
                  {/* Download Button */}
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                    onMouseEnter={(e) => {
                      const button = e.currentTarget.querySelector("button");
                      if (button) button.style.transform = "scale(1.1)";
                      setShowDownloadTooltip(true);
                      setActiveTooltip({
                        title: "Download",
                        description: "Save image to your device",
                      });
                    }}
                    onMouseLeave={(e) => {
                      const button = e.currentTarget.querySelector("button");
                      if (button) button.style.transform = "scale(1)";
                      setShowDownloadTooltip(false);
                      setActiveTooltip(null);
                    }}
                  >
                    <button
                      onClick={() =>
                        downloadImage(
                          enlargedImageUrl,
                          `campaign-${Date.now()}.jpg`
                        )
                      }
                      style={{
                        padding: "8px",
                        backgroundColor: "rgba(30, 30, 30, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "48px",
                        height: "48px",
                        flexShrink: 0,
                        transition: "transform 0.2s ease",
                      }}
                    >
                      <img
                        src="/downloadimage.png"
                        alt="Download Image"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                  </button>
                  </div>

                  {/* Tweak Button */}
                <div
                  style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                    onMouseEnter={(e) => {
                      const button = e.currentTarget.querySelector("button");
                      if (button) button.style.transform = "scale(1.1)";
                      setShowTweakTooltip(true);
                      setActiveTooltip({
                        title: "Tweak",
                        description:
                          "AI-powered image editing with custom prompts",
                      });
                    }}
                    onMouseLeave={(e) => {
                      const button = e.currentTarget.querySelector("button");
                      if (button) button.style.transform = "scale(1)";
                      setShowTweakTooltip(false);
                      setActiveTooltip(null);
                  }}
                >
                    <button
                      onClick={() => setShowTweakModal(true)}
                    style={{
                        padding: "8px",
                        backgroundColor: "rgba(30, 30, 30, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "48px",
                        height: "48px",
                        flexShrink: 0,
                        transition: "transform 0.2s ease",
                    }}
                  >
                      <img
                        src="/tweakimage.png"
                        alt="Tweak Image"
                    style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                    }}
                      />
                    </button>
                  </div>

                  {/* Add Product Button */}
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                    }}
                    onMouseEnter={(e) => {
                      if (!addingProductToImage) {
                        const button = e.currentTarget.querySelector("button");
                        if (button) button.style.transform = "scale(1.1)";
                        setShowAddProductTooltip(true);
                        setActiveTooltip({
                          title: "Add Product",
                          description: "Add another product onto this image",
                        });
                      }
                    }}
                    onMouseLeave={(e) => {
                      const button = e.currentTarget.querySelector("button");
                      if (button) button.style.transform = "scale(1)";
                      setShowAddProductTooltip(false);
                      setActiveTooltip(null);
                    }}
                  >
                    <button
                      onClick={() => {
                        if (!addingProductToImage) {
                          setProductSelectionMode("image");
                          setSelectedProductForImage(null);
                          setShowProductSelectionModal(true);
                        }
                      }}
                      disabled={addingProductToImage}
                      style={{
                        padding: "8px",
                        backgroundColor: "rgba(30, 30, 30, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "8px",
                        cursor: addingProductToImage
                          ? "not-allowed"
                          : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "48px",
                        height: "48px",
                        opacity: addingProductToImage ? 0.6 : 1,
                        transition: "opacity 0.2s ease, transform 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src="/addclothes.png"
                        alt="Add Product"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </button>
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        {/* Bulk Video Generation Modal */}
        {showBulkVideoModal && selectedCampaignForBulkVideo && (
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
            onClick={() => {
              setShowBulkVideoModal(false);
              setShowVideoModelDropdown(false);
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "20px",
                padding: "min(40px, 5vw)",
                maxWidth: "95vw",
                maxHeight: "90vh",
                width: "min(800px, 95vw)",
                position: "relative",
                overflow: "visible",
                boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
                margin: "20px",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowBulkVideoModal(false);
                  setShowVideoModelDropdown(false);
                }}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  padding: "12px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "24px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F3F4F6";
                  e.currentTarget.style.color = "#374151";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#6B7280";
                }}
              >
                ✕
              </button>
              {/* Scrollable Content Container */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingRight: "8px",
                }}
              >
                {/* Modal Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "32px",
                    paddingBottom: "24px",
                    borderBottom: "2px solid #E5E7EB",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "28px",
                        fontWeight: "700",
                        color: "#1F2937",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      🎬 Generate Videos
                    </h2>
                    <p
                      style={{
                        fontSize: "16px",
                        color: "#6B7280",
                        margin: "8px 0 0 0",
                        lineHeight: 1.5,
                      }}
                    >
                      Transform your campaign images into engaging videos for
                      social media
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#F3F4F6",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      {selectedCampaignForBulkVideo.name}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                        marginTop: "4px",
                      }}
                    >
                      {selectedCampaignForBulkVideo.settings?.generated_images
                        ?.length || 0}{" "}
                      images
                    </div>
                  </div>
                </div>

                {/* Veo Direct Mode Toggle */}
                {bulkVideoModel === "veo" && (
                  <div style={{ marginBottom: "32px" }}>
                    <div
                      style={{
                        backgroundColor: veoDirectMode ? "#F0F9FF" : "#F9FAFB",
                        border: `2px solid ${
                          veoDirectMode ? "#0EA5E9" : "#E5E7EB"
                        }`,
                        borderRadius: "16px",
                        padding: "20px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "16px",
                          cursor: "pointer",
                          margin: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={veoDirectMode}
                          onChange={(e) => setVeoDirectMode(e.target.checked)}
                          style={{
                            margin: 0,
                            marginTop: "2px",
                            transform: "scale(1.2)",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "16px",
                              color: veoDirectMode ? "#0EA5E9" : "#374151",
                              marginBottom: "8px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            ⭐ Veo Direct Mode
                            <span
                              style={{
                                backgroundColor: "#FEF3C7",
                                color: "#D97706",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "500",
                              }}
                            >
                              EXPERIMENTAL
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#6B7280",
                              lineHeight: 1.5,
                            }}
                          >
                            Generate videos directly from model + product +
                            scene without needing existing images. Perfect for
                            creating original video content from scratch.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Image Selection (only if NOT in Veo Direct Mode) */}
                {!veoDirectMode && (
                  <div style={{ marginBottom: "32px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#1F2937",
                            margin: "0 0 4px 0",
                          }}
                        >
                          Select Images for Video Generation
                        </h3>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            margin: 0,
                          }}
                        >
                          Choose which shots to transform into videos
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => {
                            const allIndices = new Set(
                              Array.from(
                                {
                                  length:
                                    selectedCampaignForBulkVideo.settings
                                      ?.generated_images?.length || 0,
                                },
                                (_, i) => i
                              )
                            );
                            setSelectedImagesForVideo(allIndices);
                          }}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#d42f48",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#b0263c")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "#d42f48")
                          }
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedImagesForVideo(new Set())}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#F3F4F6",
                            color: "#374151",
                            border: "1px solid #D1D5DB",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#E5E7EB";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#F3F4F6";
                          }}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: "16px",
                        maxHeight: "300px",
                        overflowY: "auto",
                        padding: "20px",
                        border: "2px solid #E5E7EB",
                        borderRadius: "16px",
                        backgroundColor: "#FAFAFA",
                      }}
                    >
                      {selectedCampaignForBulkVideo.settings?.generated_images?.map(
                        (img: any, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedImagesForVideo((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(idx)) {
                                  newSet.delete(idx);
                                } else {
                                  newSet.add(idx);
                                }
                                return newSet;
                              });
                            }}
                            style={{
                              position: "relative",
                              cursor: "pointer",
                              border: selectedImagesForVideo.has(idx)
                                ? "3px solid #d42f48"
                                : "2px solid #E5E7EB",
                              borderRadius: "12px",
                              overflow: "hidden",
                              aspectRatio: "1",
                              transition: "all 0.3s ease",
                              backgroundColor: "#FFFFFF",
                              boxShadow: selectedImagesForVideo.has(idx)
                                ? "0 8px 25px rgba(212, 47, 72, 0.3)"
                                : "0 2px 8px rgba(0,0,0,0.1)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-4px)";
                              e.currentTarget.style.boxShadow =
                                selectedImagesForVideo.has(idx)
                                  ? "0 12px 35px rgba(212, 47, 72, 0.4)"
                                  : "0 8px 25px rgba(0,0,0,0.15)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                selectedImagesForVideo.has(idx)
                                  ? "0 8px 25px rgba(212, 47, 72, 0.3)"
                                  : "0 2px 8px rgba(0,0,0,0.1)";
                            }}
                          >
                            <img
                              src={img.image_url}
                              alt={`Image ${idx + 1}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                opacity: selectedImagesForVideo.has(idx)
                                  ? 1
                                  : 0.7,
                                transition: "opacity 0.2s ease",
                              }}
                            />
                            {/* Shot type label */}
                            <div
                              style={{
                                position: "absolute",
                                bottom: "8px",
                                left: "8px",
                                right: "8px",
                                backgroundColor: "rgba(9, 10, 12, 0.8)",
                                color: "#FFFFFF",
                                borderRadius: "8px",
                                padding: "6px 8px",
                                fontSize: "11px",
                                fontWeight: "600",
                                textAlign: "center",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              {img.shot_type || `Shot ${idx + 1}`}
                            </div>
                            {selectedImagesForVideo.has(idx) && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "8px",
                                  right: "8px",
                                  backgroundColor: "#d42f48",
                                  color: "#FFFFFF",
                                  borderRadius: "50%",
                                  width: "28px",
                                  height: "28px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "14px",
                                  fontWeight: "bold",
                                  boxShadow: "0 2px 8px rgba(212, 47, 72, 0.4)",
                                }}
                              >
                                ✓
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: "16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 20px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#1F2937",
                          }}
                        >
                          {selectedImagesForVideo.size} of{" "}
                          {selectedCampaignForBulkVideo.settings
                            ?.generated_images?.length || 0}{" "}
                          images selected
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          💡 Tip: Select 3-5 shots for TikTok, or all 10 for a
                          complete CapCut sequence
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => {
                            const allIndices = new Set(
                              Array.from(
                                {
                                  length:
                                    selectedCampaignForBulkVideo.settings
                                      ?.generated_images?.length || 0,
                                },
                                (_, i) => i
                              )
                            );
                            setSelectedImagesForVideo(allIndices);
                          }}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#d42f48",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#b0263c")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "#d42f48")
                          }
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedImagesForVideo(new Set())}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#EF4444",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#DC2626")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "#EF4444")
                          }
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Custom Prompt */}
                <div style={{ marginBottom: "32px" }}>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: "0 0 8px 0",
                    }}
                  >
                    Custom Prompt (Optional)
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: "0 0 16px 0",
                    }}
                  >
                    Add specific instructions for video generation
                  </p>
                  <textarea
                    value={bulkVideoCustomPrompt}
                    onChange={(e) => setBulkVideoCustomPrompt(e.target.value)}
                    placeholder={
                      veoDirectMode
                        ? "Describe the video scene... (e.g., 'model walking in a luxury setting, dramatic lighting')"
                        : "e.g., smooth camera movement, professional fashion, cinematic lighting..."
                    }
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "2px solid #E5E7EB",
                      fontSize: "14px",
                      resize: "vertical",
                      minHeight: "100px",
                      fontFamily: "inherit",
                      backgroundColor: "#FAFAFA",
                      color: "#1F2937",
                      transition: "border-color 0.2s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#d42f48";
                      e.currentTarget.style.backgroundColor = "#FFFFFF";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#E5E7EB";
                      e.currentTarget.style.backgroundColor = "#FAFAFA";
                    }}
                  />
                </div>

                {/* Video Model Selection */}
                <div style={{ marginBottom: "32px" }}>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: "0 0 8px 0",
                    }}
                  >
                    Video Model
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: "0 0 16px 0",
                    }}
                  >
                    Choose the AI model for video generation
                  </p>

                  {/* Dropdown Button */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() =>
                        setShowVideoModelDropdown(!showVideoModelDropdown)
                      }
                      style={{
                        width: "100%",
                        padding: "16px 20px",
                        border: "2px solid #E5E7EB",
                        borderRadius: "12px",
                        backgroundColor: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.2s ease",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#d42f48";
                        e.currentTarget.style.backgroundColor = "#FEF2F2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E5E7EB";
                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>
                          {getVideoModelInfo(bulkVideoModel).icon}
                        </span>
                        <div>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "16px",
                              color: "#1F2937",
                              marginBottom: "2px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {getVideoModelInfo(bulkVideoModel).name}
                            <span
                              style={{
                                backgroundColor:
                                  getVideoModelInfo(bulkVideoModel).badgeColor,
                                color:
                                  getVideoModelInfo(bulkVideoModel)
                                    .badgeTextColor,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "500",
                              }}
                            >
                              {getVideoModelInfo(bulkVideoModel).badge}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
                            {getVideoModelInfo(bulkVideoModel).pricing}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "16px",
                          color: "#6B7280",
                          transform: showVideoModelDropdown
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      >
                        ▼
                      </span>
                    </button>

                    {/* Dropdown Options */}
                    {showVideoModelDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          backgroundColor: "#FFFFFF",
                          border: "2px solid #E5E7EB",
                          borderRadius: "12px",
                          boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                          zIndex: 1000,
                          marginTop: "4px",
                          overflow: "hidden",
                        }}
                      >
                        {["wan", "seedance", "veo", "kling"].map((model) => (
                          <button
                            key={model}
                            onClick={() => {
                              setBulkVideoModel(model);
                              setShowVideoModelDropdown(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "16px 20px",
                              border: "none",
                              backgroundColor:
                                bulkVideoModel === model
                                  ? "#FEF2F2"
                                  : "transparent",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              transition: "background-color 0.2s ease",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                              if (bulkVideoModel !== model) {
                                e.currentTarget.style.backgroundColor =
                                  "#F9FAFB";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (bulkVideoModel !== model) {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }
                            }}
                          >
                            <span style={{ fontSize: "20px" }}>
                              {getVideoModelInfo(model).icon}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: "600",
                                  fontSize: "16px",
                                  color: "#1F2937",
                                  marginBottom: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                {getVideoModelInfo(model).name}
                                <span
                                  style={{
                                    backgroundColor:
                                      getVideoModelInfo(model).badgeColor,
                                    color:
                                      getVideoModelInfo(model).badgeTextColor,
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: "500",
                                  }}
                                >
                                  {getVideoModelInfo(model).badge}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#6B7280",
                                  marginBottom: "4px",
                                }}
                              >
                                {getVideoModelInfo(model).description}
                              </div>
                              <div
                                style={{ fontSize: "12px", color: "#9CA3AF" }}
                              >
                                {getVideoModelInfo(model).pricing}
                              </div>
                            </div>
                            {bulkVideoModel === model && (
                              <span
                                style={{
                                  fontSize: "16px",
                                  color: "#d42f48",
                                  fontWeight: "bold",
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Video Quality Selection */}
                <div style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      marginBottom: "12px",
                      color: "#374151",
                    }}
                  >
                    Video Quality
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                    }}
                  >
                    <label
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        border:
                          bulkVideoQuality === "480p"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          bulkVideoQuality === "480p" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="bulkVideoQuality"
                        value="480p"
                        checked={bulkVideoQuality === "480p"}
                        onChange={(e) => setBulkVideoQuality(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: "500",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          480p
                        </div>
                        <div style={{ fontSize: "11px", color: "#6B7280" }}>
                          {bulkVideoModel === "seedance"
                            ? `${
                                bulkVideoDuration === "10s" ? "3" : "2"
                              } credits`
                            : bulkVideoModel === "kling"
                            ? `${
                                bulkVideoDuration === "10s" ? "3" : "2"
                              } credits`
                            : bulkVideoModel === "veo"
                            ? `${
                                bulkVideoDuration === "10s" ? "4" : "3"
                              } credits`
                            : "1 credit"}
                        </div>
                      </div>
                    </label>
                    <label
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        border:
                          bulkVideoQuality === "720p"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          bulkVideoQuality === "720p" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="bulkVideoQuality"
                        value="720p"
                        checked={bulkVideoQuality === "720p"}
                        onChange={(e) => setBulkVideoQuality(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: "500",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          720p
                        </div>
                        <div style={{ fontSize: "11px", color: "#6B7280" }}>
                          {bulkVideoModel === "kling"
                            ? `${
                                bulkVideoDuration === "10s" ? "4" : "3"
                              } credits`
                            : bulkVideoModel === "veo"
                            ? `${
                                bulkVideoDuration === "10s" ? "6" : "4"
                              } credits`
                            : "2 credits"}
                        </div>
                      </div>
                    </label>
                    {(bulkVideoModel === "seedance" ||
                      bulkVideoModel === "kling" ||
                      bulkVideoModel === "veo") && (
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 14px",
                          border:
                            bulkVideoQuality === "1080p"
                              ? "2px solid #d42f48"
                              : "1px solid #D1D5DB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor:
                            bulkVideoQuality === "1080p" ? "#F3F4F6" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          name="bulkVideoQuality"
                          value="1080p"
                          checked={bulkVideoQuality === "1080p"}
                          onChange={(e) => setBulkVideoQuality(e.target.value)}
                          style={{ margin: 0 }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: "500",
                              fontSize: "14px",
                              color: "#1F2937",
                            }}
                          >
                            1080p
                          </div>
                          <div style={{ fontSize: "11px", color: "#6B7280" }}>
                            {bulkVideoModel === "kling"
                              ? `${
                                  bulkVideoDuration === "10s" ? "6" : "4"
                                } credits`
                              : bulkVideoModel === "veo"
                              ? `${
                                  bulkVideoDuration === "10s" ? "8" : "5"
                                } credits`
                              : `${
                                  bulkVideoDuration === "10s" ? "6" : "4"
                                } credits`}
                          </div>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Video Duration Selection (for Seedance, Kling & Veo) */}
                {(bulkVideoModel === "seedance" ||
                  bulkVideoModel === "kling" ||
                  bulkVideoModel === "veo") && (
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                        color: "#374151",
                      }}
                    >
                      Video Duration
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                      }}
                    >
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "10px 14px",
                          border:
                            bulkVideoDuration === "5s"
                              ? "2px solid #d42f48"
                              : "1px solid #D1D5DB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor:
                            bulkVideoDuration === "5s" ? "#F3F4F6" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          name="bulkVideoDuration"
                          value="5s"
                          checked={bulkVideoDuration === "5s"}
                          onChange={(e) => setBulkVideoDuration(e.target.value)}
                          style={{ marginRight: "8px" }}
                        />
                        <div
                          style={{
                            fontWeight: "500",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          5 seconds
                        </div>
                      </label>
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "10px 14px",
                          border:
                            bulkVideoDuration === "10s"
                              ? "2px solid #d42f48"
                              : "1px solid #D1D5DB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor:
                            bulkVideoDuration === "10s" ? "#F3F4F6" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          name="bulkVideoDuration"
                          value="10s"
                          checked={bulkVideoDuration === "10s"}
                          onChange={(e) => setBulkVideoDuration(e.target.value)}
                          style={{ marginRight: "8px" }}
                        />
                        <div
                          style={{
                            fontWeight: "500",
                            fontSize: "14px",
                            color: "#1F2937",
                          }}
                        >
                          10 seconds
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>{" "}
              {/* End of scrollable content container */}
              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "24px",
                  paddingTop: "24px",
                  borderTop: "2px solid #E5E7EB",
                }}
              >
                <button
                  onClick={() => setShowBulkVideoModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    backgroundColor: "transparent",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    color: "#6B7280",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // Validate based on mode
                    if (!veoDirectMode && selectedImagesForVideo.size === 0) {
                      alert(
                        "Please select at least one image for video generation"
                      );
                      return;
                    }

                    if (!token) {
                      alert("Please log in to generate videos");
                      return;
                    }

                    setGeneratingBulkVideos(true);

                    try {
                      const response = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${selectedCampaignForBulkVideo.id}/generate-videos`,
                        {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            video_quality: bulkVideoQuality,
                            duration: bulkVideoDuration,
                            model: bulkVideoModel,
                            custom_prompt: bulkVideoCustomPrompt || null,
                            veo_direct_mode: veoDirectMode,
                            selected_image_indices: veoDirectMode
                              ? []
                              : Array.from(selectedImagesForVideo),
                          }),
                        }
                      );

                      if (response.ok) {
                        const result = await response.json();
                        console.log("✅ Bulk video generation result:", result);

                        setGeneratingBulkVideos(false);
                        setShowBulkVideoModal(false);

                        alert(
                          `✅ Video generation completed!\n\n` +
                            `Success: ${result.success_count}\n` +
                            `Failed: ${result.failed_count}\n` +
                            `Credits used: ${result.credits_used}\n` +
                            `Credits remaining: ${result.credits_remaining}`
                        );

                        // Refresh campaign data
                        await fetchData();
                      } else {
                        const error = await response.json();
                        throw new Error(
                          error.detail || "Video generation failed"
                        );
                      }
                    } catch (error) {
                      console.error("Bulk video generation failed:", error);
                      setGeneratingBulkVideos(false);
                      alert(
                        "❌ Video generation failed:\n" +
                          (error instanceof Error
                            ? error.message
                            : String(error))
                      );
                    }
                  }}
                  disabled={generatingBulkVideos}
                  style={{
                    flex: 1,
                    padding: "12px",
                    backgroundColor: generatingBulkVideos
                      ? "#D1D5DB"
                      : "#d42f48",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: generatingBulkVideos ? "not-allowed" : "pointer",
                  }}
                >
                  {generatingBulkVideos
                    ? "Generating..."
                    : "🎬 Generate Videos"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tweak Image Modal */}
        {showTweakModal && (
          <>
            <style jsx>{`
              @keyframes spin {
                0% {
                  transform: rotate(0deg);
                }
                100% {
                  transform: rotate(360deg);
                }
              }
            `}</style>
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
                zIndex: 3000,
              }}
            >
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  width: "90vw",
                  height: "80vh",
                  maxWidth: "1200px",
                  maxHeight: "800px",
                  border: "1px solid #E5E7EB",
                  display: "flex",
                  overflow: "hidden",
                }}
              >
                {/* Left Panel - Image Display */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#F9FAFB",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {tweaking && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 10,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          border: "4px solid #F3F4F6",
                          borderTop: "4px solid #d42f48",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          margin: "0 auto 16px",
                        }}
                      />
                      <p
                        style={{
                          color: "#6B7280",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      >
                        Tweaking image...
                      </p>
                    </div>
                  )}
                  <img
                    src={currentImageForTweak}
                    alt="Image to tweak"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(9, 10, 12, 0.1)",
                      opacity: tweaking ? 0.5 : 1,
                      transition: "opacity 0.3s ease",
                    }}
                  />
                </div>

                {/* Right Panel - Input */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#090a0c",
                    display: "flex",
                    flexDirection: "column",
                    padding: "32px",
                    position: "relative",
                  }}
                >
                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setShowTweakModal(false);
                      setTweakPrompt("");
                    }}
                    style={{
                      position: "absolute",
                      top: "24px",
                      right: "24px",
                      background: "none",
                      border: "none",
                      fontSize: "24px",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>

                  {/* Title */}
                  <h2
                    style={{
                      color: "#FFFFFF",
                      fontSize: "24px",
                      fontWeight: "600",
                      margin: "0 0 8px 0",
                    }}
                  >
                    ✨ Tweak Image
                  </h2>
                  <p
                    style={{
                      color: "#9CA3AF",
                      fontSize: "14px",
                      marginBottom: "24px",
                    }}
                  >
                    Describe the changes you want to make. AI will apply your
                    modifications while preserving the overall composition.
                  </p>

                  {/* Prompt Input */}
                  <div style={{ marginBottom: "24px" }}>
                    <label
                      style={{
                        display: "block",
                        color: "#E5E7EB",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "8px",
                      }}
                    >
                      Tweak Prompt
                    </label>
                    <textarea
                      value={tweakPrompt}
                      onChange={(e) => setTweakPrompt(e.target.value)}
                      placeholder="Type your changes... (e.g., 'make the background darker, add more contrast, warmer tones')"
                      style={{
                        width: "100%",
                        height: "120px",
                        padding: "16px",
                        backgroundColor: "#1F2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        fontSize: "14px",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  {/* Example Prompts */}
                  <div
                    style={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      padding: "16px",
                      borderRadius: "8px",
                      marginBottom: "20px",
                    }}
                  >
                    <h3
                      style={{
                        color: "#E5E7EB",
                        fontSize: "14px",
                        margin: "0 0 12px 0",
                        fontWeight: "600",
                      }}
                    >
                      Quick Examples
                    </h3>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                    >
                      {[
                        "make it more dramatic",
                        "darker background",
                        "brighter lighting",
                        "add more contrast",
                        "warmer tones",
                        "cooler tones",
                        "vintage look",
                        "cinematic mood",
                      ].map((example) => (
                        <button
                          key={example}
                          onClick={() => setTweakPrompt(example)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#454545",
                            border: "1px solid #4B5563",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "#D1D5DB",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#4B5563";
                            e.currentTarget.style.color = "#FFFFFF";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#374151";
                            e.currentTarget.style.color = "#D1D5DB";
                          }}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginTop: "auto",
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowTweakModal(false);
                        setTweakPrompt("");
                      }}
                      style={{
                        flex: 1,
                        padding: "14px 24px",
                        backgroundColor: "#374151",
                        border: "1px solid #4B5563",
                        borderRadius: "8px",
                        color: "#D1D5DB",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#4B5563";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#374151";
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={tweakImage}
                      disabled={tweaking || !tweakPrompt.trim()}
                      style={{
                        flex: 2,
                        padding: "14px 24px",
                        backgroundColor:
                          tweaking || !tweakPrompt.trim()
                            ? "#4B5563"
                            : "#d42f48",
                        border: "none",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor:
                          tweaking || !tweakPrompt.trim()
                            ? "not-allowed"
                            : "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!tweaking && tweakPrompt.trim()) {
                          e.currentTarget.style.backgroundColor = "#b91c1c";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!tweaking && tweakPrompt.trim()) {
                          e.currentTarget.style.backgroundColor = "#d42f48";
                        }
                      }}
                    >
                      {tweaking ? "✨ Tweaking..." : "✨ Apply Tweak"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
