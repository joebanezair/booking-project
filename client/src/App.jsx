import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ContentManagementPage from "./pages/ContentManagementPage.jsx";
import CreateContentPage from "./pages/CreateContentPage.jsx";
import EditContentPage from "./pages/EditContentPage.jsx";
import ProfileSettingsPage from "./pages/ProfileSettingsPage.jsx";
import PublicProfilePage from "./pages/PublicProfilePage.jsx";
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
import { disconnectRealtime } from "./realtime.js";
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

  function logout() {
    disconnectRealtime();
    localStorage.removeItem("booking_token");
    localStorage.removeItem("booking_user");
    setUser(null);
  }

  const pageProps = { user, onLogout: logout, onUserUpdate: setUser, theme, onThemeChange: setTheme };
  const protectedPage = Component => user ? <Component {...pageProps} /> : <Navigate to="/login" replace />;
  const businessPage = Component => user ? (user.role === "business" ? <Component {...pageProps} /> : <Navigate to="/dashboard" replace />) : <Navigate to="/login" replace />;
  const adminPage = Component => user ? (user.role === "admin" ? <Component {...pageProps} /> : <Navigate to="/dashboard" replace />) : <Navigate to="/login" replace />;

  return <Routes>
    <Route path="/" element={<SearchPage user={user} />} />
    <Route path="/search" element={<SearchPage user={user} />} />
    <Route path="/forum" element={<ForumPage user={user} />} />
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthenticated={setUser} initialMode="login" />} />
    <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthenticated={setUser} initialMode="register" />} />
    <Route path="/register/admin/:inviteKey" element={<InviteRegisterPage user={user} onAuthenticated={setUser} />} />

    <Route path="/dashboard" element={protectedPage(DashboardPage)} />
    <Route path="/dashboard/services" element={businessPage(ContentManagementPage)} />
    <Route path="/dashboard/services/new" element={businessPage(CreateContentPage)} />
    <Route path="/dashboard/services/:contentId/edit" element={businessPage(EditContentPage)} />
    <Route path="/dashboard/content" element={<Navigate to="/dashboard/services" replace />} />
    <Route path="/dashboard/content/new" element={<Navigate to="/dashboard/services/new" replace />} />
    <Route path="/dashboard/content/:contentId/edit" element={<Navigate to="/dashboard/services" replace />} />

    <Route path="/dashboard/bookings" element={businessPage(BookingsPage)} />
    <Route path="/dashboard/bookings/:bookingId" element={businessPage(BookingDetailPage)} />
    <Route path="/dashboard/sales" element={businessPage(SalesPage)} />
    <Route path="/dashboard/messages" element={protectedPage(MessagesPage)} />
    <Route path="/dashboard/messages/:userId" element={protectedPage(MessagesPage)} />
    <Route path="/dashboard/profile" element={businessPage(ProfileSettingsPage)} />
    <Route path="/dashboard/notifications" element={protectedPage(NotificationsPage)} />
    <Route path="/dashboard/settings" element={protectedPage(SettingsPage)} />

    <Route path="/dashboard/businesses" element={adminPage(BusinessManagementPage)} />
    <Route path="/dashboard/businesses/:businessId" element={adminPage(BusinessDetailPage)} />
    <Route path="/dashboard/customers" element={<Navigate to="/dashboard/businesses" replace />} />
    <Route path="/dashboard/business-requests" element={<Navigate to="/dashboard/businesses" replace />} />

    <Route path="/profile/:username" element={<PublicProfilePage user={user} />} />
    <Route path="/content/:contentId" element={<PublicContentPage user={user} />} />
    <Route path="/services/:contentId" element={<PublicContentPage user={user} />} />
    <Route path="/b/:userId" element={<PublicBookingPage user={user} />} />
    <Route path="/review/:token" element={<ReviewPage />} />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
