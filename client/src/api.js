const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("booking_token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || (response.status === 403 && /disabled/i.test(data.message || ""))) {
    localStorage.removeItem("booking_token");
    localStorage.removeItem("booking_user");
  }
  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  register: body => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  inviteAdmin: (inviteKey, body) => request(`/auth/register/admin/${encodeURIComponent(inviteKey)}`, { method: "POST", body: JSON.stringify(body) }),
  login: body => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),

  profile: {
    get: () => request("/profile"),
    update: body => request("/profile", { method: "PUT", body: JSON.stringify(body) })
  },
  business: {
    mine: () => request("/businesses/mine"),
    update: body => request("/businesses/mine", { method: "PUT", body: JSON.stringify(body) })
  },
  content: {
    list: () => request("/content"),
    get: id => request(`/content/${id}`),
    create: body => request("/content", { method: "POST", body: JSON.stringify(body) }),
    update: (id, body) => request(`/content/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    publish: (id, published) => request(`/content/${id}/publish`, { method: "PATCH", body: JSON.stringify({ published }) }),
    remove: id => request(`/content/${id}`, { method: "DELETE" })
  },
  ratings: {
    set: (contentId, rating) => request(`/ratings/${contentId}`, { method: "PUT", body: JSON.stringify({ rating }) }),
    remove: contentId => request(`/ratings/${contentId}`, { method: "DELETE" })
  },
  comments: {
    add: (contentId, comment, parentId = null) => request(`/comments/${contentId}`, { method: "POST", body: JSON.stringify({ comment, parentId }) }),
    update: (commentId, comment) => request(`/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ comment }) }),
    remove: commentId => request(`/comments/${commentId}`, { method: "DELETE" })
  },
  reactions: {
    toggle: (contentId, type) => request(`/reactions/${contentId}`, { method: "PUT", body: JSON.stringify({ type }) })
  },
  emojiReactions: {
    toggle: (targetType, targetId, emoji) => request(`/emoji-reactions/${targetType}/${targetId}`, { method: "PUT", body: JSON.stringify({ emoji }) })
  },
  notifications: {
    list: () => request("/notifications"),
    read: id => request(`/notifications/${id}/read`, { method: "PATCH" }),
    readAll: () => request("/notifications/read-all", { method: "PATCH" })
  },
  forum: {
    list: (page = 1) => request(`/forum?page=${page}`),
    create: body => request("/forum", { method: "POST", body: JSON.stringify(body) }),
    reply: (id, body) => request(`/forum/${id}/replies`, { method: "POST", body: JSON.stringify({ body }) })
  },
  bookings: {
    list: () => request("/bookings"),
    get: id => request(`/bookings/${id}`),
    create: body => request("/bookings", { method: "POST", body: JSON.stringify(body) }),
    update: (id, body) => request(`/bookings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    setStatus: (id, status) => request(`/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    remove: id => request(`/bookings/${id}`, { method: "DELETE" })
  },
  sales: {
    analytics: params => request(`/sales/analytics?${new URLSearchParams(params)}`)
  },
  admin: {
    overview: () => request("/admin/overview"),
    businesses: () => request("/admin/businesses"),
    business: id => request(`/admin/businesses/${id}`),
    setBusinessStatus: (id, accountStatus) => request(`/admin/businesses/${id}/status`, { method: "PATCH", body: JSON.stringify({ accountStatus }) })
  },
  messages: {
    users: () => request("/messages/users"),
    conversation: userId => request(`/messages/${userId}`),
    send: (userId, body) => request(`/messages/${userId}`, { method: "POST", body: JSON.stringify({ body }) })
  },
  publicBooking: {
    get: userId => request(`/public/book/${userId}`),
    create: (userId, body) => request(`/public/book/${userId}`, { method: "POST", body: JSON.stringify(body) })
  },
  reviews: {
    get: token => request(`/public/reviews/${encodeURIComponent(token)}`),
    submit: (token, body) => request(`/public/reviews/${encodeURIComponent(token)}`, { method: "PUT", body: JSON.stringify(body) })
  },
  publicProfile: username => request(`/public/profile/${username}`),
  publicContent: id => request(`/public/content/${id}`),
  browse: () => request("/public/browse"),
  search: params => request(`/public/search?${new URLSearchParams(params)}`)
};
