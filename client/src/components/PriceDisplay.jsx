import { money } from "../lib.js"; export default function PriceDisplay({price,currency,className=""}){return <strong className={className}>{money(price,currency)}</strong>;}
