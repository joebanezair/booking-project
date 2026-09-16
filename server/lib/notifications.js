import Notification from "../models/Notification.js";
export async function notify(req,user,data){const notification=await Notification.create({user,...data});req.app.get("io").to(`user:${user}`).emit("notification:new",notification);return notification;}
