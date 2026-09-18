import Business from "../models/Business.js";
import User from "../models/User.js";

export async function providerOwnerIds() {
  const [legacy, approved] = await Promise.all([
    User.find({ role: { $in: ["admin", "business"] } }).distinct("_id"),
    Business.find({ status: "approved" }).distinct("owner")
  ]);
  return [...new Map([...legacy, ...approved].map(id => [String(id), id])).values()];
}

export async function isProviderOwner(userId) {
  const user = await User.findById(userId).select("role").lean();
  if (!user) return false;
  return ["admin", "business"].includes(user.role) || Boolean(await Business.exists({ owner: userId, status: "approved" }));
}
