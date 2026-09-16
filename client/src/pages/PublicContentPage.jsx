import { useEffect,useState } from "react";
import { useNavigate,useParams,Link } from "react-router-dom";
import { api } from "../api.js";
import ContentGallery from "../components/ContentGallery.jsx";
import PriceDisplay from "../components/PriceDisplay.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { RatingInput,RatingSummary } from "../components/StarRating.jsx";
import CommentSection from "../components/CommentSection.jsx";
import { getRealtimeSocket } from "../realtime.js";

export default function PublicContentPage({user}) {
  const {contentId}=useParams(),navigate=useNavigate(); const [item,setItem]=useState(null),[error,setError]=useState("");
  async function load(){try{setItem(await api.publicContent(contentId));setError("");}catch(e){setError(e.message);}}
  useEffect(()=>{load();},[contentId]);
  useEffect(()=>{const socket=getRealtimeSocket();if(!socket)return;const refresh=event=>{if(String(event.serviceId||event.content)===String(contentId))load();};socket.on("service:reactions",refresh);socket.on("comment:created",refresh);socket.on("comment:updated",refresh);socket.on("comment:deleted",refresh);return()=>{socket.off("service:reactions",refresh);socket.off("comment:created",refresh);socket.off("comment:updated",refresh);socket.off("comment:deleted",refresh);};},[contentId]);
  async function rate(value){if(!user)return navigate("/login");await api.ratings.set(contentId,value);await load();}
  async function react(type){if(!user)return navigate("/login");const summary=await api.reactions.toggle(contentId,type);setItem(current=>({...current,reactionSummary:summary}));}
  async function removeRating(){await api.ratings.remove(contentId);await load();}
  async function addComment(comment,parentId){await api.comments.add(contentId,comment,parentId);await load();}
  async function editComment(id,comment){await api.comments.update(id,comment);await load();}
  async function deleteComment(id){await api.comments.remove(id);await load();}
  if(error)return <main className="public-shell"><section className="public-card"><p className="error">{error}</p></section></main>;if(!item)return <main className="public-shell"><section className="public-card">Loading...</section></main>;
  const isOwner=user&&String(user.id)===String(item.owner.id),reactions=item.reactionSummary||{};
  return <main className="public-page"><header className="public-top"><Link className="brand-row" to="/discover"><span className="brand-mark small">B</span><strong>BookFlow</strong></Link></header><article className="content-detail"><ContentGallery coverImage={item.coverImage} images={item.images} title={item.title}/><div className="content-detail-body"><span className="category-pill">{item.category}</span><h1>{item.title}</h1><PriceDisplay className="content-price" price={item.price} currency={item.currency}/><p className="content-description">{item.description}</p><div className="reaction-bar"><button className={reactions.currentReaction==="like"?"reaction active":"reaction"} disabled={isOwner} onClick={()=>react("like")}>👍 Like <strong>{reactions.likes||0}</strong></button><button className={reactions.currentReaction==="dislike"?"reaction active":"reaction"} disabled={isOwner} onClick={()=>react("dislike")}>👎 Dislike <strong>{reactions.dislikes||0}</strong></button></div>{item.allowBookings&&<div className="content-booking-callout"><div><strong>Interested in this service?</strong><p>Choose a convenient date and request a schedule with {item.owner.name}.</p></div><Link className="primary-button button-link" to={`/b/${item.owner.id}?content=${item._id}&service=${encodeURIComponent(item.title)}`}>Book this service</Link></div>}<div className="owner-strip"><ProfileAvatar profile={item.owner}/><div><strong>{item.owner.name}</strong>{item.owner.headline&&<small>{item.owner.headline}</small>}</div><Link className="secondary button-link" to={`/profile/${item.owner.username}`}>View profile</Link></div>{item.allowRatings&&<section className="rating-section"><p className="eyebrow">RATINGS</p><RatingSummary {...item.ratingSummary}/>{!isOwner&&(user?<div className="your-rating"><span>Your rating</span><RatingInput value={item.currentUserRating||0} onChange={rate}/>{item.currentUserRating&&<button className="link-button" onClick={removeRating}>Remove rating</button>}</div>:<button className="link-button" onClick={()=>navigate("/login")}>Sign in to rate</button>)}</section>}<CommentSection comments={item.comments||[]} currentUser={user} ownerId={item.owner.id} onAdd={addComment} onEdit={editComment} onDelete={deleteComment} onSignIn={()=>navigate("/login")}/></div></article></main>;
}
