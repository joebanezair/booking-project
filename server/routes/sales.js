import { Router } from "express";
import Sale, { Product, PosSale } from "../models/Sale.js";
import requireAuth from "../middleware/auth.js";
import { requireBusiness } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth, requireBusiness);

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


router.get("/products", async (req,res) => {
  try { res.json(await Product.find({user:req.user.id}).sort({updatedAt:-1})); }
  catch (error) { console.error(error); res.status(500).json({message:"Unable to load products."}); }
});
router.post("/products", async (req,res) => {
  try {
    const name=String(req.body.name||"").trim();
    if(!name) return res.status(400).json({message:"Product name is required."});
    const product=await Product.create({user:req.user.id,name,sku:String(req.body.sku||"").trim(),description:String(req.body.description||"").trim(),price:Math.max(0,Number(req.body.price||0)),currency:String(req.body.currency||"PHP").toUpperCase().slice(0,3),stock:Math.max(0,Math.floor(Number(req.body.stock||0))),published:Boolean(req.body.published)});
    res.status(201).json(product);
  } catch(error) { console.error(error); res.status(500).json({message:"Unable to create product."}); }
});

router.put("/products/:id", async (req,res) => {
  try {
    const name=String(req.body.name||"").trim();
    if(!name) return res.status(400).json({message:"Product name is required."});
    const product=await Product.findOneAndUpdate({_id:req.params.id,user:req.user.id},{$set:{name,sku:String(req.body.sku||"").trim(),description:String(req.body.description||"").trim(),price:Math.max(0,Number(req.body.price||0)),currency:String(req.body.currency||"PHP").toUpperCase().slice(0,3),stock:Math.max(0,Math.floor(Number(req.body.stock||0))),published:Boolean(req.body.published)}},{new:true,runValidators:true});
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
    for(const line of lines){
      const changed=await Product.findOneAndUpdate({_id:line.product,user:req.user.id,stock:{$gte:line.quantity}},{$inc:{stock:-line.quantity}},{new:true});
      if(!changed)return res.status(409).json({message:"Stock changed during checkout. Refresh and try again."});
    }
    const payment=["cash","gcash","maya","card","other"].includes(req.body.paymentMethod)?req.body.paymentMethod:"cash";
    const invoiceNumber="BFI-"+new Date().getFullYear()+"-"+Date.now();
    const sale=await PosSale.create({businessOwner:req.user.id,invoiceNumber,items:lines,total,currency,paymentMethod:payment,customerName:String(req.body.customerName||"").trim()});
    res.status(201).json(sale);
  } catch(error){console.error(error);res.status(500).json({message:"Unable to complete POS sale."});}
});

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

    const currencyMap = new Map();
    for (const sale of sales) {
      const currency = sale.currency || "PHP";
      const current = currencyMap.get(currency) || { currency, totalSales: 0, saleCount: 0 };
      current.totalSales += Number(sale.saleAmount || 0);
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
    for (const sale of sales.filter(item => (item.currency || "PHP") === primaryCurrency)) {
      const meta = groupMeta(sale.completedAt, group, offset);
      const trend = trendMap.get(meta.key) || { key: meta.key, label: meta.label, revenue: 0, sales: 0 };
      trend.revenue += Number(sale.saleAmount || 0);
      trend.sales += 1;
      trendMap.set(meta.key, trend);

      const serviceKey = sale.serviceName || "Service";
      const service = serviceMap.get(serviceKey) || { service: serviceKey, revenue: 0, sales: 0 };
      service.revenue += Number(sale.saleAmount || 0);
      service.sales += 1;
      serviceMap.set(serviceKey, service);
    }

    const trend = [...trendMap.values()].sort((a, b) => a.key.localeCompare(b.key));
    const byService = [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);

    res.json({
      range,
      group,
      primaryCurrency,
      summary: {
        totalSales: primary.totalSales,
        completedServices: sales.length,
        averageSale: primary.averageSale,
        servicesSold: new Set(sales.map(item => item.serviceName)).size
      },
      totalsByCurrency,
      trend,
      byService,
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
