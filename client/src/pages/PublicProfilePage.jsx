import { Card } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Label } from "../components/ui/label.jsx";
import { Image } from "../components/ui/image.jsx";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FiCalendar, FiCheckCircle, FiChevronLeft, FiChevronRight, FiMapPin, FiMessageSquare, FiShoppingBag, FiStar, FiUserPlus, FiUserCheck, FiX } from "react-icons/fi";
import { api } from "../api.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import ContentCard from "../components/ContentCard.jsx";
import ProfileCatalogSearch from "../components/ProfileCatalogSearch.jsx";
import { RatingInput, RatingSummary } from "../components/StarRating.jsx";
import { Button } from "../components/ui/button.jsx";

export default function PublicProfilePage({ user }) {
  const { username } = useParams();
  const [searchParams] = useSearchParams();
  const resolvedUsername = username || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [orderProduct,setOrderProduct]=useState(null);
  const [orderForm,setOrderForm]=useState({quantity:1,customerName:"",customerEmail:"",customerPhone:"",deliveryLocation:"",notes:""});
  const [orderMessage,setOrderMessage]=useState("");
  const [orderTrackingLink,setOrderTrackingLink]=useState("");
  const [orderBusy,setOrderBusy]=useState(false);
  const orderLock=useRef(false);
  const [productGallery,setProductGallery]=useState(null);
  const [galleryIndex,setGalleryIndex]=useState(0);
  const [detailProduct,setDetailProduct]=useState(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogType, setCatalogType] = useState("all");
  const [minServiceRating, setMinServiceRating] = useState("0");

  useEffect(() => {
    setCatalogSearch("");
    setCatalogType("all");
    setMinServiceRating("0");
    api.publicProfile(resolvedUsername).then(result => {
      setData(result);
      setError("");
    }).catch(e => setError(e.message));
  }, [resolvedUsername]);

  useEffect(() => {
    if (!data) return;
    const selected = (data.products || []).find(product => String(product._id) === searchParams.get("product"));
    setDetailProduct(selected || null);
  }, [data, searchParams]);

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

  async function submitProductOrder(event){event.preventDefault();if(orderLock.current)return;orderLock.current=true;setOrderBusy(true);setError("");try{const result=await api.publicProductOrder(profile.id,{items:[{productId:orderProduct._id,quantity:Number(orderForm.quantity)}],customerName:orderForm.customerName,customerEmail:orderForm.customerEmail,customerPhone:orderForm.customerPhone,deliveryLocation:orderForm.deliveryLocation,notes:orderForm.notes});setOrderMessage(`Order ${result.orderNumber} sent successfully.`);setOrderTrackingLink(`/order-status/${result.id}#${result.trackingToken}`);setOrderProduct(null);setOrderForm({quantity:1,customerName:"",customerEmail:"",customerPhone:"",deliveryLocation:"",notes:""});setError("");}catch(e){setError(e.message);}finally{orderLock.current=false;setOrderBusy(false);}}

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

  if (error && !data) return <main className="public-shell"><section className="public-card"><p className="error" role="alert">{error}</p></section></main>;
  if (!data) return <main className="public-shell"><section className="public-card">Loading...</section></main>;

  const { profile, content, products = [], reviews = [] } = data;
  const isOwner = user && String(user.id) === String(profile.id);
  const friendship = profile.friendship || {};
  const canMessage = user && !isOwner && ["business", "admin"].includes(user.role) && (user.role === "admin" || friendship.isFriend);
  const conversationPath = `/dashboard/messages/${profile.id}`;
  const paused = profile.accountStatus === "paused";
  const normalizedSearch = catalogSearch.trim().toLocaleLowerCase();
  const visibleServices = content.filter(item =>
    (!normalizedSearch || [item.title, item.description, item.category].some(value =>
      String(value || "").toLocaleLowerCase().includes(normalizedSearch))) &&
    (minServiceRating === "0" ||
      (Number(item.ratingCount || 0) > 0 && Number(item.averageRating || 0) >= Number(minServiceRating)))
  );
  // Products do not expose item ratings, so the rating control applies to services only.
  const visibleProducts = products.filter(item =>
    !normalizedSearch || [item.name, item.description, item.sku].some(value =>
      String(value || "").toLocaleLowerCase().includes(normalizedSearch))
  );
  const totalMatches = catalogType === "services" ? visibleServices.length :
    catalogType === "products" ? visibleProducts.length : visibleServices.length + visibleProducts.length;
  const totalOfferings = catalogType === "services" ? content.length :
    catalogType === "products" ? products.length : content.length + products.length;
  const filtering = Boolean(normalizedSearch || minServiceRating !== "0");
  const noMatches = totalMatches === 0 && (Boolean(normalizedSearch) || minServiceRating !== "0" || catalogType !== "all");
  const showServices = !noMatches && catalogType !== "products" &&
    (catalogType === "services" || !filtering || visibleServices.length > 0);
  const showProducts = !noMatches && catalogType !== "services" &&
    (catalogType === "products" || !normalizedSearch || visibleProducts.length > 0);

  return <main className="public-page bookflow-storefront" id="storefront-top">
    {error && <p className="error" role="alert">{error}</p>}

    <section className={`public-profile-hero storefront-hero ${profile.coverImage ? "has-cover" : ""}`} aria-label={profile.name+" business profile"}>
      <div className={`public-cover storefront-cover${profile.coverImage?"":" storefront-cover-empty"}`}>
        <Link to="/search" className="storefront-cover-brand" aria-label="BookFlow home" title="BookFlow home">
          <span className="brand-mark small" aria-hidden="true">B</span>
        </Link>
        {profile.coverImage ? <Image className="ui-profile-cover-image" src={profile.coverImage} alt={profile.name+" cover photo"} decoding="async"/> : <div className="storefront-cover-placeholder" aria-hidden="true"/>}
      </div>
      <div className="public-profile-info storefront-profile-info storefront-container">
        <ProfileAvatar profile={profile} size="xl" />
        <div className="public-profile-copy">
          <div className="profile-title-row storefront-title-row">
            <div className="storefront-name-block">
              <h1>{profile.name}</h1>
              <span className="storefront-handle">@{profile.username||resolvedUsername}</span>
            </div>
            <div className="storefront-owner-actions">
              {user && !isOwner && <div className="public-profile-actions">
                {friendship.incomingRequest ? <Button variant="plain" className="primary-button icon-link" disabled={friendBusy} onClick={() => friendAction("accept")}><FiUserPlus aria-hidden="true" />Accept Friend</Button> :
                 friendship.isFriend ? <Button variant="plain" className="secondary icon-link" disabled={friendBusy} onClick={() => friendAction("unfriend")}><FiUserCheck aria-hidden="true" />Friends</Button> :
                 <Button variant="plain" className="primary-button icon-link" disabled={friendBusy || friendship.requestSent || friendship.blocked} onClick={() => friendAction("add")}><FiUserPlus aria-hidden="true" />{friendship.requestSent ? "Request Sent" : "Add Friend"}</Button>}
                {canMessage && <Button asChild variant="outline"><Link className="secondary button-link icon-link" to={conversationPath}><FiMessageSquare aria-hidden="true" />Message</Link></Button>}
              </div>}
              {!paused && <Button asChild variant="default"><Link className="public-book-session-button storefront-book-button" to={`/b/${profile.id}`}><FiCalendar aria-hidden="true" /><span>BOOK A SESSION</span></Link></Button>}
            </div>
          </div>
          {paused && <div className="paused-public-banner">Temporarily unavailable — this business is not accepting new bookings right now.</div>}
          {profile.headline && <p className="profile-headline">{profile.headline}</p>}
          <div className="profile-reputation-panel">
            <div className="profile-reputation-row">
              <div className="profile-reputation-copy"><span className="profile-reputation-title">Business rating</span><span className="profile-reputation-subtitle">Ratings from visitors</span></div>
              <RatingSummary {...profile.businessRatingSummary} />
            </div>
            {(user && !isOwner || ratingMessage) && <div className="business-rating-card">
              {user && !isOwner && <div className="profile-rating-control"><span className="profile-rating-label">Your rating</span><div className="profile-rating-actions"><RatingInput value={profile.currentUserBusinessRating || 0} onChange={rateBusiness} />{profile.currentUserBusinessRating && <Button variant="plain" type="button" className="link-button remove-business-rating" onClick={removeBusinessRating} aria-label="Remove rating"><FiX aria-hidden="true"/><span>Remove rating</span></Button>}</div></div>}
              {ratingMessage && <small className="success business-rating-feedback"><FiCheckCircle aria-hidden="true"/>{ratingMessage}</small>}
            </div>}
            {!user && <small className="muted">Sign in to rate this business.</small>}
            <div className="profile-reputation-row profile-reputation-reviews">
              <div className="profile-reputation-copy"><span className="profile-reputation-title">Verified booking reviews</span><span className="profile-reputation-subtitle">Reviews from completed bookings</span></div>
              <RatingSummary {...profile.ratingSummary} />
            </div>
          </div>
          {profile.bio && <p className="public-bio">{profile.bio}</p>}
          <div className="profile-meta storefront-meta">
            {profile.location && <span><FiMapPin aria-hidden="true"/>{profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer">Website</a>}
          </div>
        </div>
      </div>
    </section>

    <nav className="storefront-section-nav" aria-label="Business profile sections">
      <div className="storefront-container storefront-section-links">
        <a href="#storefront-top">Overview</a>
        <a href="#storefront-services" onClick={event=>{event.preventDefault();setCatalogType("services");setCatalogSearch("");setMinServiceRating("0");requestAnimationFrame(()=>document.getElementById("storefront-services")?.scrollIntoView({behavior:"smooth",block:"start"}));}}>Services <span>{content.length}</span></a>
        <a href="#storefront-products" onClick={event=>{event.preventDefault();setCatalogType("products");setCatalogSearch("");setMinServiceRating("0");requestAnimationFrame(()=>document.getElementById("storefront-products")?.scrollIntoView({behavior:"smooth",block:"start"}));}}>Products <span>{products.length}</span></a>
        <a href="#storefront-reviews">Reviews <span>{reviews.length}</span></a>
      </div>
    </nav>

    <section className="public-content-section profile-catalog-filter-section storefront-filter-section storefront-container" aria-label="Search and filter offerings">
      <ProfileCatalogSearch
        value={catalogSearch}
        onChange={setCatalogSearch}
        classification={catalogType}
        onClassificationChange={next => {
          setCatalogType(next);
          if (next === "products") setMinServiceRating("0");
        }}
        minRating={minServiceRating}
        onRatingChange={setMinServiceRating}
        matchingCount={totalMatches}
        totalCount={totalOfferings}
      />
      {noMatches && <div className="panel empty-state" role="status"><p className="muted">{catalogType === "services" ? "No services match these filters." : catalogType === "products" ? "No products match these filters." : "No products or services match these filters."}</p></div>}
    </section>

    <section id="storefront-services" className="public-content-section storefront-offerings-section storefront-services storefront-container" hidden={!showServices}>
      <div className="section-heading storefront-section-heading">
        <div><p className="eyebrow">PUBLIC SERVICES</p><h2>Explore our services</h2><p className="storefront-section-description muted">Browse services offered by {profile.name}.</p></div>
        <span className="storefront-section-count">{visibleServices.length} services</span>
      </div>
      {content.length === 0 ? <div className="panel empty-state"><p className="muted">No public services yet.</p></div> :
        visibleServices.length === 0 ? <div className="panel empty-state" role="status"><p className="muted">No services match your search.</p></div> :
        <div className="content-grid public-services-grid">{visibleServices.map(item => <Link key={item._id} to={`/services/${item._id}`} className="content-card-link"><ContentCard item={item} /></Link>)}</div>}
    </section>

    <section id="storefront-products" className="public-content-section public-profile-products storefront-offerings-section storefront-products storefront-container" hidden={!showProducts}>
      <div className="section-heading storefront-section-heading">
        <div><p className="eyebrow">PRODUCT CATALOG</p><h2>Shop products</h2><p className="storefront-section-description muted">Discover products available to order from {profile.name}.</p></div>
        <span className="storefront-section-count">{visibleProducts.length} products</span>
      </div>
      {products.length === 0 ? <div className="panel empty-state"><p className="muted">No public products yet.</p></div> :
        visibleProducts.length === 0 ? <div className="panel empty-state" role="status"><p className="muted">No products match your search.</p></div> :
        <div className="content-grid">{visibleProducts.map(product => {const images=(product.images?.length?product.images:(product.image?[product.image]:[]));return <Card as="article" className="panel public-product-card" key={product._id}><Button variant="plain" type="button" className="public-product-media" disabled={!images.length} aria-label={images.length>1?`View ${images.length} images for ${product.name}`:`View image for ${product.name}`} onClick={()=>{if(images.length){setProductGallery({...product,images});setGalleryIndex(0);}}}>{images.length?<><Image src={images[0]} alt={product.name}/>{images.length>1&&<span className="image-count-badge">1 / {images.length}</span>}</>:<span className="product-image-placeholder"><FiShoppingBag/></span>}</Button><div className="public-product-body"><h3>{product.name}</h3>{product.description && <p className="muted">{product.description}</p>}<strong>{product.currency} {Number(product.price || 0).toLocaleString()}</strong><small>{product.stock > 0 ? product.stock + " in stock" : "Out of stock"}</small></div><Button className="public-order-button" disabled={product.stock<1||paused} onClick={()=>{setOrderProduct(product);setOrderForm({...orderForm,quantity:1});}}><FiShoppingBag/>Order product</Button></Card>})}</div>}

    </section>

      {orderMessage && <div className="panel order-success-notice" role="status"><p className="success">{orderMessage}</p>{orderTrackingLink&&<><Link className="ui-button ui-button-outline order-track-link" to={orderTrackingLink}>View order status</Link><p className="muted">Save this private tracking link. Anyone who has it can view your order status.</p></>}</div>}
      {orderProduct && <div className="booking-modal-backdrop" onClick={()=>setOrderProduct(null)}><section className="panel booking-editor-panel booking-modal" onClick={e=>e.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">PRODUCT ORDER</p><h2>{orderProduct.name}</h2></div><Button type="button" variant="outline" size="icon" className="icon-action" aria-label="Close order" data-tooltip="Close" onClick={()=>setOrderProduct(null)}><FiX/></Button></div><form onSubmit={submitProductOrder}><Label>Quantity<Input type="number" min="1" max={orderProduct.stock} required value={orderForm.quantity} onChange={e=>setOrderForm({...orderForm,quantity:e.target.value})}/></Label><Label>Name<Input required value={orderForm.customerName} onChange={e=>setOrderForm({...orderForm,customerName:e.target.value})}/></Label><Label>Phone<Input required value={orderForm.customerPhone} onChange={e=>setOrderForm({...orderForm,customerPhone:e.target.value})}/></Label><Label>Email<Input type="email" value={orderForm.customerEmail} onChange={e=>setOrderForm({...orderForm,customerEmail:e.target.value})}/></Label><Label>Delivery location <span className="required-mark">*</span><div className="location-input-wrap"><FiMapPin aria-hidden="true"/><Input required maxLength="250" autoComplete="street-address" placeholder="Street, barangay, city / delivery address" value={orderForm.deliveryLocation} onChange={e=>setOrderForm({...orderForm,deliveryLocation:e.target.value})}/></div></Label><Label>Notes<Textarea value={orderForm.notes} onChange={e=>setOrderForm({...orderForm,notes:e.target.value})}/></Label><strong>Total: {orderProduct.currency} {(Number(orderProduct.price||0)*Number(orderForm.quantity||1)).toLocaleString()}</strong>{error && <p className="error" role="alert">{error}</p>}<Button type="submit" className="public-place-order" disabled={orderBusy}><FiShoppingBag/>{orderBusy?"Placing order…":"Place order"}</Button></form></section></div>}

    {detailProduct&&<div className="booking-modal-backdrop product-gallery-backdrop" onClick={()=>setDetailProduct(null)}><section className="ui-card public-product-gallery search-product-details" role="dialog" aria-modal="true" aria-label={detailProduct.name+" details"} onClick={e=>e.stopPropagation()}><div className="public-gallery-head"><div><p className="eyebrow">PRODUCT DETAILS</p><h2>{detailProduct.name}</h2></div><Button variant="outline" size="icon" aria-label="Close product details" onClick={()=>setDetailProduct(null)}><FiX/></Button></div><div className="public-gallery-stage">{(detailProduct.images?.[0]||detailProduct.image)?<Image src={detailProduct.images?.[0]||detailProduct.image} alt={detailProduct.name}/>:<span className="product-image-placeholder"><FiShoppingBag/></span>}</div><div className="public-product-body"><p>{detailProduct.description||"No description available."}</p><strong>{detailProduct.currency||"PHP"} {Number(detailProduct.price||0).toLocaleString()}</strong><small>{detailProduct.stock>0?detailProduct.stock+" in stock":"Out of stock"}</small><p>Sold by {profile.name}</p></div><div className="public-gallery-footer"><Button variant="outline" onClick={()=>{const images=detailProduct.images?.length?detailProduct.images:(detailProduct.image?[detailProduct.image]:[]);if(images.length){setProductGallery({...detailProduct,images});setGalleryIndex(0);setDetailProduct(null);}}} disabled={!(detailProduct.images?.length||detailProduct.image)}>View images</Button><Button disabled={detailProduct.stock<1||paused} onClick={()=>{setOrderProduct(detailProduct);setOrderForm({...orderForm,quantity:1});setDetailProduct(null);}}><FiShoppingBag/>Order product</Button></div></section></div>}
    {productGallery&&<div className="booking-modal-backdrop product-gallery-backdrop" onClick={()=>setProductGallery(null)}><section className="ui-card public-product-gallery" role="dialog" aria-modal="true" aria-label={productGallery.name+" images"} onClick={e=>e.stopPropagation()}><div className="public-gallery-head"><div><p className="eyebrow">PRODUCT GALLERY</p><h2>{productGallery.name}</h2></div><Button variant="outline" size="icon" className="icon-action" aria-label="Close gallery" data-tooltip="Close" onClick={()=>setProductGallery(null)}><FiX/></Button></div><div className="public-gallery-stage"><Image src={productGallery.images[galleryIndex]} alt={productGallery.name+" image "+(galleryIndex+1)}/>{productGallery.images.length>1&&<><Button variant="outline" size="icon" className="gallery-arrow gallery-prev" aria-label="Previous image" onClick={()=>setGalleryIndex(i=>(i-1+productGallery.images.length)%productGallery.images.length)}><FiChevronLeft/></Button><Button variant="outline" size="icon" className="gallery-arrow gallery-next" aria-label="Next image" onClick={()=>setGalleryIndex(i=>(i+1)%productGallery.images.length)}><FiChevronRight/></Button></>}</div>{productGallery.images.length>1&&<div className="public-gallery-thumbs">{productGallery.images.map((src,index)=><Button variant="plain" type="button" key={index} className={index===galleryIndex?"active":""} aria-label={"View image "+(index+1)} onClick={()=>setGalleryIndex(index)}><Image src={src} alt=""/></Button>)}</div>}<div className="public-gallery-footer"><span>{galleryIndex+1} of {productGallery.images.length}</span><Button onClick={()=>{setOrderProduct(productGallery);setOrderForm({...orderForm,quantity:1});setProductGallery(null);}}><FiShoppingBag/>Order product</Button></div></section></div>}

    <section id="storefront-reviews" className="public-content-section verified-reviews-section storefront-reviews storefront-container">
      <div className="section-heading storefront-section-heading">
        <div><p className="eyebrow">VERIFIED REVIEWS</p><h2>What customers are saying</h2><p className="storefront-section-description muted">Feedback from completed BookFlow bookings.</p></div>
        <span className="storefront-section-count"><FiStar aria-hidden="true"/> {reviews.length} reviews</span>
      </div>
      {reviews.length === 0 ? <div className="panel empty-state"><p className="muted">No verified reviews yet.</p></div> :
        <div className="verified-review-list">{reviews.map(review => <Card as="article" className="panel verified-review-card" key={review._id}><RatingSummary averageRating={review.rating} ratingCount={1} />{review.comment && <p>{review.comment}</p>}<small>Verified booking · {new Date(review.submittedAt).toLocaleDateString()}</small></Card>)}</div>}
    </section>
    <footer className="storefront-footer">
      <div className="storefront-container storefront-footer-inner">
        <div className="storefront-footer-brand"><Link className="brand-row" to="/search"><span className="brand-mark small">B</span><strong>BookFlow</strong></Link><p>Discover, book and shop from local businesses.</p></div>
        <div className="storefront-footer-links"><Link to="/search">Explore businesses</Link><a href="#storefront-top">Back to top</a></div>
        <small>© {new Date().getFullYear()} BookFlow. All rights reserved.</small>
      </div>
    </footer>
  </main>;
}
