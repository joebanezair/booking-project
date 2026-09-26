import { Router } from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";
import { reactionMap } from "../lib/emojiReactions.js";

const router = Router();
router.use(requireAuth);
const publicUserFields = "name email username profileImage role accountStatus headline";

function hasId(list = [], id) { return list.some(item => String(item?._id || item) === String(id)); }
async function me(id) { return User.findById(id).select("friends friendRequests blockedUsers restrictedUsers pinnedConversations role"); }
async function canMessage(sender, recipient) {
  if (sender.role === "admin" || recipient.role === "admin") return true;
  return hasId(sender.friends, recipient._id) && hasId(recipient.friends, sender._id);
}
function relationship(current, otherId) {
  return {
    friend: hasId(current.friends, otherId),
    incomingRequest: current.friendRequests?.some(r => String(r.from) === String(otherId)) || false,
    blocked: hasId(current.blockedUsers, otherId),
    restricted: hasId(current.restrictedUsers, otherId),
    pinned: hasId(current.pinnedConversations, otherId)
  };
}

router.get("/users", async (req, res) => {
  try {
    const current = await me(req.user.id);
    const ids = current.role === "admin" ? null : current.friends;
    const filter = { _id: { $ne: req.user.id }, role: { $in: ["business", "admin"] }, accountStatus: { $ne: "disabled" } };
    if (ids) filter.$or = [{ _id: { $in: ids } }, { role: "admin" }];
    const users = await User.find(filter).select(publicUserFields).lean();
    const messages = await Message.aggregate([
      { $match: { $or: [{ sender: new mongoose.Types.ObjectId(req.user.id) }, { recipient: new mongoose.Types.ObjectId(req.user.id) }], deletedFor: { $ne: new mongoose.Types.ObjectId(req.user.id) } } },
      { $sort: { createdAt: -1 } }
    ]);
    const meta = new Map();
    for (const m of messages) {
      const other = String(m.sender) === String(req.user.id) ? String(m.recipient) : String(m.sender);
      if (!meta.has(other)) meta.set(other, { lastMessageAt: m.createdAt, preview: m.unsentAt ? "Message removed" : (m.body || (m.messageType === "file" ? "Sent a file" : "Shared a profile")) });
    }
    const unread = await Message.aggregate([
      { $match: { recipient: new mongoose.Types.ObjectId(req.user.id), readAt: null, unsentAt: null } },
      { $group: { _id: "$sender", count: { $sum: 1 } } }
    ]);
    const unreadMap = new Map(unread.map(x => [String(x._id), x.count]));
    res.json(users.map(u => ({ ...u, ...relationship(current, u._id), ...(meta.get(String(u._id)) || {}), unreadCount: unreadMap.get(String(u._id)) || 0 }))
      .sort((a,b) => Number(b.pinned)-Number(a.pinned) || new Date(b.lastMessageAt || 0)-new Date(a.lastMessageAt || 0) || a.name.localeCompare(b.name)));
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to load conversations." }); }
});

router.get("/friends/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const current = await me(req.user.id);
    const filter = { _id: { $ne: req.user.id }, accountStatus: { $ne: "disabled" }, role: { $in: ["business","admin"] } };
    if (q) filter.$or = [{ name: { $regex: q, $options: "i" } }, { username: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }];
    const users = await User.find(filter).select(publicUserFields).limit(30).lean();
    res.json(users.map(u => ({ ...u, ...relationship(current, u._id) })));
  } catch (error) { res.status(500).json({ message: "Unable to search users." }); }
});

router.get("/friends/requests", async (req,res) => {
  const current = await User.findById(req.user.id).populate("friendRequests.from", publicUserFields);
  res.json((current.friendRequests || []).map(r => ({ ...r.toObject(), from: r.from })));
});
router.post("/friends/:userId/request", async (req,res) => {
  const other = await User.findById(req.params.userId);
  if (!other || String(other._id) === String(req.user.id)) return res.status(404).json({message:"User not found."});
  const current = await me(req.user.id);
  if (hasId(current.friends, other._id)) return res.json({ok:true, friend:true});
  if (!other.friendRequests.some(r => String(r.from) === String(req.user.id))) other.friendRequests.push({from:req.user.id});
  await other.save();
  await notify(req, other._id, {type:"friend_request",title:"Friend request",body:"Someone wants to connect with you.",link:"/dashboard/messages"});
  res.status(201).json({ok:true});
});
router.patch("/friends/:userId/accept", async (req,res) => {
  const current = await User.findById(req.user.id); const other = await User.findById(req.params.userId);
  if (!other) return res.status(404).json({message:"User not found."});
  if (!current.friendRequests.some(r => String(r.from) === String(other._id))) return res.status(400).json({message:"No pending request."});
  current.friendRequests = current.friendRequests.filter(r => String(r.from) !== String(other._id));
  if (!hasId(current.friends, other._id)) current.friends.push(other._id);
  if (!hasId(other.friends, current._id)) other.friends.push(current._id);
  await Promise.all([current.save(),other.save()]); res.json({ok:true});
});
router.delete("/friends/:userId", async (req,res) => {
  await Promise.all([
    User.findByIdAndUpdate(req.user.id, {$pull:{friends:req.params.userId}}),
    User.findByIdAndUpdate(req.params.userId, {$pull:{friends:req.user.id}})
  ]); res.status(204).end();
});
router.patch("/users/:userId/:action", async (req,res) => {
  const {userId,action}=req.params;
  const map={pin:["pinnedConversations",true],unpin:["pinnedConversations",false],block:["blockedUsers",true],unblock:["blockedUsers",false],restrict:["restrictedUsers",true],unrestrict:["restrictedUsers",false]};
  if(!map[action]) return res.status(400).json({message:"Unknown action."});
  const [field,add]=map[action];
  await User.findByIdAndUpdate(req.user.id, add ? {$addToSet:{[field]:userId}} : {$pull:{[field]:userId}});
  res.json({ok:true});
});

router.get("/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId) || String(req.params.userId) === String(req.user.id)) return res.status(400).json({ message: "Invalid user ID." });
    const [current, otherUser] = await Promise.all([me(req.user.id), User.findById(req.params.userId).select(publicUserFields).lean()]);
    if (!otherUser) return res.status(404).json({ message: "User not found." });
    if (hasId(current.blockedUsers, otherUser._id)) return res.status(403).json({message:"You blocked this account."});
    const messages = await Message.find({ $or: [{ sender:req.user.id,recipient:req.params.userId },{ sender:req.params.userId,recipient:req.user.id }], deletedFor:{$ne:req.user.id} }).sort({createdAt:1}).populate("sharedProfile", publicUserFields);
    await Message.updateMany({sender:req.params.userId,recipient:req.user.id,readAt:null},{$set:{readAt:new Date()}});
    const reactions=await reactionMap("message",messages.map(m=>m._id),req.user.id);
    res.json({user:{...otherUser,...relationship(current,otherUser._id)},canMessage:await canMessage(current,otherUser),messages:messages.map(m=>({...m.toObject(),emojiReactions:reactions.get(String(m._id))||[]}))});
  } catch(error){console.error(error);res.status(500).json({message:"Unable to load conversation."});}
});

router.post("/:userId", async (req,res) => {
  try {
    if(!mongoose.isValidObjectId(req.params.userId)||String(req.params.userId)===String(req.user.id)) return res.status(400).json({message:"Invalid user ID."});
    const [current,recipient]=await Promise.all([me(req.user.id),User.findById(req.params.userId)]);
    if(!recipient) return res.status(404).json({message:"User not found."});
    if(hasId(current.blockedUsers,recipient._id)||hasId(recipient.blockedUsers,req.user.id)) return res.status(403).json({message:"Messaging is unavailable for this account."});
    if(!(await canMessage(current,recipient))) return res.status(403).json({message:"You can only message friends."});
    const body=String(req.body.body||"").trim(), messageType=req.body.messageType||"text";
    if(!body && !req.body.attachment && !req.body.sharedProfile) return res.status(400).json({message:"Message cannot be empty."});
    if(body.length>2000) return res.status(400).json({message:"Message is too long."});
    let attachment;
    if(req.body.attachment){
      const a=req.body.attachment;
      if(Number(a.size)>5*1024*1024) return res.status(413).json({message:"Files must be 5 MB or smaller."});
      if(!/^data:(image\/|application\/pdf|text\/|application\/(msword|vnd\.openxmlformats-officedocument|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet))/.test(a.dataUrl||"")) return res.status(400).json({message:"Unsupported file type."});
      attachment={name:String(a.name||"file").slice(0,180),mimeType:a.mimeType,size:Number(a.size)||0,dataUrl:a.dataUrl};
    }
    const message=await Message.create({sender:req.user.id,recipient:req.params.userId,body,messageType,attachment,sharedProfile:req.body.sharedProfile||null});
    const populated=await Message.findById(message._id).populate("sharedProfile",publicUserFields);
    req.app.get("io").to(`user:${req.params.userId}`).emit("message:new",populated);
    await notify(req,req.params.userId,{type:"message",title:"New message",body:(body|| (attachment?"Sent a file":"Shared a profile")).slice(0,120),link:`/dashboard/messages/${req.user.id}`});
    res.status(201).json({...populated.toObject(),emojiReactions:[]});
  } catch(error){console.error(error);res.status(500).json({message:"Unable to send message."});}
});

router.delete("/:userId/conversation", async(req,res)=>{
  await Message.updateMany({$or:[{sender:req.user.id,recipient:req.params.userId},{sender:req.params.userId,recipient:req.user.id}]},{$addToSet:{deletedFor:req.user.id}});
  res.status(204).end();
});
router.delete("/item/:messageId", async(req,res)=>{
  const message=await Message.findById(req.params.messageId);
  if(!message) return res.status(404).json({message:"Message not found."});
  if(String(message.sender)!==String(req.user.id)&&String(message.recipient)!==String(req.user.id)) return res.status(403).json({message:"Not allowed."});
  await Message.findByIdAndUpdate(message._id,{$addToSet:{deletedFor:req.user.id}}); res.status(204).end();
});
router.patch("/item/:messageId/unsend", async(req,res)=>{
  const message=await Message.findOne({_id:req.params.messageId,sender:req.user.id});
  if(!message) return res.status(404).json({message:"Message not found."});
  message.body=""; message.attachment=undefined; message.sharedProfile=null; message.unsentAt=new Date(); await message.save();
  req.app.get("io").to(`user:${message.recipient}`).emit("message:unsent",{messageId:message._id});
  res.json(message);
});

export default router;
