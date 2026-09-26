import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    businessOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true, index: true },
    content: { type: mongoose.Schema.Types.ObjectId, ref: "Content", default: null, index: true },
    serviceName: { type: String, required: true, trim: true, maxlength: 120 },
    saleAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "PHP" },
    guestName: { type: String, trim: true, maxlength: 100, default: "" },
    guestEmail: { type: String, trim: true, lowercase: true, maxlength: 150, default: "" },
    guestPhone: { type: String, trim: true, maxlength: 30, default: "" },
    locationLabel: { type: String, trim: true, maxlength: 200, default: "" },
    bookingDate: { type: Date, required: true },
    completedAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["recorded", "voided"], default: "recorded", index: true },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, trim: true, maxlength: 300, default: "" }
  },
  { timestamps: true }
);

saleSchema.index({ businessOwner: 1, status: 1, completedAt: -1 });
saleSchema.index({ businessOwner: 1, serviceName: 1, completedAt: -1 });

export const Product = mongoose.models.Product || mongoose.model("Product", new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  name:{type:String,required:true,trim:true,maxlength:120}, sku:{type:String,trim:true,maxlength:80,default:""},
  description:{type:String,trim:true,maxlength:1200,default:""}, image:{type:String,default:""},
  price:{type:Number,min:0,default:0}, currency:{type:String,uppercase:true,maxlength:3,default:"PHP"},
  stock:{type:Number,min:0,default:0}, published:{type:Boolean,default:false,index:true}
},{timestamps:true}));

export const PosSale = mongoose.models.PosSale || mongoose.model("PosSale", new mongoose.Schema({
  businessOwner:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  invoiceNumber:{type:String,required:true,unique:true,index:true},
  items:[{product:{type:mongoose.Schema.Types.ObjectId,ref:"Product"},name:String,sku:String,quantity:Number,unitPrice:Number,lineTotal:Number}],
  total:{type:Number,min:0,required:true}, currency:{type:String,uppercase:true,maxlength:3,default:"PHP"},
  paymentMethod:{type:String,enum:["cash","gcash","maya","card","other"],default:"cash"},
  customerName:{type:String,trim:true,maxlength:120,default:""}, soldAt:{type:Date,default:Date.now,index:true},
  status:{type:String,enum:["recorded","voided"],default:"recorded",index:true}
},{timestamps:true}));

export default mongoose.model("Sale", saleSchema);
