import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Content from "../models/Content.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Comment from "../models/Comment.js";
import optionalAuth from "../middleware/optionalAuth.js";

const router = Router();

async function ratingSummary(contentIds) {
  const ids = contentIds.map(id => new mongoose.Types.ObjectId(id));
  const rows = await Rating.aggregate([
    { $match: { content: { $in: ids } } },
    { $group: { _id: "$content", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
  ]);
  return new Map(rows.map(r => [String(r._id), { averageRating: Number(r.averageRating.toFixed(1)), ratingCount: r.ratingCount }]));
}

router.get("/profile/:username", async (req,res)=>{
  try {
    const user=await User.findOne({username:String(req.params.username).toLowerCase()})
      .select("name username bio headline location website profileImage createdAt");
    if(!user) return res.status(404).json({message:"Profile not found."});
    const items=await Content.find({user:user._id,published:true})
      .select("title description price currency category coverImage createdAt updatedAt").sort({updatedAt:-1});
    const summary=await ratingSummary(items.map(i=>i._id));
    res.json({
      profile:{id:user._id,name:user.name,username:user.username,bio:user.bio,headline:user.headline,location:user.location,website:user.website,profileImage:user.profileImage,createdAt:user.createdAt},
      content:items.map(item=>({...item.toObject(),...(summary.get(String(item._id))||{averageRating:0,ratingCount:0})}))
    });
  } catch(error){console.error(error);res.status(500).json({message:"Unable to load public profile."});}
});

router.get("/content/:contentId", optionalAuth, async (req,res)=>{
  try {
    if(!mongoose.isValidObjectId(req.params.contentId)) return res.status(404).json({message:"Content not found."});
    const item=await Content.findOne({_id:req.params.contentId,published:true})
      .populate("user","name username bio headline location website profileImage");
    if(!item||!item.user) return res.status(404).json({message:"Content not found."});

    const [summaryRows,comments,current]=await Promise.all([
      Rating.aggregate([{ $match:{content:item._id}},{ $group:{_id:"$content",averageRating:{$avg:"$rating"},ratingCount:{$sum:1}}}]),
      Comment.find({content:item._id}).populate("user","name username profileImage").sort({createdAt:-1}).limit(50),
      req.user ? Rating.findOne({content:item._id,user:req.user.id}).select("rating") : null
    ]);
    const summary=summaryRows[0]||{};
    res.json({
      _id:item._id,title:item.title,description:item.description,price:item.price,currency:item.currency,
      category:item.category,coverImage:item.coverImage,images:item.images,createdAt:item.createdAt,updatedAt:item.updatedAt,
      owner:{id:item.user._id,name:item.user.name,username:item.user.username,bio:item.user.bio,headline:item.user.headline,location:item.user.location,website:item.user.website,profileImage:item.user.profileImage},
      ratingSummary:{averageRating:summary.averageRating?Number(summary.averageRating.toFixed(1)):0,ratingCount:summary.ratingCount||0},
      currentUserRating:current?.rating||null,
      comments
    });
  } catch(error){console.error(error);res.status(500).json({message:"Unable to load content."});}
});

router.get("/browse", async (_req,res)=>{
  try {
    const items=await Content.find({published:true}).populate("user","name username profileImage").sort({updatedAt:-1}).limit(60);
    const summary=await ratingSummary(items.map(i=>i._id));
    res.json(items.map(item=>({...item.toObject(),owner:item.user,...(summary.get(String(item._id))||{averageRating:0,ratingCount:0})})));
  } catch(error){console.error(error);res.status(500).json({message:"Unable to browse content."});}
});

router.get("/book/:userId", async (req,res)=>{
  try {
    if(!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({message:"Booking page not found."});
    const user=await User.findById(req.params.userId).select("name");
    if(!user) return res.status(404).json({message:"Booking page not found."});
    res.json({owner:{id:user._id,name:user.name},services:["Consultation","Technical Support","Product Demo","Project Meeting","Discovery Call","Other"]});
  } catch(error){console.error(error);res.status(500).json({message:"Unable to load booking page."});}
});

router.post("/book/:userId", async (req,res)=>{
  try {
    if(!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({message:"Booking page not found."});
    const owner=await User.findById(req.params.userId);
    if(!owner) return res.status(404).json({message:"Booking page not found."});
    const guestName=String(req.body.guestName||"").trim(),guestEmail=String(req.body.guestEmail||"").trim().toLowerCase();
    const service=String(req.body.service||"").trim(),bookingDate=req.body.bookingDate,notes=String(req.body.notes||"").trim();
    if(!guestName||!guestEmail||!service||!bookingDate) return res.status(400).json({message:"Name, email, service and booking date are required."});
    if(!/^\S+@\S+\.\S+$/.test(guestEmail)) return res.status(400).json({message:"Enter a valid email address."});
    if(Number.isNaN(new Date(bookingDate).getTime())||new Date(bookingDate)<new Date()) return res.status(400).json({message:"Please choose a valid future date and time."});
    const booking=await Booking.create({user:owner._id,guestName,guestEmail,service,bookingDate,notes,source:"public",status:"pending"});
    res.status(201).json({id:booking._id,message:"Booking request sent successfully."});
  } catch(error){console.error(error);res.status(500).json({message:"Unable to create booking."});}
});

export default router;
