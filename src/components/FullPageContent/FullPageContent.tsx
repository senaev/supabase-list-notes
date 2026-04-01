import { PropsWithChildren } from "react";
import "./FullPageContent.css";

export function FullPageContent({ children }: PropsWithChildren) {
  return <div className="FullPageContent">{children}</div>;
}
