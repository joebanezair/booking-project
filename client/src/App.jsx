import { useEffect,useState } from "react";
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
import CustomersPage from "./pages/CustomersPage.jsx";
import { disconnectRealtime } from "./realtime.js";
import { api } from "./api.js";
import InviteRegisterPage from "./pages/InviteRegisterPage.jsx";
import BusinessRequestsPage from "./pages/BusinessRequestsPage.jsx";

function readUser(){try{return JSON.parse(localStorage.getItem("booking_user"));}catch{return null;}}
function readTheme(){return localStorage.getItem("booking_theme")==="dark"?"dark":"light";}
function readAccountMode(){return localStorage.getItem("booking_account_mode")==="business"?"business":"personal";}

export default function App(){
  const [user,setUser]=useState(readUser);
  const [theme,setTheme]=useState(readTheme);
  const [accountMode,setAccountMode]=useState(readAccountMode);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("booking_theme",theme);},[theme]);
  useEffect(()=>{if(!localStorage.getItem("booking_token"))return;api.me().then(current=>{localStorage.setItem("booking_user",JSON.stringify(current));setUser(current);}).catch(()=>setUser(null));},[]);
  function logout(){disconnectRealtime();localStorage.removeItem("booking_token");localStorage.removeItem("booking_user");localStorage.removeItem("booking_account_mode");setUser(null);}
  function changeAccountMode(mode){localStorage.setItem("booking_account_mode",mode);setAccountMode(mode);}
  const pageProps={user,onLogout:logout,onUserUpdate:setUser,theme,onThemeChange:setTheme,accountMode,onAccountModeChange:changeAccountMode};
  const protectedPage = Component => user ? <Component {...pageProps}/> : <Navigate to="/login" replace/>;
  const adminPage = Component => user ? (user.role === "admin" ? <Component {...pageProps}/> : <Navigate to="/dashboard" replace/>) : <Navigate to="/login" replace/>;
  const providerPage = Component => user ? ((["admin", "business"].includes(user.role)||(user.business?.status==="approved"&&accountMode==="business")) ? <Component {...pageProps}/> : <Navigate to="/dashboard" replace/>) : <Navigate to="/login" replace/>;

  return <Routes>
    <Route path="/" element={<SearchPage user={user}/>}/>
    <Route path="/search" element={<SearchPage user={user}/>}/>
    <Route path="/forum" element={<ForumPage user={user}/>}/>
    <Route path="/login" element={user?<Navigate to="/dashboard" replace/>:<AuthPage onAuthenticated={setUser}/>}/>
    <Route path="/register/:role/:inviteKey" element={<InviteRegisterPage user={user} onAuthenticated={setUser}/>}/>
    <Route path="/dashboard" element={protectedPage(DashboardPage)}/>
    <Route path="/dashboard/content" element={providerPage(ContentManagementPage)}/>
    <Route path="/dashboard/services" element={providerPage(ContentManagementPage)}/>
    <Route path="/dashboard/bookings" element={protectedPage(BookingsPage)}/>
    <Route path="/dashboard/bookings/:bookingId" element={protectedPage(BookingDetailPage)}/>
    <Route path="/dashboard/messages" element={protectedPage(MessagesPage)}/>
    <Route path="/dashboard/messages/:userId" element={protectedPage(MessagesPage)}/>
    <Route path="/dashboard/content/new" element={providerPage(CreateContentPage)}/>
    <Route path="/dashboard/services/new" element={providerPage(CreateContentPage)}/>
    <Route path="/dashboard/content/:contentId/edit" element={providerPage(EditContentPage)}/>
    <Route path="/dashboard/services/:contentId/edit" element={providerPage(EditContentPage)}/>
    <Route path="/dashboard/customers" element={adminPage(CustomersPage)}/>
    <Route path="/dashboard/business-requests" element={adminPage(BusinessRequestsPage)}/>
    <Route path="/dashboard/profile" element={protectedPage(ProfileSettingsPage)}/>
    <Route path="/dashboard/notifications" element={protectedPage(NotificationsPage)}/>
    <Route path="/dashboard/settings" element={protectedPage(SettingsPage)}/>
    <Route path="/profile/:username" element={<PublicProfilePage user={user}/>}/>
    <Route path="/content/:contentId" element={<PublicContentPage user={user}/>}/>
    <Route path="/services/:contentId" element={<PublicContentPage user={user}/>}/>
    <Route path="/b/:userId" element={<PublicBookingPage user={user}/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
