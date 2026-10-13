import { createHmac, timingSafeEqual } from "node:crypto";

// Keep guest tracking links unguessable without adding buyer accounts.
// The token lives in the browser URL fragment; API clients send it in a header.
export function orderTrackingToken(order){
  if(!process.env.JWT_SECRET)throw new Error("JWT_SECRET is required for order tracking links.");
  return createHmac("sha256",process.env.JWT_SECRET)
    .update("bookflow:order-status:v1:"+String(order._id)+":"+order.orderNumber)
    .digest("hex");
}
export function validOrderTrackingToken(order,token){
  if(typeof token!=="string"||!/^[0-9a-f]{64}$/.test(token))return false;
  return timingSafeEqual(Buffer.from(orderTrackingToken(order),"hex"),Buffer.from(token,"hex"));
}
