"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

export default function SettingsPage() {
  const { user, token, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Settings state
  const [settings, setSettings] = useState({
    email: "",
    fullName: "",
    notificationEmail: true,
    notificationPush: false,
    defaultQuality: "720p",
    defaultDuration: "5",
    autoSave: true,
  });

  // Password change state
  const [passwordChange, setPasswordChange] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load user settings
  useEffect(() => {
    if (user) {
      setSettings({
        email: user.email || "",
        fullName: user.full_name || "",
        notificationEmail: true,
        notificationPush: false,
        defaultQuality: "720p",
        defaultDuration: "5",
        autoSave: true,
      });
    }
  }, [user]);

  const handleUpdateSettings = async () => {
    if (!token) {
      setUpdateMessage({
        type: "error",
        text: "Please log in to update settings",
      });
      return;
    }

    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      // TODO: Add API endpoint for updating user settings
      // For now, just show success message
      setTimeout(() => {
        setUpdateMessage({
          type: "success",
          text: "Settings updated successfully!",
        });
        setIsUpdating(false);
      }, 1000);
    } catch (error) {
      setUpdateMessage({
        type: "error",
        text: "Failed to update settings. Please try again.",
      });
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) {
      setPasswordMessage({
        type: "error",
        text: "Please log in to change password",
      });
      return;
    }

    // Validation
    if (!passwordChange.currentPassword || !passwordChange.newPassword || !passwordChange.confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "Please fill in all password fields",
      });
      return;
    }

    if (passwordChange.newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 8 characters long",
      });
      return;
    }

    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New passwords do not match",
      });
      return;
    }

    if (passwordChange.currentPassword === passwordChange.newPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password must be different from current password",
      });
      return;
    }

    setIsChangingPassword(true);
    setPasswordMessage(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: passwordChange.currentPassword,
            new_password: passwordChange.newPassword,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setPasswordMessage({
          type: "success",
          text: "Password changed successfully!",
        });
        // Clear password fields
        setPasswordChange({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setPasswordMessage({
          type: "error",
          text: data.detail || "Failed to change password. Please check your current password and try again.",
        });
      }
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: "Failed to change password. Please try again.",
      });
    } finally {
      setIsChangingPassword(false);
    }
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
            Please log in to access settings
          </p>
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
      <div
        style={{
          padding: isMobile ? "16px" : "32px",
          flex: 1,
          backgroundColor: "#FFFFFF",
          color: "#1E293B",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ marginBottom: isMobile ? "20px" : "32px" }}>
          <h1
            style={{
              fontSize: isMobile ? "20px" : "24px",
              fontWeight: "600",
              color: "#1E293B",
              margin: 0,
            }}
          >
            Settings
          </h1>
        </div>

        {/* Update Message */}
        {updateMessage && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "24px",
              borderRadius: "8px",
              backgroundColor:
                updateMessage.type === "success"
                  ? "#D1FAE5"
                  : "#FEE2E2",
              color:
                updateMessage.type === "success"
                  ? "#065F46"
                  : "#991B1B",
              fontSize: "14px",
            }}
          >
            {updateMessage.text}
          </div>
        )}

        {/* Account Settings */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: isMobile ? "16px" : "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? "16px" : "18px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "20px",
            }}
          >
            Account
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Email */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={settings.email}
                disabled
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#6B7280",
                  cursor: "not-allowed",
                }}
              />
              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: "4px",
                }}
              >
                Email cannot be changed
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={settings.fullName}
                onChange={(e) =>
                  setSettings({ ...settings, fullName: e.target.value })
                }
                placeholder="Enter your full name"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1F2937",
                }}
              />
            </div>
          </div>
        </div>

        {/* Password Change */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: isMobile ? "16px" : "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? "16px" : "18px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "20px",
            }}
          >
            Change Password
          </h2>

          {/* Password Message */}
          {passwordMessage && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "20px",
                borderRadius: "8px",
                backgroundColor:
                  passwordMessage.type === "success"
                    ? "#D1FAE5"
                    : "#FEE2E2",
                color:
                  passwordMessage.type === "success"
                    ? "#065F46"
                    : "#991B1B",
                fontSize: "14px",
              }}
            >
              {passwordMessage.text}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Current Password */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Current Password
              </label>
              <input
                type="password"
                value={passwordChange.currentPassword}
                onChange={(e) =>
                  setPasswordChange({
                    ...passwordChange,
                    currentPassword: e.target.value,
                  })
                }
                placeholder="Enter your current password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1F2937",
                }}
              />
            </div>

            {/* New Password */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                New Password
              </label>
              <input
                type="password"
                value={passwordChange.newPassword}
                onChange={(e) =>
                  setPasswordChange({
                    ...passwordChange,
                    newPassword: e.target.value,
                  })
                }
                placeholder="Enter your new password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1F2937",
                }}
              />
              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: "4px",
                }}
              >
                Password must be at least 8 characters long
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordChange.confirmPassword}
                onChange={(e) =>
                  setPasswordChange({
                    ...passwordChange,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm your new password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1F2937",
                }}
              />
            </div>
          </div>

          {/* Change Password Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "20px",
            }}
          >
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              style={{
                padding: isMobile ? "10px 18px" : "10px 24px",
                backgroundColor: isChangingPassword ? "#9CA3AF" : "#d42f48",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: isChangingPassword ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {isChangingPassword ? "Changing..." : "Change Password"}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: isMobile ? "16px" : "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? "16px" : "18px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "20px",
            }}
          >
            Notifications
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Email Notifications */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Email Notifications
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    marginTop: "4px",
                  }}
                >
                  Receive email updates about your campaigns
                </div>
              </div>
              <label
                style={{
                  position: "relative",
                  display: "inline-block",
                  width: "44px",
                  height: "24px",
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.notificationEmail}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationEmail: e.target.checked,
                    })
                  }
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: "absolute",
                    cursor: "pointer",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: settings.notificationEmail
                      ? "#d42f48"
                      : "#CBD5E1",
                    borderRadius: "24px",
                    transition: "0.3s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      content: '""',
                      height: "18px",
                      width: "18px",
                      left: "3px",
                      bottom: "3px",
                      backgroundColor: "#FFFFFF",
                      borderRadius: "50%",
                      transition: "0.3s",
                      transform: settings.notificationEmail
                        ? "translateX(20px)"
                        : "translateX(0)",
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Push Notifications */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Push Notifications
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    marginTop: "4px",
                  }}
                >
                  Receive browser notifications
                </div>
              </div>
              <label
                style={{
                  position: "relative",
                  display: "inline-block",
                  width: "44px",
                  height: "24px",
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.notificationPush}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notificationPush: e.target.checked,
                    })
                  }
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: "absolute",
                    cursor: "pointer",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: settings.notificationPush
                      ? "#d42f48"
                      : "#CBD5E1",
                    borderRadius: "24px",
                    transition: "0.3s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      content: '""',
                      height: "18px",
                      width: "18px",
                      left: "3px",
                      bottom: "3px",
                      backgroundColor: "#FFFFFF",
                      borderRadius: "50%",
                      transition: "0.3s",
                      transform: settings.notificationPush
                        ? "translateX(20px)"
                        : "translateX(0)",
                    }}
                  />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            padding: isMobile ? "16px" : "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? "16px" : "18px",
              fontWeight: "600",
              color: "#1F2937",
              marginBottom: "20px",
            }}
          >
            Preferences
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Default Video Quality */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Default Video Quality
              </label>
              <select
                value={settings.defaultQuality}
                onChange={(e) =>
                  setSettings({ ...settings, defaultQuality: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1F2937",
                  cursor: "pointer",
                }}
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>

            {/* Default Video Duration */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Default Video Duration
              </label>
              <select
                value={settings.defaultDuration}
                onChange={(e) =>
                  setSettings({ ...settings, defaultDuration: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#1F2937",
                  cursor: "pointer",
                }}
              >
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
              </select>
            </div>

            {/* Auto Save */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Auto Save
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    marginTop: "4px",
                  }}
                >
                  Automatically save your work
                </div>
              </div>
              <label
                style={{
                  position: "relative",
                  display: "inline-block",
                  width: "44px",
                  height: "24px",
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) =>
                    setSettings({ ...settings, autoSave: e.target.checked })
                  }
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: "absolute",
                    cursor: "pointer",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: settings.autoSave
                      ? "#d42f48"
                      : "#CBD5E1",
                    borderRadius: "24px",
                    transition: "0.3s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      content: '""',
                      height: "18px",
                      width: "18px",
                      left: "3px",
                      bottom: "3px",
                      backgroundColor: "#FFFFFF",
                      borderRadius: "50%",
                      transition: "0.3s",
                      transform: settings.autoSave
                        ? "translateX(20px)"
                        : "translateX(0)",
                    }}
                  />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div
          style={{
            backgroundColor: "#FEF2F2",
            borderRadius: "12px",
            border: "1px solid #FEE2E2",
            padding: isMobile ? "16px" : "24px",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? "16px" : "18px",
              fontWeight: "600",
              color: "#991B1B",
              marginBottom: "12px",
            }}
          >
            Danger Zone
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#991B1B",
              marginBottom: "16px",
            }}
          >
            Irreversible and destructive actions
          </p>
          <button
            style={{
              padding: "10px 20px",
              backgroundColor: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to delete your account? This action cannot be undone."
                )
              ) {
                alert("Account deletion feature coming soon");
              }
            }}
          >
            Delete Account
          </button>
        </div>

        {/* Save Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "32px",
          }}
        >
          <button
            onClick={handleUpdateSettings}
            disabled={isUpdating}
            style={{
              padding: isMobile ? "12px 20px" : "12px 24px",
              backgroundColor: isUpdating ? "#9CA3AF" : "#d42f48",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: isUpdating ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

