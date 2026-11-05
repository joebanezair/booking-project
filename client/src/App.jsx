import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage.jsx";
import PlatformContentEditorPage from "./pages/PlatformContentEditorPage.jsx";
import PublicPlatformContentPage from "./pages/PublicPlatformContentPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ContentManagementPage from "./pages/ContentManagementPage.jsx";
import CreateContentPage from "./pages/CreateContentPage.jsx";
import EditContentPage from "./pages/EditContentPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ProfileSettingsPage from "./pages/ProfileSettingsPage.jsx";
import BusinessPage from "./pages/BusinessPage.jsx";
import PublicProfilePage from "./pages/PublicProfilePage.jsx";
import PublicAdminProfilePage from "./pages/PublicAdminProfilePage.jsx";
import PublicContentPage from "./pages/PublicContentPage.jsx";
import PublicBookingPage from "./pages/PublicBookingPage.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import ForumPage from "./pages/ForumPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import BookingDetailPage from "./pages/BookingDetailPage.jsx";
import InviteRegisterPage from "./pages/InviteRegisterPage.jsx";
import BusinessManagementPage from "./pages/BusinessManagementPage.jsx";
import BusinessDetailPage from "./pages/BusinessDetailPage.jsx";
import ReviewPage from "./pages/ReviewPage.jsx";
import SalesPage from "./pages/SalesPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import OnlineOrdersPage from "./pages/OnlineOrdersPage.jsx";
import OrderStatusPage from "./pages/OrderStatusPage.jsx";
import { disconnectRealtime, getRealtimeSocket } from "./realtime.js";
import { hasBusinessFeature } from "./featureAccess.js";
import { api } from "./api.js";

function readUser() {
  try { return JSON.parse(localStorage.getItem("booking_user")); }
  catch { return null; }
}
function readTheme() {
  return localStorage.getItem("booking_theme") === "dark" ? "dark" : "light";
}

export default function App() {
  const [user, setUser] = useState(readUser);
  const [theme, setTheme] = useState(readTheme);
  const [featureClock, setFeatureClock] = useState(() => Date.now());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("booking_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!localStorage.getItem("booking_token")) return;
    api.me().then(current => {
      localStorage.setItem("booking_user", JSON.stringify(current));
      setUser(current);
    }).catch(() => {
      localStorage.removeItem("booking_token");
      localStorage.removeItem("booking_user");
      setUser(null);
    });
  }, []);

  // Keep the sidebar and route guards in sync with admin changes and expiring plans.
  useEffect(() => {
    const tick = setInterval(() => setFeatureClock(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (user?.role !== "business") return;
    let active = true;
    const socket = getRealtimeSocket();
    const onFeatureChange = featureAccess => {
      if (!featureAccess || typeof featureAccess !== "object") return;
      setUser(current => {
        if (!current || current.role !== "business") return current;
        const updated = { ...current, featureAccess };
        localStorage.setItem("booking_user", JSON.stringify(updated));
        return updated;
      });
    };
    const refresh = async () => {
      if (!localStorage.getItem("booking_token")) return;
      try {
        const current = await api.me();
        if (!active) return;
        localStorage.setItem("booking_user", JSON.stringify(current));
        setUser(current);
      } catch (error) {
        if (active && (error.status === 401 || (error.status === 403 && /disabled/i.test(error.message || "")))) {
          setUser(null);
        }
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    socket?.on("features:updated", onFeatureChange);
    socket?.on("connect", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(refresh, 60_000);
    return () => {
      active = false;
      socket?.off("features:updated", onFeatureChange);
      socket?.off("connect", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [user?.id, user?.role]);

  function logout() {
    disconnectRealtime();
    localStorage.removeItem("booking_token");
    localStorage.removeItem("booking_user");
    setUser(null);
  }

  const pageProps = { user, onLogout: logout, onUserUpdate: setUser, theme, onThemeChange: setTheme };
  const protectedPage = Component => user ? <Component {...pageProps} /> : <Navigate to="/login" replace />;
  const businessPage = Component => user ? (user.role === "business" ? <Component {...pageProps} /> : <Navigate to="/dashboard" replace />) : <Navigate to="/login" replace />;
  const servicesPage = Component => user?.role === "business" && hasBusinessFeature(user, "booking", featureClock)
    ? <Component {...pageProps} />
    : <Navigate to={user ? "/dashboard" : "/login"} replace />;
  const productsPage = Component => user?.role === "business" && hasBusinessFeature(user, "pos", featureClock)
    ? <Component {...pageProps} />
    : <Navigate to={user ? "/dashboard" : "/login"} replace />;
  const adminPage = Component => user ? (user.role === "admin" ? <Component {...pageProps} /> : <Navigate to="/dashboard" replace />) : <Navigate to="/login" replace />;

  return <Routes>
    <Route path="/" element={<SearchPage user={user} />} />
    <Route path="/search" element={<SearchPage user={user} />} />
    <Route path="/forum" element={<ForumPage user={user} />} />
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthenticated={setUser} initialMode="login" />} />
    <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthenticated={setUser} initialMode="register" />} />
    <Route path="/register/admin/:inviteKey" element={<InviteRegisterPage user={user} onAuthenticated={setUser} />} />
    <Route path="/terms" element={<PublicPlatformContentPage slug="terms" />} />
    <Route path="/faqs" element={<PublicPlatformContentPage slug="faqs" />} />

    <Route path="/dashboard" element={protectedPage(DashboardPage)} />
    <Route path="/dashboard/services" element={servicesPage(ContentManagementPage)} />
    <Route path="/dashboard/services/new" element={servicesPage(CreateContentPage)} />
    <Route path="/dashboard/services/:contentId/edit" element={servicesPage(EditContentPage)} />
    <Route path="/dashboard/content" element={<Navigate to="/dashboard/services" replace />} />
    <Route path="/dashboard/content/new" element={<Navigate to="/dashboard/services/new" replace />} />
    <Route path="/dashboard/content/:contentId/edit" element={<Navigate to="/dashboard/services" replace />} />

    <Route path="/dashboard/bookings" element={servicesPage(BookingsPage)} />
    <Route path="/dashboard/bookings/:bookingId" element={servicesPage(BookingDetailPage)} />
    <Route path="/dashboard/sales" element={businessPage(SalesPage)} />
    <Route path="/dashboard/products" element={productsPage(ProductsPage)} />
    <Route path="/dashboard/online-orders" element={productsPage(OnlineOrdersPage)} />
    <Route path="/dashboard/messages" element={protectedPage(MessagesPage)} />
    <Route path="/dashboard/messages/:userId" element={protectedPage(MessagesPage)} />
    <Route path="/dashboard/profile" element={protectedPage(ProfilePage)} />
    <Route path="/dashboard/profile/edit" element={protectedPage(ProfileSettingsPage)} />
    <Route path="/dashboard/profile/content" element={adminPage(PlatformContentEditorPage)} />
    <Route path="/dashboard/profile/business" element={businessPage(BusinessPage)} />
    <Route path="/dashboard/notifications" element={protectedPage(NotificationsPage)} />
    <Route path="/dashboard/settings" element={protectedPage(SettingsPage)} />

    <Route path="/dashboard/businesses" element={adminPage(BusinessManagementPage)} />
    <Route path="/dashboard/businesses/:businessId" element={adminPage(BusinessDetailPage)} />
    <Route path="/dashboard/business-requests" element={<Navigate to="/dashboard/businesses" replace />} />

    <Route path="/profile/:username" element={<PublicProfilePage user={user} />} />
    <Route path="/admin/:username" element={<PublicAdminProfilePage user={user} />} />
    <Route path="/content/:contentId" element={<PublicContentPage user={user} />} />
    <Route path="/services/:contentId" element={<PublicContentPage user={user} />} />
    <Route path="/b/:userId" element={<PublicBookingPage user={user} />} />
    <Route path="/review/:token" element={<ReviewPage />} />
    <Route path="/order-status/:orderId" element={<OrderStatusPage />} />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
