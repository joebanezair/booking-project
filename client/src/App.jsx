import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage.jsx";
import BrowsePage from "./pages/BrowsePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import CreateContentPage from "./pages/CreateContentPage.jsx";
import EditContentPage from "./pages/EditContentPage.jsx";
import ProfileSettingsPage from "./pages/ProfileSettingsPage.jsx";
import PublicProfilePage from "./pages/PublicProfilePage.jsx";
import PublicContentPage from "./pages/PublicContentPage.jsx";
import PublicBookingPage from "./pages/PublicBookingPage.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import { disconnectRealtime } from "./realtime.js";

function readUser(){try{return JSON.parse(localStorage.getItem("booking_user"));}catch{return null;}}

export default function App(){
  const [user,setUser]=useState(readUser);
  function logout(){disconnectRealtime();localStorage.removeItem("booking_token");localStorage.removeItem("booking_user");setUser(null);}
  const protectedPage = Component => user ? <Component user={user} onLogout={logout} onUserUpdate={setUser}/> : <Navigate to="/login" replace/>;

  return <Routes>
    <Route path="/" element={<BrowsePage user={user}/>}/>
    <Route path="/login" element={user?<Navigate to="/dashboard" replace/>:<AuthPage onAuthenticated={setUser}/>}/>
    <Route path="/dashboard" element={protectedPage(DashboardPage)}/>
    <Route path="/dashboard/bookings" element={protectedPage(BookingsPage)}/>
    <Route path="/dashboard/messages" element={protectedPage(MessagesPage)}/>
    <Route path="/dashboard/content/new" element={protectedPage(CreateContentPage)}/>
    <Route path="/dashboard/content/:contentId/edit" element={protectedPage(EditContentPage)}/>
    <Route path="/dashboard/profile" element={protectedPage(ProfileSettingsPage)}/>
    <Route path="/profile/:username" element={<PublicProfilePage/>}/>
    <Route path="/content/:contentId" element={<PublicContentPage user={user}/>}/>
    <Route path="/b/:userId" element={<PublicBookingPage/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
