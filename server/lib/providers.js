import User from "../models/User.js";

export async function providerOwnerIds() {
  return User.find({
    role: "business",
    accountStatus: { $in: ["active", "paused"] }
  }).distinct("_id");
}

export async function isProviderOwner(userId) {
  return Boolean(await User.exists({
    _id: userId,
    role: "business",
    accountStatus: { $in: ["active", "paused"] }
  }));
}

export async function isActiveProvider(userId) {
  return Boolean(await User.exists({
    _id: userId,
    role: "business",
    accountStatus: "active"
  }));
}
