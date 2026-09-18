import EmojiReaction, { ALLOWED_EMOJIS } from "../models/EmojiReaction.js";

export async function reactionMap(targetType, targetIds, currentUserId) {
  if (!targetIds.length) return new Map();
  const [counts, selected] = await Promise.all([
    EmojiReaction.aggregate([
      { $match: { targetType, target: { $in: targetIds } } },
      { $group: { _id: { target: "$target", emoji: "$emoji" }, count: { $sum: 1 } } }
    ]),
    currentUserId ? EmojiReaction.find({ targetType, target: { $in: targetIds }, user: currentUserId }).select("target emoji").lean() : []
  ]);
  const selectedSet = new Set(selected.map(item => `${item.target}:${item.emoji}`));
  const map = new Map();
  for (const row of counts) {
    const targetId = String(row._id.target);
    if (!map.has(targetId)) map.set(targetId, []);
    map.get(targetId).push({ emoji: row._id.emoji, count: row.count, reacted: selectedSet.has(`${targetId}:${row._id.emoji}`) });
  }
  for (const reactions of map.values()) reactions.sort((a, b) => ALLOWED_EMOJIS.indexOf(a.emoji) - ALLOWED_EMOJIS.indexOf(b.emoji));
  return map;
}

export async function reactionSummary(targetType, targetId, currentUserId) {
  const map = await reactionMap(targetType, [targetId], currentUserId);
  return map.get(String(targetId)) || [];
}
