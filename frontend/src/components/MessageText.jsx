import React from "react";
import { splitMessageText } from "../utils/messageLinks.js";

export default function MessageText({ text, linkClassName = "" }) {
  return splitMessageText(text).map((part, index) => (
    part.url
      ? <a key={index} href={part.url} target="_blank" rel="noopener noreferrer" className={linkClassName}>{part.text}</a>
      : <React.Fragment key={index}>{part.text}</React.Fragment>
  ));
}
