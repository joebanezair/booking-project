import mongoose from "mongoose";
const replySchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},body:{type:String,required:true,trim:true,maxlength:2000}},{timestamps:true});
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},title:{type:String,required:true,trim:true,maxlength:160},body:{type:String,required:true,trim:true,maxlength:5000},category:{type:String,trim:true,maxlength:60,default:"General",index:true},replies:{type:[replySchema],default:[]}},{timestamps:true});
schema.index({createdAt:-1}); schema.index({title:"text",body:"text",category:"text"});
export default mongoose.model("ForumPost",schema);
