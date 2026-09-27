export function Card({className="",...props}){return <div className={["ui-card",className].filter(Boolean).join(" ")} {...props}/>;}
export function CardHeader({className="",...props}){return <div className={["ui-card-header",className].filter(Boolean).join(" ")} {...props}/>;}
export function CardTitle({className="",...props}){return <h3 className={["ui-card-title",className].filter(Boolean).join(" ")} {...props}/>;}
export function CardDescription({className="",...props}){return <p className={["ui-card-description",className].filter(Boolean).join(" ")} {...props}/>;}
export function CardContent({className="",...props}){return <div className={["ui-card-content",className].filter(Boolean).join(" ")} {...props}/>;}
