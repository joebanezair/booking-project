import mongoose from "mongoose";
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},type:{type:String,required:true},title:{type:String,required:true,maxlength:120},body:{type:String,default:"",maxlength:300},link:{type:String,default:"",maxlength:300},readAt:{type:Date,default:null,index:true}},{timestamps:true});
schema.index({user:1,createdAt:-1});
export default mongoose.model("Notification",schema);
