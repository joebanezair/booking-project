import { Router } from "express";
import Sale, { Product, PosSale, ProductOrder } from "../models/Sale.js";
import requireAuth from "../middleware/auth.js";
import { requireBusiness } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth, requireBusiness);\n\nfunction productImages(body){return (Array.isArray(body.images)?body.images:[]).map(value=>String(value||"").trim()).filter(Boolean).slice(0,8);}

function offsetMinutes(req) {
  const value = Number(req.query.offset || 0);
  return Number.isFinite(value) && Math.abs(value) <= 840 ? value : 0;
}

function localDate(date, offset) {
  return new Date(new Date(date).getTime() - offset * 60_000);
}

function fromLocalParts(year, month, day, offset) {
  return new Date(Date.UTC(year, month, day) + offset * 60_000);
}

function rangeBounds(range, start, end, offset) {
  const nowLocal = localDate(new Date(), offset);
  const y = nowLocal.getUTCFullYear();
  const m = nowLocal.getUTCMonth();
  const d = nowLocal.getUTCDate();

  if (range === "today") {
    return { start: fromLocalParts(y, m, d, offset), end: fromLocalParts(y, m, d + 1, offset) };
  }
  if (range === "7d") {
    return { start: fromLocalParts(y, m, d - 6, offset), end: fromLocalParts(y, m, d + 1, offset) };
  }
  if (range === "month") {
    return { start: fromLocalParts(y, m, 1, offset), end: fromLocalParts(y, m + 1, 1, offset) };
  }
  if (range === "year") {
    return { start: fromLocalParts(y, 0, 1, offset), end: fromLocalParts(y + 1, 0, 1, offset) };
  }
  if (range === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(start || "") && /^\d{4}-\d{2}-\d{2}$/.test(end || "")) {
    const [sy, sm, sd] = start.split("-").map(Number);
    const [ey, em, ed] = end.split("-").map(Number);
    return {
      start: fromLocalParts(sy, sm - 1, sd, offset),
      end: fromLocalParts(ey, em - 1, ed + 1, offset)
    };
  }
  return { start: null, end: null };
}

function groupMeta(date, group, offset) {
  const local = localDate(date, offset);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const monthName = local.toLocaleString("en", { month: "short", timeZone: "UTC" });

  if (group === "annual") return { key: String(y), label: String(y) };
  if (group === "monthly") return { key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${monthName} ${y}` };
  if (group === "weekly") {
    const day = local.getUTCDay();
    const mondayDelta = day === 0 ? -6 : 1 - day;
    const monday = new Date(Date.UTC(y, m, d + mondayDelta));
    const my = monday.getUTCFullYear();
    const mm = monday.getUTCMonth();
    const md = monday.getUTCDate();
    const label = `Week of ${monday.toLocaleString("en", { month: "short", day: "numeric", timeZone: "UTC" })}`;
    return { key: `${my}-${String(mm + 1).padStart(2, "0")}-${String(md).padStart(2, "0")}`, label };
  }
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    label: local.toLocaleString("en", { month: "short", day: "numeric", timeZone: "UTC" })
  };
}



async function deductInventory(lines, userId) {
  const deducted = [];
  try {
    for (const line of lines) {
      const changed = await Product.findOneAndUpdate(
        { _id: line.product, user: userId, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
        { new: true }
      );
      if (!changed) throw Object.assign(new Error(line.name + " has insufficient stock."), { statusCode: 409 });
      deducted.push(line);
    }
    return deducted;
  } catch (error) {
    if (deducted.length) {
      await Promise.all(deducted.map(line => Product.updateOne(
        { _id: line.product, user: userId },
        { $inc: { stock: line.quantity } }
      )));
    }
    throw error;
  }
}

async function restoreInventory(lines, userId) {
  if (!lines?.length) return;
  await Promise.all(lines.map(line => Product.updateOne(
    { _id: line.product, user: userId },
    { $inc: { stock: line.quantity } }
  )));
}

router.get("/products", async (req,res) => {
  try { res.json(await Product.find({user:req.user.id}).sort({updatedAt:-1})); }
  catch (error) { console.error(error); res.status(500).json({message:"Unable to load products."}); }
});
router.post("/products", async (req,res) => {
  try {
    const name=String(req.body.name||"").trim();
    if(!name) return res.status(400).json({message:"Product name is required."});
    const product=await Product.create({user:req.user.id,name,sku:String(req.body.sku||"").trim(),description:String(req.body.description||"").trim(),images:productImages(req.body),image:productImages(req.body)[0]||"",price:Math.max(0,Number(req.body.price||0)),currency:String(req.body.currency||"PHP").toUpperCase().slice(0,3),stock:Math.max(0,Math.floor(Number(req.body.stock||0))),published:Boolean(req.body.published)});
    res.status(201).json(product);
  } catch(error) { console.error(error); res.status(500).json({message:"Unable to create product."}); }
});

router.put("/products/:id", async (req,res) => {
  try {
    const name=String(req.body.name||"").trim();
    if(!name) return res.status(400).json({message:"Product name is required."});
    const product=await Product.findOneAndUpdate({_id:req.params.id,user:req.user.id},{$set:{name,sku:String(req.body.sku||"").trim(),description:String(req.body.description||"").trim(),images:productImages(req.body),image:productImages(req.body)[0]||"",price:Math.max(0,Number(req.body.price||0)),currency:String(req.body.currency||"PHP").toUpperCase().slice(0,3),stock:Math.max(0,Math.floor(Number(req.body.stock||0))),published:Boolean(req.body.published)}},{new:true,runValidators:true});
    if(!product) return res.status(404).json({message:"Product not found."});
    res.json(product);
  } catch(error){console.error(error);res.status(500).json({message:"Unable to update product."});}
});
router.delete("/products/:id", async(req,res) => {
  try { const product=await Product.findOneAndDelete({_id:req.params.id,user:req.user.id}); if(!product)return res.status(404).json({message:"Product not found."}); res.status(204).end(); }
  catch(error){console.error(error);res.status(500).json({message:"Unable to delete product."});}
});
router.get("/pos", async(req,res) => {
  try { res.json(await PosSale.find({businessOwner:req.user.id}).sort({soldAt:-1}).limit(200).lean()); }
  catch(error){console.error(error);res.status(500).json({message:"Unable to load POS sales."});}
});
router.post("/pos", async(req,res) => {
  try {
    const rows=Array.isArray(req.body.items)?req.body.items:[];
    if(!rows.length)return res.status(400).json({message:"Add at least one product."});
    const products=await Product.find({_id:{$in:rows.map(row=>row.productId)},user:req.user.id});
    const productMap=new Map(products.map(product=>[String(product._id),product]));
    const lines=[]; let total=0; let currency="PHP";
    for(const row of rows){
      const product=productMap.get(String(row.productId)); const quantity=Math.max(1,Math.floor(Number(row.quantity||1)));
      if(!product)return res.status(404).json({message:"Product not found."});
      if(product.stock<quantity)return res.status(409).json({message:product.name+" has insufficient stock."});
      const lineTotal=Number(product.price||0)*quantity;
      lines.push({product:product._id,name:product.name,sku:product.sku,quantity,unitPrice:product.price,lineTotal}); total+=lineTotal; currency=product.currency||currency;
    }
    const deducted=await deductInventory(lines,req.user.id);
    try {
      const payment=["cash","gcash","maya","card","other"].includes(req.body.paymentMethod)?req.body.paymentMethod:"cash";
      const invoiceNumber="BFI-"+new Date().getFullYear()+"-"+Date.now();
      const sale=await PosSale.create({businessOwner:req.user.id,invoiceNumber,items:lines,total,currency,paymentMethod:payment,customerName:String(req.body.customerName||"").trim()});
      res.status(201).json(sale);
    } catch(error) {
      await restoreInventory(deducted,req.user.id);
      throw error;
    }
  } catch(error){console.error(error);res.status(error.statusCode||500).json({message:error.statusCode?error.message:"Unable to complete POS sale."});}
});

router.get("/orders", async(req,res)=>{try{res.json(await ProductOrder.find({businessOwner:req.user.id}).sort({createdAt:-1}).limit(200).lean());}catch(error){console.error(error);res.status(500).json({message:"Unable to load product orders."});}});
router.patch("/orders/:id/status", async(req,res)=>{try{const status=String(req.body.status||"");if(!["pending","confirmed","processing","completed","cancelled"].includes(status))return res.status(400).json({message:"Invalid order status."});const order=await ProductOrder.findOne({_id:req.params.id,businessOwner:req.user.id});if(!order)return res.status(404).json({message:"Order not found."});if(order.status==="completed"&&status!=="completed")return res.status(409).json({message:"Completed orders cannot be reopened because inventory has already been recorded."});if(status==="completed"&&order.status!=="completed"){const deducted=await deductInventory(order.items,req.user.id);try{order.completedAt=new Date();order.status=status;await order.save();}catch(error){await restoreInventory(deducted,req.user.id);throw error;}return res.json(order);}order.status=status;await order.save();res.json(order);}catch(error){console.error(error);res.status(error.statusCode||500).json({message:error.statusCode?error.message:"Unable to update order."});}});

router.get("/analytics", async (req, res) => {
  try {
    const range = ["today", "7d", "month", "year", "custom", "all"].includes(req.query.range) ? req.query.range : "month";
    const group = ["daily", "weekly", "monthly", "annual"].includes(req.query.group) ? req.query.group : "daily";
    const offset = offsetMinutes(req);
    const bounds = rangeBounds(range, req.query.start, req.query.end, offset);

    const filter = { businessOwner: req.user.id, status: "recorded" };
    if (bounds.start || bounds.end) {
      filter.completedAt = {};
      if (bounds.start) filter.completedAt.$gte = bounds.start;
      if (bounds.end) filter.completedAt.$lt = bounds.end;
    }

    const sales = await Sale.find(filter).sort({ completedAt: -1 }).lean();
    const productBounds = {};
    if (bounds.start) productBounds.$gte = bounds.start;
    if (bounds.end) productBounds.$lt = bounds.end;
    const posFilter = { businessOwner:req.user.id, status:"recorded", ...(Object.keys(productBounds).length ? {soldAt:productBounds} : {}) };
    const orderFilter = { businessOwner:req.user.id, status:"completed", ...(Object.keys(productBounds).length ? {completedAt:productBounds} : {}) };
    const [posSales, productOrders] = await Promise.all([PosSale.find(posFilter).lean(), ProductOrder.find(orderFilter).lean()]);
    const productRecords = [
      ...posSales.map(x=>({id:x._id,source:"pos",completedAt:x.soldAt,customerName:x.customerName||"Walk-in",description:x.items.map(i=>i.name+" × "+i.quantity).join(", "),amount:x.total,currency:x.currency,reference:x.invoiceNumber,status:x.status,paymentMethod:x.paymentMethod||"other"})),
      ...productOrders.map(x=>({id:x._id,source:"online",completedAt:x.completedAt,customerName:x.customerName,description:x.items.map(i=>i.name+" × "+i.quantity).join(", "),amount:x.total,currency:x.currency,reference:x.orderNumber,status:x.status}))
    ];

    const serviceRecords = sales.map(sale => ({
      id: sale._id,
      source: "service",
      completedAt: sale.completedAt,
      amount: Number(sale.saleAmount || 0),
      currency: sale.currency || "PHP",
      category: sale.serviceName || "Service"
    }));
    const analyticsRecords = [
      ...serviceRecords,
      ...productRecords.map(record => ({
        id: record.id,
        source: record.source,
        completedAt: record.completedAt,
        amount: Number(record.amount || 0),
        currency: record.currency || "PHP",
        category: record.source === "pos" ? "POS Products" : "Online Products"
      }))
    ];

    const currencyMap = new Map();
    for (const record of analyticsRecords) {
      const currency = record.currency || "PHP";
      const current = currencyMap.get(currency) || { currency, totalSales: 0, saleCount: 0 };
      current.totalSales += Number(record.amount || 0);
      current.saleCount += 1;
      currencyMap.set(currency, current);
    }

    const totalsByCurrency = [...currencyMap.values()]
      .map(item => ({ ...item, averageSale: item.saleCount ? item.totalSales / item.saleCount : 0 }))
      .sort((a, b) => b.saleCount - a.saleCount || b.totalSales - a.totalSales);
    const primaryCurrency = totalsByCurrency[0]?.currency || "PHP";
    const primary = totalsByCurrency.find(item => item.currency === primaryCurrency) || { totalSales: 0, saleCount: 0, averageSale: 0 };

    const trendMap = new Map();
    const serviceMap = new Map();
    for (const record of analyticsRecords.filter(item => (item.currency || "PHP") === primaryCurrency)) {
      const meta = groupMeta(record.completedAt, group, offset);
      const trend = trendMap.get(meta.key) || { key: meta.key, label: meta.label, revenue: 0, sales: 0 };
      trend.revenue += Number(record.amount || 0);
      trend.sales += 1;
      trendMap.set(meta.key, trend);

      const category = serviceMap.get(record.category) || { service: record.category, revenue: 0, sales: 0 };
      category.revenue += Number(record.amount || 0);
      category.sales += 1;
      serviceMap.set(record.category, category);
    }

    const trend = [...trendMap.values()].sort((a, b) => a.key.localeCompare(b.key));
    const byService = [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);

    const channelMap = new Map();
    for (const record of analyticsRecords.filter(item => (item.currency || "PHP") === primaryCurrency)) {
      const channel = record.source === "service" ? "Service Sales" : record.source === "pos" ? "POS Sales" : "Online Product Sales";
      const current = channelMap.get(channel) || { channel, revenue: 0, sales: 0 };
      current.revenue += Number(record.amount || 0);
      current.sales += 1;
      channelMap.set(channel, current);
    }
    const byChannel = [...channelMap.values()].sort((a,b)=>b.revenue-a.revenue);
    const paymentMap = new Map();
    for (const record of productRecords.filter(item => item.source === "pos" && (item.currency || "PHP") === primaryCurrency)) {
      const method = record.paymentMethod || "other";
      const current = paymentMap.get(method) || { method, revenue: 0, sales: 0 };
      current.revenue += Number(record.amount || 0);
      current.sales += 1;
      paymentMap.set(method, current);
    }
    const byPaymentMethod = [...paymentMap.values()].sort((a,b)=>b.revenue-a.revenue);
    const serviceSalesTotal = sales.filter(x => (x.currency || "PHP") === primaryCurrency).reduce((sum,x)=>sum+Number(x.saleAmount||0),0);

    res.json({
      range,
      group,
      primaryCurrency,
      summary: {
        totalSales: primary.totalSales,
        completedServices: sales.length,
        transactionCount: analyticsRecords.filter(item => (item.currency || "PHP") === primaryCurrency).length,
        averageSale: primary.averageSale,
        servicesSold: new Set(sales.map(item => item.serviceName)).size
      },
      totalsByCurrency,
      trend,
      byService,
      byChannel,
      byPaymentMethod,
      serviceSalesTotal,
      productRecords: productRecords.sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)),
      productSalesTotal: productRecords.filter(x=>(x.currency||"PHP")===primaryCurrency).reduce((sum,x)=>sum+Number(x.amount||0),0),
      records: sales.map(sale => ({
        id: sale._id,
        bookingId: sale.booking,
        completedAt: sale.completedAt,
        bookingDate: sale.bookingDate,
        guestName: sale.guestName,
        guestEmail: sale.guestEmail,
        guestPhone: sale.guestPhone,
        serviceName: sale.serviceName,
        saleAmount: sale.saleAmount,
        currency: sale.currency,
        locationLabel: sale.locationLabel,
        status: sale.status
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load sales analytics." });
  }
});

export default router;
