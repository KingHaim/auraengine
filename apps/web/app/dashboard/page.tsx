"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

interface Campaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  settings?: {
    generated_images?: Array<{ image_url: string }>;
  };
}

interface Stats {
  totalCampaigns: number;
  totalProducts: number;
  totalModels: number;
  totalScenes: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0,
    totalProducts: 0,
    totalModels: 0,
    totalScenes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("aura_token");
        if (!token) return;

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

        const [campaignsData, products, models, scenes] = await Promise.all([
          campaignsRes.ok ? campaignsRes.json() : [],
          productsRes.ok ? productsRes.json() : [],
          modelsRes.ok ? modelsRes.json() : [],
          scenesRes.ok ? scenesRes.json() : [],
        ]);

        // Set campaigns for display (recent 3)
        setCampaigns(campaignsData.slice(0, 3));

        // Set stats with actual data
        setStats({
          totalCampaigns: campaignsData.length,
          totalProducts: products.length,
          totalModels: models.length,
          totalScenes: scenes.length,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "16px", color: "#6B7280" }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: "0" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#1E293B",
              marginBottom: "8px",
            }}
          >
            Welcome back, {user?.full_name || user?.email?.split("@")[0]}!
          </h1>
          <p style={{ fontSize: "16px", color: "#64748B", margin: 0 }}>
            Here's what's happening with your campaigns today.
          </p>
        </div>

        {/* Stats Grid - Horizontal Scrollable */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            gap: "16px",
            marginBottom: "32px",
            paddingBottom: "8px",
            scrollbarWidth: "thin",
            scrollbarColor: "#cbd5e1 transparent",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: "12px",
              padding: "24px",
              border: "1px solid #E2E8F0",
              minWidth: "200px",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#d42f48",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                🎯
              </div>
              <div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  {stats.totalCampaigns}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#64748B",
                  }}
                >
                  Campaigns
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: "12px",
              padding: "24px",
              border: "1px solid #E2E8F0",
              minWidth: "200px",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#22D3EE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                📦
              </div>
              <div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  {stats.totalProducts}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#64748B",
                  }}
                >
                  Products
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: "12px",
              padding: "24px",
              border: "1px solid #E2E8F0",
              minWidth: "200px",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                👤
              </div>
              <div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  {stats.totalModels}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#64748B",
                  }}
                >
                  Models
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: "12px",
              padding: "24px",
              border: "1px solid #E2E8F0",
              minWidth: "200px",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                🏞️
              </div>
              <div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#1E293B",
                  }}
                >
                  {stats.totalScenes}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#64748B",
                  }}
                >
                  Scenes
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "32px",
            border: "1px solid #E2E8F0",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#1E293B",
              marginBottom: "16px",
            }}
          >
            Quick Actions
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            <a
              href="/campaigns"
              style={{
                display: "block",
                padding: "16px",
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  marginBottom: "8px",
                }}
              >
                🎯
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1F2937",
                  marginBottom: "4px",
                }}
              >
                Create Campaign
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                }}
              >
                Start a new campaign
              </div>
            </a>

            <a
              href="/products"
              style={{
                display: "block",
                padding: "16px",
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  marginBottom: "8px",
                }}
              >
                📦
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1F2937",
                  marginBottom: "4px",
                }}
              >
                Add Products
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                }}
              >
                Upload new items
              </div>
            </a>

            <a
              href="/models"
              style={{
                display: "block",
                padding: "16px",
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  marginBottom: "8px",
                }}
              >
                👤
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1F2937",
                  marginBottom: "4px",
                }}
              >
                Manage Models
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                }}
              >
                Upload model photos
              </div>
            </a>

            <a
              href="/scenes"
              style={{
                display: "block",
                padding: "16px",
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  marginBottom: "8px",
                }}
              >
                🏞️
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1F2937",
                  marginBottom: "4px",
                }}
              >
                Add Scenes
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                }}
              >
                Upload backgrounds
              </div>
            </a>
          </div>
        </div>

        {/* Recent Campaigns */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1E293B",
              }}
            >
              Recent Campaigns
            </h3>
            <a
              href="/campaigns"
              style={{
                fontSize: "14px",
                color: "#d42f48",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              View all →
            </a>
          </div>

          {campaigns.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                maxWidth: "800px",
              }}
            >
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  onClick={() => (window.location.href = "/campaigns")}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    overflow: "hidden",
                    transition: "all 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(9, 10, 12, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "4/3",
                      position: "relative",
                      backgroundColor: "#F3F4F6",
                    }}
                  >
                    {campaign.settings?.generated_images?.[0]?.image_url ? (
                      <img
                        src={campaign.settings.generated_images[0].image_url}
                        alt={campaign.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
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
                          color: "#9CA3AF",
                          fontSize: "14px",
                        }}
                      >
                        No images yet
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "12px" }}>
                    <h4
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#1F2937",
                        marginBottom: "6px",
                      }}
                    >
                      {campaign.name}
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#6B7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {campaign.status}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#6B7280",
                        }}
                      >
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                padding: "40px",
                textAlign: "center",
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
              <h4
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1F2937",
                  marginBottom: "8px",
                }}
              >
                No campaigns yet
              </h4>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6B7280",
                  marginBottom: "16px",
                }}
              >
                Create your first campaign to get started
              </p>
              <a
                href="/campaigns"
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  backgroundColor: "#d42f48",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Create Campaign
              </a>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
