import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiMapPin, FiMessageSquare, FiShoppingBag, FiUserPlus, FiUserCheck, FiX } from "react-icons/fi";
import { api } from "../api.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import ContentCard from "../components/ContentCard.jsx";
import { RatingInput, RatingSummary } from "../components/StarRating.jsx";
import { Button } from "../components/ui/button.jsx";

export default function PublicProfilePage({ user }) {
  const { username } = useParams();
  const resolvedUsername = username || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [orderProduct,setOrderProduct]=useState(null);
  const [orderForm,setOrderForm]=useState({quantity:1,customerName:"",customerEmail:"",customerPhone:"",deliveryLocation:"",notes:""});
  const [orderMessage,setOrderMessage]=useState("");
  const [productGallery,setProductGallery]=useState(null);
  const [galleryIndex,setGalleryIndex]=useState(0);

  useEffect(() => {
    api.publicProfile(resolvedUsername).then(result => {
      setData(result);
      setError("");
    }).catch(e => setError(e.message));
  }, [resolvedUsername]);

  async function rateBusiness(value) {
    try {
      await api.ratings.setBusiness(data.profile.businessId, value);
      const refreshed = await api.publicProfile(resolvedUsername);
      setData(refreshed); setRatingMessage("Business rating saved."); setError("");
    } catch (e) { setError(e.message); }
  }
  async function removeBusinessRating() {
    try {
      await api.ratings.removeBusiness(data.profile.businessId);
      const refreshed = await api.publicProfile(resolvedUsername);
      setData(refreshed); setRatingMessage("Business rating removed."); setError("");
    } catch (e) { setError(e.message); }
  }

  async function submitProductOrder(event){event.preventDefault();try{const result=await api.publicProductOrder(profile.id,{items:[{productId:orderProduct._id,quantity:Number(orderForm.quantity)}],customerName:orderForm.customerName,customerEmail:orderForm.customerEmail,customerPhone:orderForm.customerPhone,deliveryLocation:orderForm.deliveryLocation,notes:orderForm.notes});setOrderMessage(`Order ${result.orderNumber} sent successfully.`);setOrderProduct(null);setOrderForm({quantity:1,customerName:"",customerEmail:"",customerPhone:"",deliveryLocation:"",notes:""});setError("");}catch(e){setError(e.message);}}

  async function friendAction(action) {
    if (!data?.profile?.id || friendBusy) return;
    setFriendBusy(true); setError("");
    try {
      if (action === "add") await api.messages.addFriend(data.profile.id);
      if (action === "accept") await api.messages.acceptFriend(data.profile.id);
      if (action === "unfriend") await api.messages.unfriend(data.profile.id);
      const refreshed = await api.publicProfile(resolvedUsername);
      setData(refreshed);
    } catch (e) { setError(e.message); }
    finally { setFriendBusy(false); }
  }

  if (error) return <main className="public-shell"><section className="public-card"><p className="error">{error}</p></section></main>;
  if (!data) return <main className="public-shell"><section className="public-card">Loading...</section></main>;

  const { profile, content, products = [], reviews = [] } = data;
  const isOwner = user && String(user.id) === String(profile.id);
  const friendship = profile.friendship || {};
  const canMessage = user && !isOwner && ["business", "admin"].includes(user.role) && (user.role === "admin" || friendship.isFriend);
  const conversationPath = `/dashboard/messages/${profile.id}`;
  const paused = profile.accountStatus === "paused";

  return <main className="public-page">
    <header className="public-top"><Link className="brand-row" to="/search"><span className="brand-mark small">B</span><strong>BookFlow</strong></Link></header>

    <section className={`public-profile-hero ${profile.coverImage ? "has-cover" : ""}`}>
      {profile.coverImage && <div className="public-cover" style={{ backgroundImage: `url(${profile.coverImage})` }} />}
      <div className="public-profile-info">
        <ProfileAvatar profile={profile} size="xl" />
        <div className="public-profile-copy">
          <p className="eyebrow">BUSINESS PROFILE</p>
          <div className="profile-title-row">
            <h1>{profile.name}</h1>
            {user && !isOwner && <div className="public-profile-actions">
              {friendship.incomingRequest ? <button className="primary-button icon-link" disabled={friendBusy} onClick={() => friendAction("accept")}><FiUserPlus aria-hidden="true" />Accept Friend</button> :
               friendship.isFriend ? <button className="secondary icon-link" disabled={friendBusy} onClick={() => friendAction("unfriend")}><FiUserCheck aria-hidden="true" />Friends</button> :
               <button className="primary-button icon-link" disabled={friendBusy || friendship.requestSent || friendship.blocked} onClick={() => friendAction("add")}><FiUserPlus aria-hidden="true" />{friendship.requestSent ? "Request Sent" : "Add Friend"}</button>}
              {canMessage && <Link className="secondary button-link icon-link" to={conversationPath}><FiMessageSquare aria-hidden="true" />Message</Link>}
            </div>}
          </div>
          {paused && <div className="paused-public-banner">Temporarily unavailable — this business is not accepting new bookings right now.</div>}
          {profile.headline && <p className="profile-headline">{profile.headline}</p>}
          <div className="business-rating-block">
            <div className="verified-rating-row"><RatingSummary {...profile.businessRatingSummary} /><span className="verified-badge">Business rating</span></div>
            {user && !isOwner && <div className="profile-rating-control"><span>Your rating</span><RatingInput value={profile.currentUserBusinessRating || 0} onChange={rateBusiness} />{profile.currentUserBusinessRating && <button type="button" className="link-button" onClick={removeBusinessRating}>Remove rating</button>}</div>}
            {!user && <small className="muted">Sign in to rate this business.</small>}
            {ratingMessage && <small className="success">{ratingMessage}</small>}
          </div>
          <div className="verified-rating-row"><RatingSummary {...profile.ratingSummary} /><span className="verified-badge">Verified booking reviews</span></div>
          {profile.bio && <p className="public-bio">{profile.bio}</p>}
          <div className="profile-meta">
            {profile.location && <span>{profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer">Website</a>}
            {!paused && <Link to={`/b/${profile.id}`}>Book a session</Link>}
          </div>
        </div>
      </div>
    </section>

    <section className="public-content-section">
      <div className="section-heading"><div><p className="eyebrow">PUBLIC SERVICES</p><h2>Explore {profile.name}&apos;s services</h2></div></div>
      {content.length === 0 ? <div className="panel empty-state"><p className="muted">No public services yet.</p></div> :
        <div className="content-grid">{content.map(item => <Link key={item._id} to={`/services/${item._id}`} className="content-card-link"><ContentCard item={item} /></Link>)}</div>}
    </section>

    <section className="public-content-section">
      <div className="section-heading"><div><p className="eyebrow">PRODUCTS</p><h2>Shop {profile.name}&apos;s products</h2></div></div>
      {products.length === 0 ? <div className="panel empty-state"><p className="muted">No public products yet.</p></div> :
        <div className="content-grid">{products.map(product => {const images=(product.images?.length?product.images:(product.image?[product.image]:[]));return <article className="panel public-product-card" key={product._id}><button type="button" className="public-product-media" disabled={!images.length} aria-label={images.length>1?`View ${images.length} images for ${product.name}`:`View image for ${product.name}`} onClick={()=>{if(images.length){setProductGallery({...product,images});setGalleryIndex(0);}}}>{images.length?<><img src={images[0]} alt={product.name}/>{images.length>1&&<span className="image-count-badge">1 / {images.length}</span>}</>:<span className="product-image-placeholder"><FiShoppingBag/></span>}</button><div className="public-product-body"><h3>{product.name}</h3>{product.description && <p className="muted">{product.description}</p>}<strong>{product.currency} {Number(product.price || 0).toLocaleString()}</strong><small>{product.stock > 0 ? product.stock + " in stock" : "Out of stock"}</small></div><Button className="public-order-button" disabled={product.stock<1||paused} onClick={()=>{setOrderProduct(product);setOrderForm({...orderForm,quantity:1});}}><FiShoppingBag/>Order product</Button></article>})}</div>}
      {orderMessage && <p className="success">{orderMessage}</p>}
      {orderProduct && <div className="booking-modal-backdrop" onClick={()=>setOrderProduct(null)}><section className="panel booking-editor-panel booking-modal" onClick={e=>e.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">PRODUCT ORDER</p><h2>{orderProduct.name}</h2></div><Button type="button" variant="outline" size="icon" className="icon-action" aria-label="Close order" data-tooltip="Close" onClick={()=>setOrderProduct(null)}><FiX/></Button></div><form onSubmit={submitProductOrder}><label>Quantity<input type="number" min="1" max={orderProduct.stock} required value={orderForm.quantity} onChange={e=>setOrderForm({...orderForm,quantity:e.target.value})}/></label><label>Name<input required value={orderForm.customerName} onChange={e=>setOrderForm({...orderForm,customerName:e.target.value})}/></label><label>Phone<input required value={orderForm.customerPhone} onChange={e=>setOrderForm({...orderForm,customerPhone:e.target.value})}/></label><label>Email<input type="email" value={orderForm.customerEmail} onChange={e=>setOrderForm({...orderForm,customerEmail:e.target.value})}/></label><label>Delivery location <span className="required-mark">*</span><div className="location-input-wrap"><FiMapPin aria-hidden="true"/><input required maxLength="250" autoComplete="street-address" placeholder="Street, barangay, city / delivery address" value={orderForm.deliveryLocation} onChange={e=>setOrderForm({...orderForm,deliveryLocation:e.target.value})}/></div></label><label>Notes<textarea value={orderForm.notes} onChange={e=>setOrderForm({...orderForm,notes:e.target.value})}/></label><strong>Total: {orderProduct.currency} {(Number(orderProduct.price||0)*Number(orderForm.quantity||1)).toLocaleString()}</strong><Button className="public-place-order"><FiShoppingBag/>Place order</Button></form></section></div>}
    </section>

    {productGallery&&<div className="booking-modal-backdrop product-gallery-backdrop" onClick={()=>setProductGallery(null)}><section className="ui-card public-product-gallery" role="dialog" aria-modal="true" aria-label={productGallery.name+" images"} onClick={e=>e.stopPropagation()}><div className="public-gallery-head"><div><p className="eyebrow">PRODUCT GALLERY</p><h2>{productGallery.name}</h2></div><Button variant="outline" size="icon" className="icon-action" aria-label="Close gallery" data-tooltip="Close" onClick={()=>setProductGallery(null)}><FiX/></Button></div><div className="public-gallery-stage"><img src={productGallery.images[galleryIndex]} alt={productGallery.name+" image "+(galleryIndex+1)}/>{productGallery.images.length>1&&<><Button variant="outline" size="icon" className="gallery-arrow gallery-prev" aria-label="Previous image" onClick={()=>setGalleryIndex(i=>(i-1+productGallery.images.length)%productGallery.images.length)}><FiChevronLeft/></Button><Button variant="outline" size="icon" className="gallery-arrow gallery-next" aria-label="Next image" onClick={()=>setGalleryIndex(i=>(i+1)%productGallery.images.length)}><FiChevronRight/></Button></>}</div>{productGallery.images.length>1&&<div className="public-gallery-thumbs">{productGallery.images.map((src,index)=><button type="button" key={index} className={index===galleryIndex?"active":""} aria-label={"View image "+(index+1)} onClick={()=>setGalleryIndex(index)}><img src={src} alt=""/></button>)}</div>}<div className="public-gallery-footer"><span>{galleryIndex+1} of {productGallery.images.length}</span><Button onClick={()=>{setOrderProduct(productGallery);setOrderForm({...orderForm,quantity:1});setProductGallery(null);}}><FiShoppingBag/>Order product</Button></div></section></div>}

    <section className="public-content-section verified-reviews-section">
      <div className="section-heading"><div><p className="eyebrow">VERIFIED REVIEWS</p><h2>Reviews from completed BookFlow bookings</h2></div></div>
      {reviews.length === 0 ? <div className="panel empty-state"><p className="muted">No verified reviews yet.</p></div> :
        <div className="verified-review-list">{reviews.map(review => <article className="panel verified-review-card" key={review._id}><RatingSummary averageRating={review.rating} ratingCount={1} />{review.comment && <p>{review.comment}</p>}<small>Verified booking · {new Date(review.submittedAt).toLocaleDateString()}</small></article>)}</div>}
    </section>
  </main>;
}
