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

// Use binary transfer with a configured GridFS server, and preserve existing
// Base64 forms in local development when the optional media DB is not enabled.
let mediaCapabilities;
async function binaryUploadsAvailable() {
  if (!mediaCapabilities) mediaCapabilities = request("/media/capabilities")
    .then(result => Boolean(result.binaryUploads))
    .catch(error => { mediaCapabilities = null; throw error; });
  return mediaCapabilities;
}

// Image previews remain unchanged; upload bytes are resized for network efficiency.
// Animated GIF and unsupported browsers retain the original file.
async function optimizeImageForUpload(bytes, mime) {
  if (!/^image\/(jpeg|png|webp)$/.test(mime) || typeof createImageBitmap !== "function" ||
      typeof document === "undefined") return { bytes, mime };
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (ratio === 1 && mime === "image/webp") return { bytes, mime };
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return { bytes, mime };
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.88));
    if (webp?.type === "image/webp" && webp.size < bytes.byteLength) {
      return { bytes: new Uint8Array(await webp.arrayBuffer()), mime: "image/webp" };
    }
  } catch {
    // Unsupported decoding/encoding falls back to the original safe upload path.
  } finally {
    bitmap?.close?.();
  }
  return { bytes, mime };
}

async function maybeUploadMedia(value, visibility = "public") {
  if (typeof value !== "string" || !value.startsWith("data:")) return value;
  if (!await binaryUploadsAvailable()) return value;
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Invalid image or attachment format.");
  const approximateSize = Math.floor(match[2].length * 3 / 4);
  if (approximateSize > (visibility === "private" ? 5 : 2) * 1024 * 1024 + 2)
    throw new Error("File is too large to upload.");
  const decoded = atob(match[2]);
  let bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  let mime = match[1].toLowerCase();
  if (visibility === "public") ({ bytes, mime } = await optimizeImageForUpload(bytes, mime));
  const saved = await request("/media/upload?visibility=" + visibility, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-File-Mime": mime },
    body: bytes
  });
  return saved.url;
}

async function uploadedFields(body, fields) {
  const next = { ...body };
  for (const field of fields) {
    if (Array.isArray(next[field])) next[field] = await Promise.all(next[field].map(item => maybeUploadMedia(item)));
    else if (typeof next[field] === "string") next[field] = await maybeUploadMedia(next[field]);
  }
  return next;
}

export const api = {
  register: body => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  inviteAdmin: (inviteKey, body) => request(`/auth/register/admin/${encodeURIComponent(inviteKey)}`, { method: "POST", body: JSON.stringify(body) }),
  login: body => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),

  profile: {
    get: () => request("/profile"),
    update: async body => request("/profile", { method: "PUT", body: JSON.stringify(await uploadedFields(body, ["profileImage", "coverImage"])) })
  },
  business: {
    mine: () => request("/businesses/mine"),
    update: async body => request("/businesses/mine", { method: "PUT", body: JSON.stringify(await uploadedFields(body, ["logo"])) })
  },
  content: {
    list: () => request("/content"),
    get: id => request(`/content/${id}`),
    create: async body => request("/content", { method: "POST", body: JSON.stringify(await uploadedFields(body, ["coverImage", "images"])) }),
    update: async (id, body) => request(`/content/${id}`, { method: "PUT", body: JSON.stringify(await uploadedFields(body, ["coverImage", "images"])) }),
    publish: (id, published) => request(`/content/${id}/publish`, { method: "PATCH", body: JSON.stringify({ published }) }),
    remove: id => request(`/content/${id}`, { method: "DELETE" })
  },
  ratings: {
    set: (contentId, rating) => request(`/ratings/${contentId}`, { method: "PUT", body: JSON.stringify({ rating }) }),
    remove: contentId => request(`/ratings/${contentId}`, { method: "DELETE" }),
    setBusiness: (businessId, rating) => request(`/ratings/business/${businessId}`, { method: "PUT", body: JSON.stringify({ rating }) }),
    removeBusiness: businessId => request(`/ratings/business/${businessId}`, { method: "DELETE" })
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
    list: (params = {}) => {
      const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value != null));
      return request(`/bookings${query.toString() ? "?" + query : ""}`);
    },
    customers: () => request("/bookings/customers/summary"),
    get: id => request(`/bookings/${id}`),
    create: body => request("/bookings", { method: "POST", body: JSON.stringify(body) }),
    update: (id, body) => request(`/bookings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    reschedule: (id, bookingDate, reason = "") => request(`/bookings/${id}/reschedule`, { method: "PATCH", body: JSON.stringify({ bookingDate, reason }) }),
    setStatus: (id, status) => request(`/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    remove: id => request(`/bookings/${id}`, { method: "DELETE" })
  },
  sales: {
    analytics: params => request(`/sales/analytics?${new URLSearchParams(params)}`),
    products: () => request("/sales/products"),
    createProduct: async body => request("/sales/products", { method: "POST", body: JSON.stringify(await uploadedFields(body, ["image", "images"])) }),
    updateProduct: async (id, body) => request(`/sales/products/${id}`, { method: "PUT", body: JSON.stringify(await uploadedFields(body, ["image", "images"])) }),
    removeProduct: id => request(`/sales/products/${id}`, { method: "DELETE" }),
    posSales: () => request("/sales/pos"),
    checkout: body => request("/sales/pos", { method: "POST", body: JSON.stringify(body) }),
    orders: () => request("/sales/orders"),
    setOrderStatus: (id, status) => request(`/sales/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    recordOrderPayment: (id, body) => request(`/sales/orders/${id}/payment`, { method: "PATCH", body: JSON.stringify(body) }),
    inventoryHistory: () => request("/sales/inventory-history")
  },
  admin: {
    overview: () => request("/admin/overview"),
    businesses: () => request("/admin/businesses"),
    business: id => request(`/admin/businesses/${id}`),
    setBusinessStatus: (id, accountStatus) => request(`/admin/businesses/${id}/status`, { method: "PATCH", body: JSON.stringify({ accountStatus }) }),
    resetBusinessPassword: (id, password) => request(`/admin/businesses/${id}/password`, { method: "PATCH", body: JSON.stringify({ password }) })
  },
  messages: {
    users: () => request("/messages/users"),
    conversation: (userId, before = "") => request(`/messages/${userId}${before ? "?before=" + encodeURIComponent(before) : ""}`),
    send: async (userId, payload) => {
      const body = typeof payload === "string" ? { body: payload } : payload;
      const next = body?.attachment?.dataUrl
        ? { ...body, attachment: { ...body.attachment, dataUrl: await maybeUploadMedia(body.attachment.dataUrl, "private") } }
        : body;
      return request(`/messages/${userId}`, { method: "POST", body: JSON.stringify(next) });
    },
    searchUsers: q => request(`/messages/friends/search?${new URLSearchParams({ q })}`),
    friendRequests: () => request("/messages/friends/requests"),
    addFriend: userId => request(`/messages/friends/${userId}/request`, { method: "POST" }),
    acceptFriend: userId => request(`/messages/friends/${userId}/accept`, { method: "PATCH" }),
    unfriend: userId => request(`/messages/friends/${userId}`, { method: "DELETE" }),
    action: (userId, action) => request(`/messages/users/${userId}/${action}`, { method: "PATCH" }),
    deleteConversation: userId => request(`/messages/${userId}/conversation`, { method: "DELETE" }),
    deleteMessage: messageId => request(`/messages/item/${messageId}`, { method: "DELETE" }),
    unsend: messageId => request(`/messages/item/${messageId}/unsend`, { method: "PATCH" })
  },
  publicBooking: {
    get: userId => request(`/public/book/${userId}`),
    slots: (userId, date, contentId = "") => request(`/public/book/${userId}/slots?${new URLSearchParams({ date, ...(contentId ? { contentId } : {}) })}`),
    create: (userId, body) => request(`/public/book/${userId}`, { method: "POST", body: JSON.stringify(body) })
  },
  reviews: {
    get: token => request(`/public/reviews/${encodeURIComponent(token)}`),
    submit: (token, body) => request(`/public/reviews/${encodeURIComponent(token)}`, { method: "PUT", body: JSON.stringify(body) })
  },
  publicProfile: username => request(`/public/profile/${username}`),
  publicProductOrder: (userId, body) => request(`/public/products/${userId}/order`, { method: "POST", body: JSON.stringify(body) }),
  publicContent: id => request(`/public/content/${id}`),
  browse: () => request("/public/browse"),
  search: params => request(`/public/search?${new URLSearchParams(params)}`)
};
