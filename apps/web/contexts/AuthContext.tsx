"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  credits: number;
  subscription_type?: string | null;
  subscription_credits?: number;
  subscription_status?: string;
  subscription_expires_at?: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [initialCheck, setInitialCheck] = useState(true); // Track initial auth check

  // Check for existing token on mount and fetch user info
  useEffect(() => {
    console.log("🔍 Checking for saved token...");
    const savedToken = localStorage.getItem("aura_token");
    if (savedToken) {
      console.log("🔑 Found saved token, verifying...");
      setToken(savedToken);
      fetchUserInfo(savedToken);
    } else {
      console.log("❌ No saved token found");
      setLoading(false);
      setInitialCheck(false);
    }
  }, []);

  const fetchUserInfo = async (authToken: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        console.log("✅ User authenticated:", userData.email);
      } else {
        // Token is invalid, remove it
        console.log("❌ Token invalid, removing from storage");
        localStorage.removeItem("aura_token");
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error("❌ Failed to fetch user info:", error);
      localStorage.removeItem("aura_token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
      setInitialCheck(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log("🔐 Attempting login for:", email);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Login failed:", errorData);
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await response.json();
      console.log("✅ Login successful, storing token");
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("aura_token", data.access_token);
      console.log("✅ User state updated:", data.user.email);
    } catch (error) {
      console.error("❌ Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName?: string
  ) => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName || "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Registration failed");
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("aura_token", data.access_token);
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("aura_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
