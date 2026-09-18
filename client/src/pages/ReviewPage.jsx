import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { RatingInput, RatingSummary } from "../components/StarRating.jsx";

export default function ReviewPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.reviews.get(token)
      .then(result => {
        setData(result);
        setRating(result.rating || 0);
        setComment(result.comment || "");
      })
      .catch(e => setError(e.message));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.reviews.submit(token, { rating, comment });
      setData(current => ({ ...current, submitted: true, rating: result.rating, comment: result.comment }));
      setMessage("Thank you. Your verified review has been submitted.");
    } catch (e) {
      setError(e.message);
    }
  }

  return <main className="public-shell"><section className="public-card review-card">
    <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
    {error && !data ? <p className="error">{error}</p> : !data ? <p>Loading...</p> : <>
      <p className="eyebrow">VERIFIED BOOKING REVIEW</p>
      <h1>Review {data.business.name}</h1>
      <p className="muted">This review link is tied to your completed booking for <strong>{data.booking.service}</strong> on {new Date(data.booking.bookingDate).toLocaleDateString()}.</p>
      {data.submitted ? <div className="verified-review-confirmation"><p className="success">A verified review has already been submitted for this booking.</p><RatingSummary averageRating={data.rating} ratingCount={1} />{data.comment && <p>{data.comment}</p>}</div> :
        <form onSubmit={submit}>
          <label>Your rating<RatingInput value={rating} onChange={setRating} /></label>
          <label>Review<textarea rows="6" maxLength="1500" value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience with this business." /></label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button className="primary-button" disabled={!rating}>Submit verified review</button>
        </form>}
    </>}
  </section></main>;
}
