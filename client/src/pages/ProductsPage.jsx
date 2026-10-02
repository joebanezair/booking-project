import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiMinus, FiPackage, FiPlus, FiShoppingCart, FiTrash2, FiX } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";

function money(value,currency="PHP"){try{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(value||0);}catch{return `${currency} ${Number(value||0).toLocaleString()}`;}}
const blank={name:"",sku:"",description:"",price:"",currency:"PHP",stock:"",published:true,images:[]};
function readProductImages(files,current,done){const remaining=Math.max(0,8-(current||[]).length);const selected=Array.from(files||[]).filter(file=>file.type.startsWith("image/")).slice(0,remaining);if(!selected.length)return;Promise.all(selected.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}))).then(images=>done([...(current||[]),...images]));}

export default function ProductsPage({user,onLogout}){
  const [products,setProducts]=useState([]);
  const [form,setForm]=useState(blank);
  const [creating,setCreating]=useState(false);
  const [editing,setEditing]=useState(null);
  const [selected,setSelected]=useState(null);
  const [quantity,setQuantity]=useState(1);
  const [cart,setCart]=useState({});
  const [paymentMethod,setPaymentMethod]=useState("cash");
  const [customerName,setCustomerName]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function refresh(){setProducts(await api.sales.products());}
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);

  async function addProduct(e){e.preventDefault();try{const item=await api.sales.createProduct(form);setProducts(v=>[item,...v]);setForm(blank);setCreating(false);setMessage("Product created.");setError("");}catch(e){setError(e.message);}}
  async function saveProduct(e){e.preventDefault();try{const item=await api.sales.updateProduct(editing._id,editing);setProducts(v=>v.map(x=>x._id===item._id?item:x));setEditing(null);setMessage("Product updated.");setError("");}catch(e){setError(e.message);}}
  async function removeProduct(item){if(!confirm(`Delete ${item.name}?`))return;try{await api.sales.removeProduct(item._id);setProducts(v=>v.filter(x=>x._id!==item._id));setCart(v=>{const next={...v};delete next[item._id];return next;});setMessage("Product deleted.");}catch(e){setError(e.message);}}

  function openProduct(item){if(item.stock<=0)return;setSelected(item);setQuantity(Math.max(1,Number(cart[item._id]||1)));}
  function addToCart(){if(!selected)return;const qty=Math.min(Number(selected.stock||0),Math.max(1,Number(quantity||1)));setCart(v=>({...v,[selected._id]:qty}));setSelected(null);setMessage(`${selected.name} added to cart.`);}
  function changeCart(id,next,stock){const qty=Math.min(Number(stock||0),Math.max(0,Number(next||0)));setCart(v=>{const copy={...v};if(qty<=0)delete copy[id];else copy[id]=qty;return copy;});}

  const cartLines=useMemo(()=>products.filter(p=>Number(cart[p._id]||0)>0).map(p=>({...p,quantity:Number(cart[p._id])})),[products,cart]);
  const currency=cartLines[0]?.currency||"PHP";
  const cartTotal=cartLines.reduce((sum,p)=>sum+Number(p.price||0)*p.quantity,0);

  async function checkout(){if(!cartLines.length)return setError("Add a product to your cart first.");try{const sale=await api.sales.checkout({items:cartLines.map(p=>({productId:p._id,quantity:p.quantity})),paymentMethod,customerName});setCart({});setCustomerName("");await refresh();setMessage(`Checkout complete. Invoice ${sale.invoiceNumber} recorded in Sales.`);setError("");}catch(e){setError(e.message);}}

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">PRODUCTS & POS</p><h1>Products</h1><p className="muted">Manage inventory, select products, add quantities to the cart, and check out in-store sales.</p></div><div className="cart-header-badge"><FiShoppingCart/><strong>{cartLines.reduce((s,x)=>s+x.quantity,0)}</strong><span>{money(cartTotal,currency)}</span></div></header>
    {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}

    <div className="products-page-grid">
      <section className="panel">
        <div className="panel-title"><div><p className="eyebrow">CATALOG</p><h2>Product inventory</h2></div><div className="row-actions"><span className="count">{products.length}</span><button type="button" className="primary-button" onClick={()=>{setForm(blank);setCreating(true);}}><FiPlus/>Add product</button></div></div>
        <div className="product-shop-grid">{products.map(item=><article key={item._id} className={"product-shop-card "+(item.stock<=0?"out-of-stock":"")} onClick={()=>openProduct(item)} role="button" tabIndex={item.stock>0?0:-1} onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&item.stock>0)openProduct(item);}}>
          <div className="product-shop-image">{(item.images?.[0]||item.image)?<img src={item.images?.[0]||item.image} alt={item.name}/>:<FiPackage/>}</div><div className="product-shop-info"><strong>{item.name}</strong><small>{item.sku||"No SKU"}</small><span>{money(item.price,item.currency)}</span><small>{item.stock>0?`${item.stock} in stock`:"Out of stock"}</small></div>
          <div className="product-card-actions" onClick={e=>e.stopPropagation()}><button className="secondary icon-action" type="button" aria-label="Edit product" data-tooltip="Edit product" onClick={()=>setEditing({...item})}><FiEdit2/></button><button className="secondary icon-action product-delete-button" type="button" aria-label="Delete product" data-tooltip="Delete product" onClick={()=>removeProduct(item)}><FiTrash2/></button></div>
        </article>)}</div>
      </section>

      <aside className="panel products-cart-panel"><div className="panel-title"><div><p className="eyebrow">CART</p><h2>Current sale</h2></div><FiShoppingCart/></div>
        {!cartLines.length?<p className="muted">Click a product to choose a quantity and add it to the cart.</p>:<div className="cart-lines">{cartLines.map(item=><div className="cart-line" key={item._id}><div><strong>{item.name}</strong><small>{money(item.price,item.currency)} each</small></div><div className="cart-quantity"><button type="button" onClick={()=>changeCart(item._id,item.quantity-1,item.stock)}><FiMinus/></button><span>{item.quantity}</span><button type="button" onClick={()=>changeCart(item._id,item.quantity+1,item.stock)}><FiPlus/></button></div><strong>{money(item.price*item.quantity,item.currency)}</strong><button type="button" className="icon-button icon-action" aria-label={"Remove "+item.name} data-tooltip={"Remove "+item.name} onClick={()=>changeCart(item._id,0,item.stock)}><FiX/></button></div>)}</div>}
        <label>Customer name <span className="muted">(optional)</span><input value={customerName} onChange={e=>setCustomerName(e.target.value)}/></label>
        <label>Payment method<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option><option value="card">Card</option><option value="other">Other</option></select></label>
        <div className="pos-total"><span>Total</span><strong>{money(cartTotal,currency)}</strong></div>
        <button className="primary-button checkout-button" type="button" disabled={!cartLines.length} onClick={checkout}>Check out</button>
      </aside>
    </div>

    {creating&&<div className="booking-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false);}}><section className="panel booking-modal product-create-modal" role="dialog" aria-modal="true" aria-label="Add new product"><div className="panel-title"><div><p className="eyebrow">NEW PRODUCT</p><h2>Add product</h2></div><button type="button" className="icon-button icon-action" aria-label="Close" data-tooltip="Close" onClick={()=>setCreating(false)}><FiX/></button></div><form className="product-edit-form" onSubmit={addProduct}><label>Name<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><div className="two-col"><label>SKU<input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})}/></label><label>Currency<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option value="PHP">PHP</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="SGD">SGD</option><option value="CAD">CAD</option></select></label></div><label>Description<textarea rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Product description"/></label><label>Product images <span className="muted">({form.images.length}/8)</span><input type="file" accept="image/*" multiple disabled={form.images.length>=8} onChange={e=>{readProductImages(e.target.files,form.images,images=>setForm({...form,images}));e.target.value="";}}/></label>{form.images.length>0&&<div className="product-image-editor">{form.images.map((src,index)=><div key={index} className="product-image-thumb"><img src={src} alt={`Product ${index+1}`}/><button type="button" className="icon-button icon-action" aria-label="Remove image" data-tooltip="Remove image" onClick={()=>setForm({...form,images:form.images.filter((_,i)=>i!==index)})}><FiX/></button></div>)}</div>}<div className="two-col"><label>Price<input required type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Initial stock<input required type="number" min="0" step="1" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></label></div><label className="check-row"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/>Publish on public profile</label><div className="row-actions"><button className="primary-button"><FiPlus/>Create product</button><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button></div></form></section></div>}

    {selected&&<div className="booking-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="panel booking-modal product-quantity-modal" role="dialog" aria-modal="true" aria-label={"Add "+selected.name+" to cart"}><div className="panel-title"><div><p className="eyebrow">ADD TO CART</p><h2>{selected.name}</h2></div><button type="button" className="icon-button icon-action" aria-label="Close product" data-tooltip="Close" onClick={()=>setSelected(null)}><FiX/></button></div><p>{money(selected.price,selected.currency)} · {selected.stock} available</p><label>Quantity<input autoFocus type="number" min="1" max={selected.stock} value={quantity} onChange={e=>setQuantity(Math.min(selected.stock,Math.max(1,Number(e.target.value||1))))}/></label><div className="pos-total"><span>Subtotal</span><strong>{money(selected.price*quantity,selected.currency)}</strong></div><button type="button" className="primary-button" onClick={addToCart}><FiShoppingCart/>Add to cart</button></section></div>}

    {editing&&<div className="booking-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}><section className="panel booking-modal" role="dialog" aria-modal="true"><div className="panel-title"><h2>Edit product</h2><button type="button" className="icon-button icon-action" aria-label="Close editor" data-tooltip="Close" onClick={()=>setEditing(null)}><FiX/></button></div><form className="product-edit-form" onSubmit={saveProduct}><label>Name<input required value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label>SKU<input value={editing.sku||""} onChange={e=>setEditing({...editing,sku:e.target.value})}/></label><label>Description<textarea value={editing.description||""} onChange={e=>setEditing({...editing,description:e.target.value})}/></label><label>Product images <span className="muted">({(editing.images||[]).length}/8)</span><input type="file" accept="image/*" multiple disabled={(editing.images||[]).length>=8} onChange={e=>{readProductImages(e.target.files,editing.images||[],images=>setEditing({...editing,images}));e.target.value="";}}/></label>{(editing.images||[]).length>0&&<div className="product-image-editor">{editing.images.map((src,index)=><div key={index} className="product-image-thumb"><img src={src} alt={`Product ${index+1}`}/><button type="button" className="icon-button icon-action" aria-label="Remove image" data-tooltip="Remove image" onClick={()=>setEditing({...editing,images:editing.images.filter((_,i)=>i!==index)})}><FiX/></button></div>)}</div>}<div className="two-col"><label>Price<input type="number" min="0" step="0.01" value={editing.price} onChange={e=>setEditing({...editing,price:e.target.value})}/></label><label>Stock<input type="number" min="0" value={editing.stock} onChange={e=>setEditing({...editing,stock:e.target.value})}/></label></div><label className="check-row"><input type="checkbox" checked={!!editing.published} onChange={e=>setEditing({...editing,published:e.target.checked})}/>Published</label><div className="row-actions"><button className="primary-button">Save changes</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancel</button></div></form></section></div>}
  </AppLayout>;
}
