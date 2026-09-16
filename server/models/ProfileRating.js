import mongoose from "mongoose";
const schema=new mongoose.Schema({profile:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},rating:{type:Number,required:true,min:1,max:5}},{timestamps:true});
schema.index({profile:1,user:1},{unique:true});
export default mongoose.model("ProfileRating",schema);
