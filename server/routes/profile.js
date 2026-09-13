import { Router } from "express";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
const imagePattern = /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i;
const fields = "name username email bio headline location website profileImage createdAt updatedAt";
function slug(value){return String(value||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30)||"user";}
async function ensureUsername(user){if(user.username)return user;const base=slug(user.name);let candidate=base,i=1;while(await User.exists({username:candidate,_id:{$ne:user._id}}))candidate=`${base}-${i++}`;user.username=candidate;await user.save();return user;}
function imageError(value) {
  if (!value) return null;
  if (!imagePattern.test(value)) return "Profile image must be a JPEG, PNG, WebP, or GIF.";
  return Math.ceil((value.split(",")[1] || "").length * 3 / 4) > 2 * 1024 * 1024 ? "Profile image must be 2 MB or smaller." : null;
}

router.get("/", async (req,res)=>{
  try {
    let user=await User.findById(req.user.id).select(fields);
    if(!user) return res.status(401).json({message:"Your session no longer matches an account. Please sign in again."});
    user=await ensureUsername(user);
    res.json(user);
  } catch(error){console.error(error);res.status(500).json({message:"Unable to load profile."});}
});

router.put("/", async (req,res)=>{
  try {
    const username=String(req.body.username||"").toLowerCase().trim();
    const input={
      name:String(req.body.name||"").trim(), username,
      bio:String(req.body.bio||"").trim(), headline:String(req.body.headline||"").trim(),
      location:String(req.body.location||"").trim(), website:String(req.body.website||"").trim(),
      profileImage:String(req.body.profileImage||"")
    };
    if(!input.name) return res.status(400).json({message:"Name is required."});
    if(!/^[a-z0-9-]{3,40}$/.test(username)) return res.status(400).json({message:"Username must be 3–40 lowercase letters, numbers, or hyphens."});
    if(await User.exists({username,_id:{$ne:req.user.id}})) return res.status(409).json({message:"That username is already taken."});
    if(input.bio.length>1000||input.headline.length>120||input.location.length>120||input.website.length>300) return res.status(400).json({message:"One or more profile fields are too long."});
    if(input.website&&!/^https?:\/\//i.test(input.website)) return res.status(400).json({message:"Website must start with http:// or https://."});
    const imgErr=imageError(input.profileImage); if(imgErr) return res.status(400).json({message:imgErr});
    const user=await User.findByIdAndUpdate(req.user.id,input,{new:true,runValidators:true}).select(fields);
    if(!user) return res.status(401).json({message:"Please sign in again."});
    res.json(user);
  } catch(error){console.error(error);res.status(500).json({message:"Unable to update profile."});}
});

export default router;
