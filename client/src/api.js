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
  if (response.status === 401) {
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
  register: body => request("/auth/register", { method:"POST", body:JSON.stringify(body) }),
  login: body => request("/auth/login", { method:"POST", body:JSON.stringify(body) }),
  profile: {
    get: () => request("/profile"),
    update: body => request("/profile", { method:"PUT", body:JSON.stringify(body) })
  },
  content: {
    list: () => request("/content"),
    get: id => request(`/content/${id}`),
    create: body => request("/content", { method:"POST", body:JSON.stringify(body) }),
    update: (id,body) => request(`/content/${id}`, { method:"PUT", body:JSON.stringify(body) }),
    publish: (id,published) => request(`/content/${id}/publish`, { method:"PATCH", body:JSON.stringify({published}) }),
    remove: id => request(`/content/${id}`, { method:"DELETE" })
  },
  ratings: {
    set: (contentId,rating) => request(`/ratings/${contentId}`, { method:"PUT", body:JSON.stringify({rating}) }),
    remove: contentId => request(`/ratings/${contentId}`, { method:"DELETE" })
  },
  comments: {
    add: (contentId,comment) => request(`/comments/${contentId}`, { method:"POST", body:JSON.stringify({comment}) }),
    update: (commentId,comment) => request(`/comments/${commentId}`, { method:"PUT", body:JSON.stringify({comment}) }),
    remove: commentId => request(`/comments/${commentId}`, { method:"DELETE" })
  },
  bookings: {
    list: () => request("/bookings"),
    create: body => request("/bookings", { method:"POST", body:JSON.stringify(body) }),
    update: (id,body) => request(`/bookings/${id}`, { method:"PUT", body:JSON.stringify(body) }),
    remove: id => request(`/bookings/${id}`, { method:"DELETE" })
  },
  messages: {
    users: () => request("/messages/users"),
    conversation: userId => request(`/messages/${userId}`),
    send: (userId,body) => request(`/messages/${userId}`, { method:"POST", body:JSON.stringify({body}) })
  },
  publicBooking: {
    get: userId => request(`/public/book/${userId}`),
    create: (userId,body) => request(`/public/book/${userId}`, { method:"POST", body:JSON.stringify(body) })
  },
  publicProfile: username => request(`/public/profile/${username}`),
  publicContent: id => request(`/public/content/${id}`),
  browse: () => request("/public/browse")
};
