"use client";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, fullName);
      }
      onClose();
      setEmail("");
      setPassword("");
      setFullName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "#171C23",
          borderRadius: "16px",
          padding: "32px",
          width: "400px",
          maxWidth: "90vw",
          border: "1px solid #242B35",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              color: "#E6E8EB",
              fontSize: "20px",
              fontWeight: "600",
              margin: 0,
            }}
          >
            {mode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9BA3AF",
              fontSize: "24px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#C7CDD6",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#0E1115",
                  border: "1px solid #242B35",
                  borderRadius: "8px",
                  color: "#E6E8EB",
                  fontSize: "14px",
                }}
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                color: "#C7CDD6",
                fontSize: "14px",
                fontWeight: "500",
                marginBottom: "8px",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#0E1115",
                border: "1px solid #242B35",
                borderRadius: "8px",
                color: "#E6E8EB",
                fontSize: "14px",
              }}
              placeholder="Enter your email"
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                color: "#C7CDD6",
                fontSize: "14px",
                fontWeight: "500",
                marginBottom: "8px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#0E1115",
                border: "1px solid #242B35",
                borderRadius: "8px",
                color: "#E6E8EB",
                fontSize: "14px",
              }}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
                color: "#FCA5A5",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: loading ? "#9CA3AF" : "#8B5CF6",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading
              ? "Loading..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
            color: "#9BA3AF",
            fontSize: "14px",
          }}
        >
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => window.location.reload()} // Simple way to switch modes
                style={{
                  background: "none",
                  border: "none",
                  color: "#8B5CF6",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => window.location.reload()} // Simple way to switch modes
                style={{
                  background: "none",
                  border: "none",
                  color: "#8B5CF6",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}






