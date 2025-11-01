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
  const { user, token } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0,
    totalProducts: 0,
    totalModels: 0,
    totalScenes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch stats first (progressive loading)
  useEffect(() => {
    const fetchStats = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Fetch stats in parallel (products, models, scenes)
        const [productsRes, modelsRes, scenesRes] = await Promise.all([
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

        const [products, models, scenes] = await Promise.all([
          productsRes.ok ? productsRes.json() : [],
          modelsRes.ok ? modelsRes.json() : [],
          scenesRes.ok ? scenesRes.json() : [],
        ]);

        // Set stats immediately (we'll get campaign count from campaigns fetch)
        setStats({
          totalCampaigns: 0, // Will be updated when campaigns load
          totalProducts: products.length,
          totalModels: models.length,
          totalScenes: scenes.length,
        });

        setLoading(false); // Show stats now
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  // Fetch recent campaigns separately (after stats are loaded)
  useEffect(() => {
    const fetchRecentCampaigns = async () => {
      if (!token || loading) return; // Wait for stats to load first

      try {
        setLoadingCampaigns(true);

        // Fetch only recent campaigns with limit (12 recent campaigns)
        const campaignsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/campaigns?limit=12&order_by=created_at&order=desc`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (campaignsRes.ok) {
          const campaignsData = await campaignsRes.json();

          // Campaigns are already sorted by the API (order_by=created_at&order=desc)
          setCampaigns(campaignsData);

          // Fetch count separately (fast endpoint)
          const countRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/campaigns/count`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (countRes.ok) {
            const countData = await countRes.json();
            setStats((prev) => ({
              ...prev,
              totalCampaigns: countData.count || 0,
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching recent campaigns:", error);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    if (!loading) {
      // Only fetch campaigns after stats are loaded
      fetchRecentCampaigns();
    }
  }, [token, loading]);

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

          {loadingCampaigns ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(2, 1fr)"
                  : "repeat(auto-fill, minmax(180px, 1fr))",
                gap: isMobile ? "12px" : "16px",
              }}
            >
              {[...Array(6)].map((_, index) => (
                <div
                  key={`loading-${index}`}
                  style={{
                    backgroundColor: "#E5E7EB",
                    borderRadius: "8px",
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src="/beating.gif"
                    alt="Loading"
                    style={{
                      width: "32px",
                      height: "32px",
                      opacity: 0.6,
                    }}
                    onError={(e) => {
                      e.currentTarget.src = "/heart.png";
                    }}
                  />
                </div>
              ))}
            </div>
          ) : campaigns.length > 0 ? (
            <div
              className="dashboard-campaigns-grid"
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(2, 1fr)"
                  : "repeat(auto-fill, minmax(180px, 1fr))",
                gap: isMobile ? "12px" : "16px",
                overflowX: isMobile ? "auto" : "visible",
                maxWidth: "100%",
                scrollbarWidth: "thin",
                scrollbarColor: "#cbd5e1 transparent",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  onClick={() => (window.location.href = "/campaigns")}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    overflow: "hidden",
                    transition: "all 0.2s",
                    cursor: "pointer",
                    aspectRatio: "1",
                    position: "relative",
                    flexShrink: 0,
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
                      width: "100%",
                      height: "100%",
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
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#9CA3AF",
                          fontSize: "12px",
                          padding: "16px",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                          🎯
                        </div>
                        <div>No images</div>
                      </div>
                    )}
                    {/* Campaign name overlay - bottom */}
                    <div
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
                      }}
                    >
                      {campaign.name}
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
