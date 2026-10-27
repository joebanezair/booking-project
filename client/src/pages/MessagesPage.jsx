import AppLayout from "../components/AppLayout.jsx";
import Messages from "../components/Messages.jsx";
import { useParams } from "react-router-dom";

export default function MessagesPage({ user, onLogout }) {
  const { userId } = useParams();
  return <AppLayout user={user} onLogout={onLogout}>
    <div className="messages-page-refine">
    <header className="topbar messages-topbar">
      <h1>Messages</h1>
    </header>
    <Messages currentUser={user} initialUserId={userId} />
    </div>
  </AppLayout>;
}
