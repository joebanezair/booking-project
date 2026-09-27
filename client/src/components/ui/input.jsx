import { forwardRef } from "react";
export const Input=forwardRef(function Input({className="",...props},ref){return <input ref={ref} className={["ui-input",className].filter(Boolean).join(" ")} {...props}/>;});
