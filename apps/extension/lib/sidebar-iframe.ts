type SidebarElement = {
  style: Pick<CSSStyleDeclaration, "left" | "pointerEvents" | "right" | "transition" | "width">;
};

export function setSidebarIframeExpanded(
  iframe: SidebarElement,
  iframeContainer: SidebarElement,
  expanded: boolean
) {
  iframe.style.transition = "none";
  iframe.style.width = expanded ? "100vw" : "400px";
  iframe.style.pointerEvents = expanded ? "none" : "auto";
  iframeContainer.style.width = expanded ? "100%" : "400px";
  iframeContainer.style.left = expanded ? "0" : "auto";
  iframeContainer.style.right = "0";
}
