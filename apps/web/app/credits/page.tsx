"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";
import StripePaymentForm from "../../components/StripePaymentForm";

export default function CreditsPage() {
  const { user, token, loading } = useAuth();
  const [stripePublishableKey, setStripePublishableKey] = useState<
    string | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [isAnnual, setIsAnnual] = useState(false);

  // Credit packages with psychological pricing and per-credit indicators
  const creditPackages = [
    {
      credits: 20,
      price: 2.0, // $2.00 = 200 cents → 200/10 = 20 credits
      popular: false,
      description: "Perfect for trying out the platform",
      perCredit: 0.1,
      savings: null,
    },
    {
      credits: 50,
      price: 5.0, // $5.00 = 500 cents → 500/10 = 50 credits
      popular: true,
      description: "Most popular choice",
      perCredit: 0.1,
      savings: null,
    },
    {
      credits: 100,
      price: 10.0, // $10.00 = 1000 cents → 1000/10 = 100 credits
      popular: false,
      description: "Great for small projects",
      perCredit: 0.1,
      savings: null,
    },
    {
      credits: 200,
      price: 20.0, // $20.00 = 2000 cents → 2000/10 = 200 credits
      popular: false,
      description: "For regular creators",
      perCredit: 0.1,
      savings: null,
    },
    {
      credits: 500,
      price: 50.0, // $50.00 = 5000 cents → 5000/10 = 500 credits
      popular: false,
      description: "For professional use",
      perCredit: 0.1,
      savings: "Save $5.01",
    },
  ];

  // Subscription tiers with better per-credit value than one-time purchases
  const subscriptionTiers = [
    {
      name: "Starter",
      monthlyPrice: 24.99,
      annualPrice: 19.99,
      credits: 120,
      popular: false,
      description: "Solo creator friendly",
      features: ["Basic AI generation", "Standard support", "Community access"],
      color: "#d42f48", // Light blue
      anchor: false,
      perCredit: 0.21,
    },
    {
      name: "Professional",
      monthlyPrice: 74.99,
      annualPrice: 59.99,
      credits: 400,
      popular: true,
      description: "Best value for teams",
      features: [
        "Premium AI models",
        "Priority support",
        "Advanced analytics",
        "Custom branding",
      ],
      color: "#d42f48", // Bold violet
      anchor: false,
      perCredit: 0.19,
    },
    {
      name: "Enterprise",
      monthlyPrice: 199.99,
      annualPrice: 159.99,
      credits: 1200,
      popular: false,
      description: "For large organizations",
      features: [
        "Exclusive AI models",
        "Dedicated support",
        "White-label solutions",
        "API access",
        "Custom training",
      ],
      color: "#1E293B", // Deep navy
      anchor: true,
      perCredit: 0.17,
    },
  ];

  useEffect(() => {
    // Get Stripe publishable key
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/config`)
      .then((res) => res.json())
      .then((data) => setStripePublishableKey(data.publishable_key))
      .catch((err) => console.error("Failed to load Stripe config:", err));
  }, []);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{
    credits: number;
    price: number;
  } | null>(null);

  const handlePurchase = async (credits: number, price: number) => {
    if (!token) {
      setMessage("Please sign in to purchase credits");
      return;
    }

    // Check if user has active subscription with remaining credits
    const hasActiveSubscription =
      user?.subscription_status === "active" &&
      user?.subscription_credits &&
      user.subscription_credits > 0;

    if (hasActiveSubscription) {
      setMessage(
        `Cannot purchase additional credits while subscription credits remain. You have ${user.subscription_credits} subscription credits remaining. Please use all subscription credits before purchasing additional credits.`
      );
      return;
    }

    setSelectedPackage({ credits, price });
    setShowPaymentForm(true);
    setMessage("");
  };

  const handlePaymentSuccess = (result: any) => {
    setMessage(result.message);
    setShowPaymentForm(false);
    setSelectedPackage(null);
    // Refresh user data to show updated credits
    window.location.reload();
  };

  const handlePaymentError = (error: string) => {
    setMessage(`Payment failed: ${error}`);
    setShowPaymentForm(false);
    setSelectedPackage(null);
  };

  const handleSubscribe = async (tier: typeof subscriptionTiers[0]) => {
    if (!token) {
      setMessage("Please sign in to create a subscription");
      return;
    }

    setIsProcessing(true);
    setMessage("");

    try {
      const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
      const amountInCents = Math.round(price * 100); // Convert to cents

      // Create subscription checkout session via API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/create-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subscription_type: tier.name.toLowerCase(),
            price_id: tier.priceId || "", // We'll add Stripe price IDs later
            is_annual: isAnnual,
            credits: tier.credits,
            amount: amountInCents,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create subscription");
      }

      const { checkout_url } = await response.json();

      // Redirect to Stripe Checkout
      if (checkout_url) {
        window.location.href = checkout_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Subscription creation failed:", error);
      setMessage(
        `Subscription creation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
          color: "#1E293B",
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "#1E293B",
              marginBottom: "8px",
            }}
          >
            Credits & Billing
          </h1>
          <p style={{ color: "#64748B", fontSize: "16px", margin: 0 }}>
            Manage your credits and choose the perfect plan for your needs
          </p>
        </div>

        {/* Current Credits Card */}
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "16px",
            padding: "32px",
            marginBottom: "40px",
            border: "1px solid #E2E8F0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "48px",
              fontWeight: "700",
              color: "#d42f48",
              marginBottom: "8px",
            }}
          >
            {(user?.subscription_credits || 0) + (user?.credits || 0)}
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#1E293B",
              marginBottom: "8px",
            }}
          >
            Total Available Credits
          </div>
          {user?.subscription_credits && user.subscription_credits > 0 && (
            <div
              style={{
                fontSize: "14px",
                color: "#059669",
                marginBottom: "8px",
                fontWeight: "600",
              }}
            >
              Subscription Credits: {user.subscription_credits} · Purchased
              Credits: {user.credits || 0}
            </div>
          )}
          {user?.subscription_credits && user.subscription_credits > 0 && (
            <div
              style={{
                backgroundColor: "#FEF3C7",
                border: "1px solid #F59E0B",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
                fontSize: "13px",
                color: "#92400E",
              }}
            >
              ⚠️ You have subscription credits remaining. Please use all
              subscription credits before purchasing additional credits.
            </div>
          )}
          <p style={{ color: "#64748B", fontSize: "14px", margin: 0 }}>
            Each generation costs 2–12 credits depending on complexity.
            <br />
            <strong>Example:</strong> A basic image = 3 credits · A 4K video =
            10 credits
          </p>
        </div>

        {/* Subscription Upsell Banner */}
        <div
          style={{
            backgroundColor:
              "linear-gradient(135deg, #d42f48 0%, #d42f48 100%)",
            background: "linear-gradient(135deg, #d42f48 0%, #d42f48 100%)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "40px",
            color: "white",
            textAlign: "center",
          }}
        >
          <h3
            style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}
          >
            💰 Subscriptions = Better Credit Value
          </h3>
          <p style={{ fontSize: "14px", margin: 0, opacity: 0.9 }}>
            From $0.17/credit (vs $0.25 one-time) • Unused credits roll over •
            Cancel anytime
          </p>
        </div>

        {/* Subscription Plans */}
        <div style={{ marginBottom: "60px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                color: "#1E293B",
                margin: 0,
              }}
            >
              Subscription Plans
            </h2>

            {/* Annual/Monthly Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "14px", color: "#64748B" }}>
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                style={{
                  width: "48px",
                  height: "24px",
                  backgroundColor: isAnnual ? "#d42f48" : "#E2E8F0",
                  border: "none",
                  borderRadius: "12px",
                  position: "relative",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    position: "absolute",
                    top: "2px",
                    left: isAnnual ? "26px" : "2px",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                />
              </button>
              <span style={{ fontSize: "14px", color: "#64748B" }}>
                Yearly{" "}
                <span style={{ color: "#10B981", fontWeight: "600" }}>
                  (Save 15%)
                </span>
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px",
            }}
          >
            {subscriptionTiers.map((tier, index) => {
              const currentPrice = isAnnual
                ? tier.annualPrice
                : tier.monthlyPrice;
              const originalPrice = tier.monthlyPrice;
              const savings = isAnnual
                ? Math.round(
                    ((originalPrice - currentPrice) / originalPrice) * 100
                  )
                : 0;

              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: tier.popular ? "#F8FAFC" : "#FFFFFF",
                    border: tier.popular
                      ? `2px solid ${tier.color}`
                      : "1px solid #E2E8F0",
                    borderRadius: "20px",
                    padding: "32px",
                    textAlign: "center",
                    position: "relative",
                    transition: "all 0.2s",
                    transform: tier.anchor ? "scale(1.05)" : "scale(1)",
                    zIndex: tier.anchor ? 10 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = tier.anchor
                      ? "scale(1.08)"
                      : "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 40px rgba(9, 10, 12, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = tier.anchor
                      ? "scale(1.05)"
                      : "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {tier.popular && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-16px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: tier.color,
                        color: "#FFFFFF",
                        padding: "8px 20px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        letterSpacing: "0.5px",
                      }}
                    >
                      MOST POPULAR
                    </div>
                  )}

                  {tier.anchor && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-16px",
                        right: "20px",
                        backgroundColor: "#F59E0B",
                        color: "#FFFFFF",
                        padding: "6px 12px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      PREMIUM
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#1E293B",
                      marginBottom: "8px",
                    }}
                  >
                    {tier.name}
                  </div>

                  <div style={{ marginBottom: "8px" }}>
                    <span
                      style={{
                        fontSize: "48px",
                        fontWeight: "700",
                        color: tier.color,
                      }}
                    >
                      ${currentPrice}
                    </span>
                    {isAnnual && savings > 0 && (
                      <span
                        style={{
                          fontSize: "16px",
                          color: "#10B981",
                          fontWeight: "600",
                          marginLeft: "8px",
                        }}
                      >
                        Save {savings}%
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: "16px",
                      color: "#64748B",
                      marginBottom: "16px",
                    }}
                  >
                    per {isAnnual ? "month (billed yearly)" : "month"}
                  </div>

                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "#1E293B",
                      marginBottom: "8px",
                    }}
                  >
                    {tier.credits} Credits
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#10B981",
                      fontWeight: "600",
                      marginBottom: "16px",
                    }}
                  >
                    ${tier.perCredit} / credit
                  </div>

                  <div
                    style={{
                      fontSize: "14px",
                      color: "#64748B",
                      marginBottom: "24px",
                      lineHeight: "1.5",
                    }}
                  >
                    {tier.description}
                  </div>

                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 32px 0",
                      fontSize: "14px",
                      color: "#64748B",
                    }}
                  >
                    {tier.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        style={{
                          marginBottom: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          style={{
                            color: "#10B981",
                            marginRight: "8px",
                            fontSize: "16px",
                          }}
                        >
                          ✓
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(tier)}
                    disabled={isProcessing}
                    style={{
                      width: "100%",
                      padding: "16px",
                      backgroundColor: isProcessing ? "#9CA3AF" : tier.color,
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "16px",
                      fontWeight: "600",
                      cursor: isProcessing ? "not-allowed" : "pointer",
                      transition: "all 0.2s",
                      opacity: isProcessing ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 12px rgba(9, 10, 12, 0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }
                    }}
                  >
                    {isProcessing ? "Processing..." : `Choose ${tier.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Credit Packages */}
        <div style={{ marginBottom: "60px" }}>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "600",
              color: "#1E293B",
              marginBottom: "24px",
            }}
          >
            One-Time Credit Purchase
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
              marginBottom: "32px",
            }}
          >
            {creditPackages.map((pkg, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: pkg.popular ? "#F8FAFC" : "#FFFFFF",
                  border: pkg.popular
                    ? "2px solid #d42f48"
                    : "1px solid #E2E8F0",
                  borderRadius: "16px",
                  padding: "24px",
                  textAlign: "center",
                  position: "relative",
                  transition: "all 0.2s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 25px rgba(9, 10, 12, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {pkg.popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "#d42f48",
                      color: "#FFFFFF",
                      padding: "6px 16px",
                      borderRadius: "16px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    POPULAR
                  </div>
                )}

                {pkg.savings && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      backgroundColor: "#10B981",
                      color: "#FFFFFF",
                      padding: "4px 8px",
                      borderRadius: "8px",
                      fontSize: "10px",
                      fontWeight: "600",
                    }}
                  >
                    {pkg.savings}
                  </div>
                )}

                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "700",
                    color: "#1E293B",
                    marginBottom: "4px",
                  }}
                >
                  {pkg.credits}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#64748B",
                    marginBottom: "16px",
                  }}
                >
                  credits
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#d42f48",
                    marginBottom: "4px",
                  }}
                >
                  ${pkg.price}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748B",
                    marginBottom: "8px",
                  }}
                >
                  ${pkg.perCredit} / credit
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#64748B",
                    marginBottom: "20px",
                    lineHeight: "1.4",
                  }}
                >
                  {pkg.description}
                </div>
                <button
                  onClick={() => handlePurchase(pkg.credits, pkg.price)}
                  disabled={
                    isProcessing ||
                    (user?.subscription_status === "active" &&
                      (user?.subscription_credits ?? 0) > 0)
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    backgroundColor:
                      isProcessing ||
                      (user?.subscription_status === "active" &&
                        (user?.subscription_credits ?? 0) > 0)
                        ? "#9CA3AF"
                        : "#d42f48",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor:
                      isProcessing ||
                      (user?.subscription_status === "active" &&
                        (user?.subscription_credits ?? 0) > 0)
                        ? "not-allowed"
                        : "pointer",
                    transition: "all 0.2s",
                  }}
                  title={
                    user?.subscription_status === "active" &&
                    (user?.subscription_credits ?? 0) > 0
                      ? `You have ${user.subscription_credits} subscription credits remaining. Use all subscription credits before purchasing additional credits.`
                      : undefined
                  }
                >
                  {isProcessing
                    ? "Processing..."
                    : user?.subscription_status === "active" &&
                      (user?.subscription_credits ?? 0) > 0
                    ? "Use Subscription Credits First"
                    : "Purchase"}
                </button>
              </div>
            ))}
          </div>

          {/* Message */}
          {message && (
            <div
              style={{
                backgroundColor: message.includes("Successfully")
                  ? "#D1FAE5"
                  : "#FEE2E2",
                border: message.includes("Successfully")
                  ? "1px solid #A7F3D0"
                  : "1px solid #FECACA",
                borderRadius: "12px",
                padding: "16px",
                color: message.includes("Successfully") ? "#065F46" : "#991B1B",
                fontSize: "14px",
                marginBottom: "24px",
              }}
            >
              {message}
            </div>
          )}
        </div>

        {/* Pricing Information */}
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: "16px",
            padding: "32px",
            border: "1px solid #E2E8F0",
          }}
        >
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1E293B",
              marginBottom: "16px",
            }}
          >
            How Credits Work
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "24px",
            }}
          >
            <div>
              <h4
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1E293B",
                  marginBottom: "8px",
                }}
              >
                💰 Pricing
              </h4>
              <ul
                style={{
                  color: "#64748B",
                  fontSize: "14px",
                  margin: 0,
                  paddingLeft: "16px",
                }}
              >
                <li>One-time: $0.25/credit (bulk discounts available)</li>
                <li>Subscriptions: $0.17-$0.21/credit (better value!)</li>
                <li>Credits never expire</li>
                <li>Secure payment via Stripe</li>
                <li>Instant credit delivery</li>
              </ul>
            </div>
            <div>
              <h4
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1E293B",
                  marginBottom: "8px",
                }}
              >
                🎨 Generation Costs
              </h4>
              <ul
                style={{
                  color: "#64748B",
                  fontSize: "14px",
                  margin: 0,
                  paddingLeft: "16px",
                }}
              >
                <li>Model Generation: 3 credits</li>
                <li>Pose Generation: 2 credits</li>
                <li>Campaign Generation: 6 credits</li>
                <li>Video Generation: 5-12 credits</li>
              </ul>
            </div>
            <div>
              <h4
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1E293B",
                  marginBottom: "8px",
                }}
              >
                🎁 Benefits
              </h4>
              <ul
                style={{
                  color: "#64748B",
                  fontSize: "14px",
                  margin: 0,
                  paddingLeft: "16px",
                }}
              >
                <li>Bulk discounts at scale</li>
                <li>High-quality AI models</li>
                <li>Professional support</li>
                <li>Commercial usage rights</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentForm && selectedPackage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(9, 10, 12, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "0",
              maxWidth: "520px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(9, 10, 12, 0.25)",
              border: "1px solid #E5E7EB",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid #E5E7EB",
                backgroundColor: "#F9FAFB",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#1F2937",
                      margin: 0,
                      marginBottom: "4px",
                    }}
                  >
                    Complete Payment
                  </h2>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: 0,
                    }}
                  >
                    Secure payment powered by Stripe
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPaymentForm(false);
                    setSelectedPackage(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "28px",
                    cursor: "pointer",
                    color: "#6B7280",
                    padding: "8px",
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#E5E7EB";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6B7280";
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: "32px" }}>
              {/* Order Summary */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  padding: "20px",
                  borderRadius: "12px",
                  marginBottom: "32px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1E293B",
                    margin: 0,
                    marginBottom: "16px",
                  }}
                >
                  Order Summary
                </h3>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ color: "#64748B", fontSize: "14px" }}>
                    Credits Package:
                  </span>
                  <span style={{ fontWeight: "600", color: "#1E293B" }}>
                    {selectedPackage.credits} credits
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "12px",
                    borderTop: "1px solid #E2E8F0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "#1E293B",
                    }}
                  >
                    Total:
                  </span>
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: "700",
                      color: "#059669",
                    }}
                  >
                    ${(selectedPackage.price / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Form */}
              <StripePaymentForm
                amount={selectedPackage.price}
                credits={selectedPackage.credits}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                token={token || ""}
              />

              {/* Security Notice */}
              <div
                style={{
                  marginTop: "24px",
                  padding: "16px",
                  backgroundColor: "#F0F9FF",
                  borderRadius: "8px",
                  border: "1px solid #BAE6FD",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      backgroundColor: "#0EA5E9",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    🔒
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#0369A1",
                      fontWeight: "500",
                    }}
                  >
                    Your payment information is encrypted and secure
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
