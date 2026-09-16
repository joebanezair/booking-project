import {Router} from "express"; import Notification from "../models/Notification.js"; import requireAuth from "../middleware/auth.js";
const router=Router();router.use(requireAuth);
router.get("/",async(req,res)=>{const items=await Notification.find({user:req.user.id}).sort({createdAt:-1}).limit(100);const unread=await Notification.countDocuments({user:req.user.id,readAt:null});res.json({items,unread});});
router.patch("/read-all",async(req,res)=>{await Notification.updateMany({user:req.user.id,readAt:null},{$set:{readAt:new Date()}});res.json({success:true});});
router.patch("/:id/read",async(req,res)=>{const item=await Notification.findOneAndUpdate({_id:req.params.id,user:req.user.id},{readAt:new Date()},{new:true});if(!item)return res.status(404).json({message:"Notification not found."});res.json(item);});
export default router;
