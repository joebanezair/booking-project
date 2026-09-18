import AppLayout from "../components/AppLayout.jsx";
import Messages from "../components/Messages.jsx";
import { useParams } from "react-router-dom";

export default function MessagesPage({ user, onLogout }) {
  const { userId } = useParams();
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">INBOX</p><h1>Messages</h1><p className="muted">Chat with registered users with instant delivery.</p></div>
      <span className="live-indicator"><i /> Live</span>
    </header>
    <Messages currentUser={user} initialUserId={userId} />
  </AppLayout>;
}
