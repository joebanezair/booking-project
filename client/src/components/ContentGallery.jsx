import { useEffect, useState } from "react";
import { Image } from "./ui/image.jsx";
import { Button } from "./ui/button.jsx";

export default function ContentGallery({coverImage,images=[],title=""}) {
  const all = [coverImage,...images].filter(Boolean);
  const [active,setActive] = useState(0);
  useEffect(()=>setActive(0),[coverImage,images]);
  if (!all.length) return <div className="content-placeholder large-placeholder">B</div>;
  const index = Math.min(active,all.length-1);
  return <div className="content-gallery ui-content-gallery">
    <Image className="gallery-hero" src={all[index]} loading="eager" alt={title} />
    {all.length>1&&<div className="gallery-thumbs" role="group" aria-label="Select service image">
      {all.map((src,i)=><Button type="button" variant="plain" key={i}
        aria-label={`Show image ${i+1} of ${all.length}`}
        aria-pressed={index===i} className={`ui-gallery-thumbnail ${index===i?"active":""}`}
        onClick={()=>setActive(i)}>
        <Image src={src} alt="" loading="lazy" />
      </Button>)}
    </div>}
  </div>;
}
