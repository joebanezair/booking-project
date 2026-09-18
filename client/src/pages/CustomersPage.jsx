import { useEffect, useState } from "react";
import { FiCalendar, FiMail, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { api } from "../api.js";

export default function CustomersPage({ user, onLogout }) {
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api.admin.customers().then(setCustomers).catch(e => setError(e.message)); }, []);
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">ADMIN</p><h1>Customers</h1><p className="muted">Registered customers and their booking activity.</p></div></header>
    {error && <p className="error">{error}</p>}
    <section className="panel customer-list">{customers.length === 0 ? <div className="empty-state"><FiUsers className="empty-icon" /><p className="muted">No registered customers yet.</p></div> : customers.map(customer => <article className="customer-row" key={customer._id}><ProfileAvatar profile={customer} size="lg" /><div><h2>{customer.name}</h2><strong>@{customer.username}</strong><p><FiMail aria-hidden="true" />{customer.email}</p></div><span className="customer-booking-count"><FiCalendar aria-hidden="true" />{customer.bookingCount} booking{customer.bookingCount === 1 ? "" : "s"}</span></article>)}</section>
  </AppLayout>;
}
