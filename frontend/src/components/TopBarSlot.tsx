/**
 * Travelog — Application top bar slot (new UI §1.1)
 *
 * Lets a page render content inside the application top bar while keeping
 * its own state and handlers: the page wraps the content in `<TopBarSlot>`
 * and the app provides the target DOM node through `TopBarSlotProvider`
 * (see `TopBar`). Without a provider the content renders in place, so a
 * page can still be rendered in isolation (component tests).
 */

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const TopBarSlotContext = createContext<HTMLElement | null>(null);

export function TopBarSlotProvider({
  node,
  children,
}: {
  /** DOM node of the top bar slot; null until the bar is mounted. */
  node: HTMLElement | null;
  children: ReactNode;
}) {
  return <TopBarSlotContext.Provider value={node}>{children}</TopBarSlotContext.Provider>;
}

export default function TopBarSlot({ children }: { children: ReactNode }) {
  const node = useContext(TopBarSlotContext);
  if (node === null) {
    // No top bar available: render the content where the page placed it.
    return <>{children}</>;
  }
  return createPortal(children, node);
}
