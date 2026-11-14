import { Card, CardContent } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Label } from "../components/ui/label.jsx";
import { Image } from "../components/ui/image.jsx";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiArrowRight, FiBriefcase, FiCalendar, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiCopy, FiEdit3, FiEye, FiFileText, FiGlobe, FiLock, FiMapPin, FiMessageSquare, FiPackage, FiShare2, FiShoppingBag, FiStar, FiUserPlus, FiUserCheck, FiX } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog.jsx";
import { api } from "../api.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import ContentCard from "../components/ContentCard.jsx";
import ProfileCatalogSearch from "../components/ProfileCatalogSearch.jsx";
import { RatingInput, RatingSummary } from "../components/StarRating.jsx";
import { Button } from "../components/ui/button.jsx";
import { Separator } from "../components/ui/separator.jsx";

export default function PublicProfilePage({ user }) {
  const { username } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resolvedUsername = username || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [ratingToastSummary, setRatingToastSummary] = useState(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [orderProduct,setOrderProduct]=useState(null);
  const [orderForm,setOrderForm]=useState({quantity:1,customerName:user?.name||"",customerEmail:user?.email||"",customerPhone:"",deliveryLocation:"",notes:""});
  const [orderSuccess,setOrderSuccess]=useState(null);
  const [trackingCopied,setTrackingCopied]=useState(false);
  const [orderNumberCopied,setOrderNumberCopied]=useState(false);
  const [trackingCopyError,setTrackingCopyError]=useState("");
  const [orderBusy,setOrderBusy]=useState(false);
  const orderLock=useRef(false);
  const [productGallery,setProductGallery]=useState(null);
  const [galleryIndex,setGalleryIndex]=useState(0);
  const [detailProduct,setDetailProduct]=useState(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogType, setCatalogType] = useState("all");
  const [minServiceRating, setMinServiceRating] = useState("0");

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setCatalogSearch("");
    setCatalogType("all");
    setMinServiceRating("0");
    api.publicProfile(resolvedUsername).then(result => {
      if (active) { setData(result); setError(""); }
    }).catch(async e => {
      if (e.status === 404) {
        try {
          // Existing /profile/:username links should also work for admins.
          await api.publicAdminProfile(resolvedUsername);
          if (active) navigate(`/admin/${encodeURIComponent(resolvedUsername)}`, { replace: true });
          return;
        } catch { /* No public admin profile by this username either. */ }
      }
      if (active) setError(e.message);
    });
    return () => { active = false; };
  }, [resolvedUsername, navigate]);

  useEffect(() => {
    if (!data) return;
    const selected = (data.products || []).find(product => String(product._id) === searchParams.get("product"));
    setDetailProduct(selected || null);
  }, [data, searchParams]);

  useEffect(() => {
    if (!ratingMessage) return undefined;
    const timeout = window.setTimeout(() => setRatingMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [ratingMessage]);

  async function rateBusiness(value) {
    try {
      await api.ratings.setBusiness(data.profile.businessId, value);
      const refreshed = await api.publicProfile(resolvedUsername);
      const summary = refreshed?.profile?.businessRatingSummary || {};
      const average = Number(summary.averageRating ?? 0);
      setData(refreshed);
      setRatingToastSummary({
        userRating: value,
        averageRating: Number.isFinite(average) ? average.toFixed(1) : "0.0",
        totalRatings: Number(summary.ratingCount ?? 0) || 0
      });
      setRatingMessage("Business rating saved.");
      setError("");
    } catch (e) { setError(e.message); }
  }
  async function removeBusinessRating() {
    try {
      await api.ratings.removeBusiness(data.profile.businessId);
      const refreshed = await api.publicProfile(resolvedUsername);
      setData(refreshed);
      setRatingToastSummary(null);
      setRatingMessage("Business rating removed.");
      setError("");
    } catch (e) { setError(e.message); }
  }

  async function sharePublicProfile() {
    const url = window.location.href;
    setShareFeedback("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: profile.name,
          text: `View ${profile.name} on BookFlow.`,
          url
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShareFeedback("Profile link copied.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") setShareFeedback("Unable to share automatically. Copy the profile link from your browser.");
    }
  }

  async function submitProductOrder(event) {
    event.preventDefault();
    if (orderLock.current || !orderProduct) return;
    orderLock.current = true;
    setOrderBusy(true);
    setError("");
    try {
      const result = await api.publicProductOrder(profile.id, {
        items: [{ productId: orderProduct._id, quantity: Number(orderForm.quantity) }],
        customerName: orderForm.customerName,
        customerEmail: orderForm.customerEmail,
        customerPhone: orderForm.customerPhone,
        deliveryLocation: orderForm.deliveryLocation,
        notes: orderForm.notes
      });
      setTrackingCopied(false);
      setOrderNumberCopied(false);
      setTrackingCopyError("");
      setOrderSuccess({
        orderNumber: result.orderNumber,
        trackingLink: result.id && result.trackingToken
          ? `/order-status/${result.id}#${result.trackingToken}`
          : ""
      });
      setOrderProduct(null);
      setOrderForm({ quantity: 1, customerName: user?.name || "", customerEmail: user?.email || "", customerPhone: "", deliveryLocation: "", notes: "" });
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      orderLock.current = false;
      setOrderBusy(false);
    }
  }

  function dismissOrderSuccess() {
    setOrderSuccess(null);
    setTrackingCopied(false);
    setOrderNumberCopied(false);
    setTrackingCopyError("");
  }

  async function copyOrderNumber() {
    if (!orderSuccess?.orderNumber) return;
    try {
      await navigator.clipboard.writeText(String(orderSuccess.orderNumber));
      setOrderNumberCopied(true);
      setTrackingCopyError("");
    } catch {
      setTrackingCopyError("Unable to copy the order number automatically.");
    }
  }

  async function copyOrderTrackingLink() {
    if (!orderSuccess?.trackingLink) return;
    try {
      await navigator.clipboard.writeText(new URL(orderSuccess.trackingLink, window.location.origin).href);
      setTrackingCopied(true);
      setTrackingCopyError("");
    } catch {
      setTrackingCopyError("Unable to copy automatically. Open order status to save the link.");
    }
  }

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
  const verifiedRating = profile.ratingSummary || {};
  // Published offerings are returned only when their admin-controlled feature is active.
  const hasPublicServices = Boolean(profile.servicesAvailable && content.length > 0);
  const hasPublicProducts = Boolean(profile.posAvailable && products.length > 0);
  const isOwner = user && String(user.id) === String(profile.id);
  const friendship = profile.friendship || {};
  // Keep profile actions visible to visitors; actual friendship and messaging
  // permissions are still enforced by the API for signed-in accounts.
  const canInteract = Boolean(user && !isOwner);
  const canMessage = canInteract && ["business", "admin"].includes(user.role) &&
    (user.role === "admin" || friendship.isFriend) && !friendship.blocked;
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
  const showServices = hasPublicServices && !noMatches && catalogType !== "products" &&
    (catalogType === "services" || !filtering || visibleServices.length > 0);
  const showProducts = hasPublicProducts && !noMatches && catalogType !== "services" &&
    (catalogType === "products" || !normalizedSearch || visibleProducts.length > 0);
  const publicProfilePath = `/profile/${encodeURIComponent(profile.username || resolvedUsername)}`;

  return <main className="public-page bookflow-storefront public-business-profile" id="storefront-top">
    {ratingMessage && <div className="business-rating-toast" role="status" aria-live="polite" aria-atomic="true">
      <span className="business-rating-toast-icon" aria-hidden="true"><FiCheckCircle /></span>
      <div className="business-rating-toast-content">
        <span className="business-rating-toast-message">{ratingMessage}</span>
        {ratingToastSummary && <small className="business-rating-toast-details">
          Your rating: {ratingToastSummary.userRating}/5
          <span aria-hidden="true"> · </span>
          Business average: {ratingToastSummary.averageRating}/5
          <span aria-hidden="true"> · </span>
          {ratingToastSummary.totalRatings} total {ratingToastSummary.totalRatings === 1 ? "rating" : "ratings"}
        </small>}
      </div>
      <button type="button" className="business-rating-toast-close" aria-label="Dismiss notification" onClick={() => { setRatingMessage(""); setRatingToastSummary(null); }}>
        <FiX aria-hidden="true" />
      </button>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}

    <section className={`public-profile-hero storefront-hero ${profile.coverImage ? "has-cover" : ""}`} aria-label={profile.name+" business profile"}>
      <div className={`public-cover storefront-cover${profile.coverImage?"":" storefront-cover-empty"}`}>
        <Link to="/search" className="storefront-cover-brand" aria-label="BookFlow home" title="BookFlow home">
          <span className="brand-mark small" aria-hidden="true">B</span>
        </Link>
        {profile.coverImage ? <Image className="ui-profile-cover-image" src={profile.coverImage} alt={profile.name+" cover photo"} decoding="async"/> : <div className="storefront-cover-placeholder" aria-hidden="true"/>}
      </div>
      <div className="public-profile-info storefront-profile-info storefront-container">
        <div className="storefront-profile-heading">
          <ProfileAvatar profile={profile} size="xl" />
          <div className="profile-title-row storefront-title-row">
            <div className="storefront-name-block">
              <h1>{profile.name}</h1>
              <span className="storefront-handle">@{profile.username||resolvedUsername}</span>
              {profile.headline && <p className="profile-headline"><LuBuilding2 aria-hidden="true" /><span>{profile.headline}</span></p>}

            </div>
            <div className="storefront-owner-actions">
              {isOwner ? <div className="public-profile-owner-actions">
                <Button type="button" variant="outline" size="sm" className="owner-profile-action" onClick={sharePublicProfile}><FiShare2 aria-hidden="true" />Share</Button>
                
                <Button asChild variant="default" size="sm" className="owner-profile-action owner-profile-action-primary"><Link to="/dashboard/profile/edit"><FiEdit3 aria-hidden="true" />Edit Profile</Link></Button>
              </div> : <div className="public-profile-actions">
                {canInteract ? (
                  friendship.incomingRequest ? <button type="button" className="profile-action-button profile-action-friend" disabled={friendBusy} onClick={() => friendAction("accept")}><FiUserPlus aria-hidden="true" /><span>Accept Friend</span></button> :
                  friendship.isFriend ? <button type="button" className="profile-action-button profile-action-friend" disabled={friendBusy} onClick={() => friendAction("unfriend")}><FiUserCheck aria-hidden="true" /><span>Friends</span></button> :
                  <button type="button" className="profile-action-button profile-action-friend" disabled={friendBusy || friendship.requestSent || friendship.blocked} onClick={() => friendAction("add")}><FiUserPlus aria-hidden="true" /><span>{friendship.requestSent ? "Request Sent" : "Add Friend"}</span></button>
                ) : <Link className="profile-action-button profile-action-friend" to="/login"><FiUserPlus aria-hidden="true" /><span>Add Friend</span></Link>}
                {canMessage ? <Link className="profile-action-button profile-action-message" to={conversationPath}><FiMessageSquare aria-hidden="true" /><span>Message</span></Link> :
                  canInteract ? <button type="button" className="profile-action-button profile-action-message" disabled title={friendship.blocked ? "Messaging is blocked" : "Become friends to send messages"}><FiMessageSquare aria-hidden="true" /><span>Message</span></button> :
                  <Link className="profile-action-button profile-action-message" to="/login"><FiMessageSquare aria-hidden="true" /><span>Message</span></Link>}
              </div>}
              {/* Booking is independent of social actions: it requires a posted,
                  published, bookable service and admin-enabled booking access. */}
              {profile.bookingAvailable && <Link className="profile-action-button public-book-session-button storefront-book-button" to={`/b/${profile.id}`}><FiCalendar aria-hidden="true" /><span>Book A Session</span></Link>}
            </div>
          </div>
        </div>
        <div className="public-profile-copy" id="storefront-about">
          {paused && <div className="paused-public-banner" role="status" title="This business is not accepting new bookings right now."><FiAlertCircle aria-hidden="true" /><span>Bookings temporarily unavailable</span><span className="visually-hidden"> — this business is not accepting new bookings right now.</span></div>}
          <div className="storefront-about-layout">
            <div className="storefront-rating-chip-row" aria-label="Business ratings">
              <Button asChild variant="outline" size="sm" className="storefront-rating-chip" title="Ratings from visitors">
                <a href="#storefront-your-rating" aria-label={`Business rating ${profile.businessRatingSummary?.averageRating || "0.0"}, ${profile.businessRatingSummary?.ratingCount || 0} ratings. Go to your rating.`}>
                  <FiStar aria-hidden="true" />
                  <span className="storefront-rating-chip-label">Business rating</span>
                  <strong>{profile.businessRatingSummary?.averageRating || "0.0"}</strong>
                  <small className="storefront-rating-chip-count">({profile.businessRatingSummary?.ratingCount || 0} {(profile.businessRatingSummary?.ratingCount || 0) === 1 ? "rating" : "ratings"})</small>
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="storefront-rating-chip" title="Reviews from completed bookings">
                <a href="#storefront-reviews" aria-label={`Verified reviews, ${profile.ratingSummary?.ratingCount || 0} ratings. View customer reviews.`}>
                  <FiCheckCircle aria-hidden="true" />
                  <span className="storefront-rating-chip-label">Verified reviews</span>
                  <strong>{profile.ratingSummary?.averageRating || "0.0"}</strong>
                  <small className="storefront-rating-chip-count">({profile.ratingSummary?.ratingCount || 0} {(profile.ratingSummary?.ratingCount || 0) === 1 ? "rating" : "ratings"})</small>
                </a>
              </Button>
              <div id="storefront-your-rating" className="ui-button ui-button-outline ui-button-sm storefront-rating-chip storefront-your-rating-chip" aria-label="Your rating">
                <FiEdit3 aria-hidden="true" />
                {user && !isOwner ? <>
                  <span className="storefront-rating-chip-label">Your rating</span>
                  <div className="profile-rating-actions" id="storefront-your-rating-actions">
                    <RatingInput value={profile.currentUserBusinessRating || 0} onChange={rateBusiness} />
                    {profile.currentUserBusinessRating && <Button variant="plain" type="button" className="link-button remove-business-rating" onClick={removeBusinessRating} aria-label="Remove rating" title="Remove rating"><FiX aria-hidden="true"/><span>Remove rating</span></Button>}
                  </div>
                </> : user ? <>
                  <span className="storefront-rating-chip-label">Visitor ratings</span>
                  <small className="storefront-rating-chip-count">Visitors can rate your business</small>
                </> : <>
                  <span className="storefront-rating-chip-label">Your rating</span>
                  <Link className="storefront-sign-in-link" to="/login">Sign in</Link>
                </>}
              </div>
            </div>
            <section className="storefront-info-card storefront-description-column" aria-label="Business description">
              <span className="storefront-info-card-icon storefront-info-card-icon--description" aria-hidden="true"><FiFileText /></span>
              <div className="storefront-description-content">
                <strong className="storefront-description-title">Description</strong>
                {profile.bio && <p className="public-bio">{profile.bio}</p>}
                {(profile.website || profile.location) && <div className="profile-meta storefront-meta">
                  {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer"><FiGlobe aria-hidden="true" />Website</a>}
                  {profile.location && <span className="storefront-meta-location"><FiMapPin aria-hidden="true" />{profile.location}</span>}
                </div>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
    {shareFeedback && <p className="storefront-share-feedback storefront-container" role="status">{shareFeedback}</p>}

    {(hasPublicServices || hasPublicProducts) && <section className="public-content-section profile-catalog-filter-section storefront-filter-section storefront-container" aria-label="Search and filter offerings">
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
        hasProducts={hasPublicProducts}
        hasServices={hasPublicServices}
      />
      {noMatches && <div className="panel empty-state" role="status"><p className="muted">{catalogType === "services" ? "No services match these filters." : catalogType === "products" ? "No products match these filters." : "No products or services match these filters."}</p></div>}
    </section>}

    {hasPublicServices && <section id="storefront-services" className="public-content-section storefront-offerings-section storefront-services storefront-container" hidden={!showServices}>
      <div className="section-heading storefront-section-heading">
        <div><p className="eyebrow">PUBLIC SERVICES</p><h2>Explore our services</h2><p className="storefront-section-description muted">Browse services offered by {profile.name}.</p></div>
        <span className="storefront-section-count"><FiBriefcase aria-hidden="true" />{visibleServices.length} services</span>
      </div>
      {content.length === 0 ? <div className="panel empty-state"><p className="muted">No public services yet.</p></div> :
        visibleServices.length === 0 ? <div className="panel empty-state" role="status"><p className="muted">No services match your search.</p></div> :
        <div className="content-grid public-services-grid">{visibleServices.map(item => <Link key={item._id} to={`/services/${item._id}`} className="content-card-link"><ContentCard item={item} /></Link>)}</div>}
    </section>}

    {hasPublicProducts && <section id="storefront-products" className="public-content-section public-profile-products storefront-offerings-section storefront-products storefront-container" hidden={!showProducts}>
      <div className="section-heading storefront-section-heading">
        <div><p className="eyebrow">PRODUCT CATALOG</p><h2>Shop products</h2><p className="storefront-section-description muted">Discover products available to order from {profile.name}.</p></div>
        <span className="storefront-section-count"><FiPackage aria-hidden="true" />{visibleProducts.length} products</span>
      </div>
      {products.length === 0 ? <div className="panel empty-state"><p className="muted">No public products yet.</p></div> :
        visibleProducts.length === 0 ? <div className="panel empty-state" role="status"><p className="muted">No products match your search.</p></div> :
        <div className="content-grid">{visibleProducts.map(product => {const images=(product.images?.length?product.images:(product.image?[product.image]:[]));return <Card as="article" className="public-product-card" key={product._id}><Button variant="plain" type="button" className="public-product-media" disabled={!images.length} aria-label={images.length>1?`View ${images.length} images for ${product.name}`:`View image for ${product.name}`} onClick={()=>{if(images.length){setProductGallery({...product,images});setGalleryIndex(0);}}}>{images.length?<><Image src={images[0]} alt={product.name}/>{images.length>1&&<span className="image-count-badge">1 / {images.length}</span>}</>:<span className="product-image-placeholder"><FiShoppingBag/></span>}</Button><CardContent className="public-product-body"><div className="public-product-price-stock"><strong>{product.currency} {Number(product.price || 0).toLocaleString()}</strong><small>{product.stock > 0 ? product.stock + " in stock" : "Out of stock"}</small></div><h3><Button variant="plain" type="button" className="public-product-name-trigger" onClick={()=>{setProductGallery({...product,images});setGalleryIndex(0);}}>{product.name}</Button></h3>{product.description && <p className="muted">{product.description}</p>}</CardContent><Button variant="default" className="public-order-button" disabled={product.stock<1||paused} onClick={()=>{setOrderProduct(product);setOrderForm({...orderForm,quantity:1});}}><FiShoppingBag/>Order Product</Button></Card>})}</div>}

    </section>}

      <Dialog
        open={Boolean(orderSuccess)}
        onOpenChange={open => { if (!open) dismissOrderSuccess(); }}
        title="Order placed successfully"
        className="order-confirmation-dialog"
      >
        <DialogContent className="order-confirmation-content">
          <Button type="button" variant="ghost" size="icon" className="order-confirmation-close" aria-label="Close order confirmation" onClick={dismissOrderSuccess}>
            <FiX aria-hidden="true" />
          </Button>
          <div className="order-confirmation-success" aria-hidden="true">
            <span className="order-confirmation-icon"><FiCheck /></span>
            <span className="order-confirmation-spark order-confirmation-spark-one" />
            <span className="order-confirmation-spark order-confirmation-spark-two" />
            <span className="order-confirmation-spark order-confirmation-spark-three" />
            <span className="order-confirmation-spark order-confirmation-spark-four" />
          </div>
          <DialogHeader className="order-confirmation-header">
            <DialogTitle>Order placed successfully!</DialogTitle>
            <DialogDescription>Your order has been sent to the seller.</DialogDescription>
          </DialogHeader>
          <div className="order-confirmation-reference">
            <div className="order-confirmation-reference-copy">
              <span>ORDER NUMBER</span>
              <strong>{orderSuccess?.orderNumber}</strong>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="order-confirmation-number-copy"
              aria-label={orderNumberCopied ? "Order number copied" : "Copy order number"}
              title={orderNumberCopied ? "Order number copied" : "Copy order number"}
              onClick={copyOrderNumber}
            >
              {orderNumberCopied ? <FiCheckCircle aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
            </Button>
          </div>
          {orderSuccess?.trackingLink && (
            <>
              <p className="order-confirmation-privacy"><FiLock aria-hidden="true" /> Keep your tracking link private. Anyone with the link can view your order status.</p>
              <DialogFooter className="order-confirmation-actions">
                <Button type="button" variant="outline" onClick={copyOrderTrackingLink}>
                  {trackingCopied ? <FiCheckCircle aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                  {trackingCopied ? "Link copied" : "Copy tracking link"}
                </Button>
                <Button asChild>
                  <Link to={orderSuccess.trackingLink} onClick={dismissOrderSuccess}>View order status <FiArrowRight aria-hidden="true" /></Link>
                </Button>
              </DialogFooter>
              {trackingCopyError && <p className="error order-confirmation-copy-error" role="alert">{trackingCopyError}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(orderProduct)}
        onOpenChange={open => { if (!open && !orderBusy) setOrderProduct(null); }}
        title={orderProduct ? "Order " + orderProduct.name : "Product order"}
        dismissible={!orderBusy}
        className="public-product-checkout-dialog"
      >
        {orderProduct && (
          <DialogContent className="public-product-checkout-content">
            <DialogHeader className="public-product-checkout-header">
              <div className="public-product-checkout-heading">
                <p className="eyebrow">PRODUCT ORDER</p>
                <DialogTitle>{orderProduct.name}</DialogTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close product order"
                onClick={() => setOrderProduct(null)}
                disabled={orderBusy}
              >
                <FiX aria-hidden="true" />
              </Button>
              <DialogDescription>
                Review the product and enter your contact and delivery details.
              </DialogDescription>
            </DialogHeader>

            <Card className="public-product-checkout-product-card">
              <div className="public-product-checkout-image">
                <Image
                  src={orderProduct.images?.[0] || orderProduct.image}
                  alt={orderProduct.name}
                  className="public-product-checkout-image-element"
                />
              </div>
              <CardContent className="public-product-checkout-product-content">
                <div className="public-product-checkout-product-copy">
                  <strong>{orderProduct.name}</strong>
                  <span>Sold by {profile.name}</span>
                </div>
                <div className="public-product-checkout-product-meta">
                  <strong>{orderProduct.currency || "PHP"} {Number(orderProduct.price || 0).toLocaleString()}</strong>
                  <small>{Number(orderProduct.stock || 0).toLocaleString()} in stock</small>
                </div>
              </CardContent>
            </Card>

            <Card className="public-product-checkout-history-note">
              <CardContent className="public-product-checkout-history-content">
                <FiCheckCircle aria-hidden="true" />
                <div>
                  <strong>Purchase History</strong>
                  <p>
                    {user?.role === "business" ? (
                      "This order will be saved to your Purchase History."
                    ) : (
                      <>Sign in with your BookFlow business account to save this order to your Purchase History. <Link to="/login">Sign in</Link></>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <form className="public-product-checkout-form" onSubmit={submitProductOrder}>
              <div className="public-product-checkout-fields">
                <div className="public-product-checkout-field public-product-checkout-quantity">
                  <Label htmlFor="public-order-quantity">Quantity</Label>
                  <Input
                    id="public-order-quantity"
                    type="number"
                    min="1"
                    max={orderProduct.stock}
                    required
                    value={orderForm.quantity}
                    onChange={e => setOrderForm({ ...orderForm, quantity: e.target.value })}
                  />
                </div>
                <div className="public-product-checkout-field">
                  <Label htmlFor="public-order-name">Name <span className="required-mark">*</span></Label>
                  <Input
                    id="public-order-name"
                    required
                    autoComplete="name"
                    placeholder="Your full name"
                    value={orderForm.customerName}
                    onChange={e => setOrderForm({ ...orderForm, customerName: e.target.value })}
                  />
                </div>
                <div className="public-product-checkout-field">
                  <Label htmlFor="public-order-phone">Phone <span className="required-mark">*</span></Label>
                  <Input
                    id="public-order-phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="Mobile number"
                    value={orderForm.customerPhone}
                    onChange={e => setOrderForm({ ...orderForm, customerPhone: e.target.value })}
                  />
                </div>
                <div className="public-product-checkout-field">
                  <Label htmlFor="public-order-email">Email</Label>
                  <Input
                    id="public-order-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={orderForm.customerEmail}
                    onChange={e => setOrderForm({ ...orderForm, customerEmail: e.target.value })}
                  />
                </div>
                <div className="public-product-checkout-field public-product-checkout-field-wide">
                  <Label htmlFor="public-order-location">Delivery location <span className="required-mark">*</span></Label>
                  <div className="public-product-checkout-location-input">
                    <FiMapPin aria-hidden="true" />
                    <Input
                      id="public-order-location"
                      required
                      maxLength="250"
                      autoComplete="street-address"
                      placeholder="Street, barangay, city / delivery address"
                      value={orderForm.deliveryLocation}
                      onChange={e => setOrderForm({ ...orderForm, deliveryLocation: e.target.value })}
                    />
                  </div>
                </div>
                <div className="public-product-checkout-field public-product-checkout-field-wide">
                  <Label htmlFor="public-order-notes">Notes <span className="public-product-checkout-optional">(optional)</span></Label>
                  <Textarea
                    id="public-order-notes"
                    rows={3}
                    placeholder="Add delivery instructions or other details"
                    value={orderForm.notes}
                    onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <Separator className="public-product-checkout-separator" />
              <div className="public-product-checkout-total">
                <div>
                  <span>Order total</span>
                  <small>{Number(orderForm.quantity || 1).toLocaleString()} × {orderProduct.currency || "PHP"} {Number(orderProduct.price || 0).toLocaleString()}</small>
                </div>
                <strong>{orderProduct.currency || "PHP"} {(Number(orderProduct.price || 0) * Number(orderForm.quantity || 1)).toLocaleString()}</strong>
              </div>

              {error && <p className="error" role="alert">{error}</p>}

              <DialogFooter className="public-product-checkout-actions">
                <Button type="button" variant="outline" onClick={() => setOrderProduct(null)} disabled={orderBusy}>
                  Cancel
                </Button>
                <Button type="submit" className="public-place-order" disabled={orderBusy}>
                  <FiShoppingBag aria-hidden="true" />
                  {orderBusy ? "Placing order…" : "Place order"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

    {detailProduct&&<div className="booking-modal-backdrop product-gallery-backdrop" onClick={()=>setDetailProduct(null)}><section className="ui-card public-product-gallery search-product-details" role="dialog" aria-modal="true" aria-label={detailProduct.name+" details"} onClick={e=>e.stopPropagation()}><div className="public-gallery-head"><div><p className="eyebrow">PRODUCT DETAILS</p><h2>{detailProduct.name}</h2></div><Button variant="outline" size="icon" aria-label="Close product details" onClick={()=>setDetailProduct(null)}><FiX/></Button></div><div className="public-gallery-stage">{(detailProduct.images?.[0]||detailProduct.image)?<Image src={detailProduct.images?.[0]||detailProduct.image} alt={detailProduct.name}/>:<span className="product-image-placeholder"><FiShoppingBag/></span>}</div><div className="public-product-body"><p>{detailProduct.description||"No description available."}</p><strong>{detailProduct.currency||"PHP"} {Number(detailProduct.price||0).toLocaleString()}</strong><small>{detailProduct.stock>0?detailProduct.stock+" in stock":"Out of stock"}</small><p>Sold by {profile.name}</p></div><div className="public-gallery-footer"><Button variant="outline" onClick={()=>{const images=detailProduct.images?.length?detailProduct.images:(detailProduct.image?[detailProduct.image]:[]);if(images.length){setProductGallery({...detailProduct,images});setGalleryIndex(0);setDetailProduct(null);}}} disabled={!(detailProduct.images?.length||detailProduct.image)}>View images</Button><Button disabled={detailProduct.stock<1||paused} onClick={()=>{setOrderProduct(detailProduct);setOrderForm({...orderForm,quantity:1});setDetailProduct(null);}}><FiShoppingBag/>Order product</Button></div></section></div>}
    {productGallery&&<div className="booking-modal-backdrop product-gallery-backdrop" onClick={()=>setProductGallery(null)}><section className="ui-card public-product-gallery product-gallery-refined" role="dialog" aria-modal="true" aria-label={productGallery.name+" images"} onClick={e=>e.stopPropagation()}><div className="public-gallery-head"><div><p className="eyebrow">PRODUCT GALLERY</p><h2>{productGallery.name}</h2></div><Button variant="outline" size="icon" className="icon-action" aria-label="Close gallery" data-tooltip="Close" onClick={()=>setProductGallery(null)}><FiX/></Button></div><div className="public-gallery-stage">{productGallery.images.length>0?<><Image src={productGallery.images[galleryIndex]} alt={productGallery.name+" image "+(galleryIndex+1)}/>{productGallery.images.length>1&&<><Button variant="outline" size="icon" className="gallery-arrow gallery-prev" aria-label="Previous image" onClick={()=>setGalleryIndex(i=>(i-1+productGallery.images.length)%productGallery.images.length)}><FiChevronLeft/></Button><Button variant="outline" size="icon" className="gallery-arrow gallery-next" aria-label="Next image" onClick={()=>setGalleryIndex(i=>(i+1)%productGallery.images.length)}><FiChevronRight/></Button></>}</>:<span className="product-image-placeholder"><FiShoppingBag/><small>No product images available</small></span>}</div>{productGallery.images.length>1&&<div className="public-gallery-thumbs">{productGallery.images.map((src,index)=><Button variant="plain" type="button" key={index} className={index===galleryIndex?"active":""} aria-label={"View image "+(index+1)} onClick={()=>setGalleryIndex(index)}><Image src={src} alt=""/></Button>)}</div>}<div className="public-product-body" aria-label="Product information"><p>{productGallery.description || "No description available."}</p><strong>{productGallery.currency || "PHP"} {Number(productGallery.price || 0).toLocaleString()}</strong><small>{productGallery.stock > 0 ? productGallery.stock + " in stock" : "Out of stock"}</small>{productGallery.sku && <small>SKU: {productGallery.sku}</small>}<p>Sold by {profile.name}</p></div><div className="public-gallery-footer">{productGallery.images.length>0&&<span>{galleryIndex+1} of {productGallery.images.length}</span>}<Button disabled={productGallery.stock<1 || paused} onClick={()=>{setOrderProduct(productGallery);setOrderForm({...orderForm,quantity:1});setProductGallery(null);}}><FiShoppingBag/>Order product</Button></div></section></div>}

    <section id="storefront-reviews" className="public-content-section verified-reviews-section storefront-reviews storefront-container">
      <div className="section-heading storefront-section-heading">
        <div><h2>Customer reviews</h2><p className="storefront-section-description muted">Verified feedback from completed bookings.</p></div>
        <span className="storefront-section-count"><FiStar aria-hidden="true"/> {verifiedRating.ratingCount || 0} {(verifiedRating.ratingCount || 0) === 1 ? "review" : "reviews"}</span>
      </div>
      {reviews.length === 0 ? <div className="storefront-reviews-empty" role="status"><span className="storefront-reviews-empty-icon"><FiStar aria-hidden="true" /></span><div><strong>No verified reviews yet</strong><p>Reviews from completed bookings will appear here.</p></div></div> :
        <div className="verified-review-list">{reviews.map(review => <Card as="article" className="panel verified-review-card" key={review._id}><div className="verified-review-rating"><span className="verified-review-rating-icon" aria-hidden="true"><FiStar /></span><RatingSummary averageRating={review.rating} ratingCount={1} /></div>{review.comment && <p>{review.comment}</p>}<small><FiCheckCircle aria-hidden="true"/>Verified booking · {new Date(review.submittedAt).toLocaleDateString()}</small></Card>)}</div>}
    </section>
    <footer className="storefront-footer">
      <div className="storefront-container storefront-footer-inner">
        <div className="storefront-footer-brand"><Link className="brand-row" to="/search"><span className="brand-mark small">B</span><strong>BookFlow</strong></Link><p>Discover, book and shop from local businesses.</p><small className="storefront-footer-copyright">© {new Date().getFullYear()} BookFlow. All rights reserved.</small></div>
        <div className="storefront-footer-links"><Link to="/search">Explore businesses</Link><a href="#storefront-top">Back to top</a></div>
      </div>
    </footer>
  </main>;
}
