"use client";
import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Initialize Stripe
const stripePromise = loadStripe(
  "pk_test_51SIbQ9P94ZYHDynVP4Ys1thiP9nFKuL0i2hRRT8s6Xa9rfCQ6q5AC7mS9d2QcN5aRPAerP6o3IyaDpeKew7e9Hyc00ESugEmqg"
);

interface PaymentFormProps {
  amount: number;
  credits: number;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  token: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  credits,
  onSuccess,
  onError,
  token,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/payments/create-intent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount: amount * 100 }), // Convert to cents
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create payment intent");
      }

      const { client_secret } = await response.json();

      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      );

      if (error) {
        onError(error.message || "Payment failed");
      } else if (paymentIntent.status === "succeeded") {
        // Confirm payment on backend
        const confirmResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              payment_intent_id: paymentIntent.id,
            }),
          }
        );

        if (confirmResponse.ok) {
          const result = await confirmResponse.json();
          onSuccess(result);
        } else {
          throw new Error("Failed to confirm payment");
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#1F2937",
        fontFamily: "system-ui, -apple-system, sans-serif",
        "::placeholder": {
          color: "#9CA3AF",
        },
        padding: "12px",
      },
      invalid: {
        color: "#DC2626",
        iconColor: "#DC2626",
      },
      complete: {
        color: "#059669",
        iconColor: "#059669",
      },
    },
    hidePostalCode: false,
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "600",
            color: "#374151",
            marginBottom: "8px",
          }}
        >
          Card Information
        </label>
        <div
          style={{
            border: "2px solid #E5E7EB",
            borderRadius: "8px",
            padding: "16px",
            backgroundColor: "#FFFFFF",
            transition: "border-color 0.2s ease",
          }}
        >
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          style={{
            width: "100%",
            backgroundColor: isProcessing ? "#9CA3AF" : "#3B82F6",
            color: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            border: "none",
            cursor: isProcessing ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
          onMouseEnter={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.backgroundColor = "#2563EB";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.backgroundColor = "#3B82F6";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
            }
          }}
        >
          {isProcessing ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #ffffff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Processing Payment...
            </div>
          ) : (
            `Pay $${(amount / 100).toFixed(2)} for ${credits} credits`
          )}
        </button>
      </div>

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
    </form>
  );
};

interface StripePaymentFormProps {
  amount: number;
  credits: number;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  token: string;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  );
};

export default StripePaymentForm;
