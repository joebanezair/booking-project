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

function readUser(){try{return JSON.parse(localStorage.getItem("booking_user"));}catch{return null;}}
function readTheme(){return localStorage.getItem("booking_theme")==="dark"?"dark":"light";}

export default function App(){
  const [user,setUser]=useState(readUser);
  const [theme,setTheme]=useState(readTheme);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("booking_theme",theme);},[theme]);
  useEffect(()=>{if(!localStorage.getItem("booking_token"))return;api.me().then(current=>{localStorage.setItem("booking_user",JSON.stringify(current));setUser(current);}).catch(()=>setUser(null));},[]);
  function logout(){disconnectRealtime();localStorage.removeItem("booking_token");localStorage.removeItem("booking_user");setUser(null);}
  const protectedPage = Component => user ? <Component user={user} onLogout={logout} onUserUpdate={setUser} theme={theme} onThemeChange={setTheme}/> : <Navigate to="/login" replace/>;
  const adminPage = Component => user ? (user.role === "admin" ? <Component user={user} onLogout={logout} onUserUpdate={setUser} theme={theme} onThemeChange={setTheme}/> : <Navigate to="/dashboard" replace/>) : <Navigate to="/login" replace/>;

  return <Routes>
    <Route path="/" element={<SearchPage user={user}/>}/>
    <Route path="/search" element={<SearchPage user={user}/>}/>
    <Route path="/forum" element={<ForumPage user={user}/>}/>
    <Route path="/login" element={user?<Navigate to="/dashboard" replace/>:<AuthPage onAuthenticated={setUser}/>}/>
    <Route path="/dashboard" element={protectedPage(DashboardPage)}/>
    <Route path="/dashboard/content" element={adminPage(ContentManagementPage)}/>
    <Route path="/dashboard/services" element={adminPage(ContentManagementPage)}/>
    <Route path="/dashboard/bookings" element={protectedPage(BookingsPage)}/>
    <Route path="/dashboard/bookings/:bookingId" element={protectedPage(BookingDetailPage)}/>
    <Route path="/dashboard/messages" element={protectedPage(MessagesPage)}/>
    <Route path="/dashboard/messages/:userId" element={protectedPage(MessagesPage)}/>
    <Route path="/dashboard/content/new" element={adminPage(CreateContentPage)}/>
    <Route path="/dashboard/services/new" element={adminPage(CreateContentPage)}/>
    <Route path="/dashboard/content/:contentId/edit" element={adminPage(EditContentPage)}/>
    <Route path="/dashboard/services/:contentId/edit" element={adminPage(EditContentPage)}/>
    <Route path="/dashboard/customers" element={adminPage(CustomersPage)}/>
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
