import { useEffect, useState } from "react";
import { Image } from "./ui/image.jsx";
import { Button } from "./ui/button.jsx";

export default function ContentGallery({ coverImage, images = [], title = "" }) {
  const all = [coverImage, ...images].filter(Boolean);
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setActive(0);
    setShowAll(false);
  }, [coverImage, images]);

  if (!all.length) {
    return <div className="content-placeholder large-placeholder">B</div>;
  }

  const index = Math.min(active, all.length - 1);
  const visibleImages = showAll || all.length <= 4 ? all : all.slice(0, 3);
  const remaining = all.length - visibleImages.length;

  return (
    <div className="content-gallery ui-content-gallery">
      <Image
        className="gallery-hero"
        src={all[index]}
        loading="eager"
        alt={title}
      />

      {all.length > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="Select service image">
          {visibleImages.map((src, i) => (
            <Button
              type="button"
              variant="plain"
              key={i}
              aria-label={`Show image ${i + 1} of ${all.length}`}
              aria-pressed={index === i}
              className={`ui-gallery-thumbnail ${index === i ? "active" : ""}`}
              onClick={() => setActive(i)}
            >
              <Image src={src} alt="" loading="lazy" />
            </Button>
          ))}

          {remaining > 0 && (
            <Button
              type="button"
              variant="plain"
              className="ui-gallery-more"
              aria-label={`Show ${remaining} more service images`}
              onClick={() => setShowAll(true)}
            >
              +{remaining}
            </Button>
          )}
        </div>
      )}

      {showAll && all.length > 4 && (
        <div className="gallery-thumbs-footer">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(false)}>
            Show fewer photos
          </Button>
        </div>
      )}
    </div>
  );
}
