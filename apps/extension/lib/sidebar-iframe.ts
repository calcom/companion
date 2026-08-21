type SidebarElement = {
  style: Pick<CSSStyleDeclaration, "left" | "pointerEvents" | "right" | "transition" | "width">;
};

interface SidebarIframeMode {
  clickThrough: boolean;
  expanded: boolean;
}

export function getSidebarIframeMode({
  isFullScreenModalOpen,
  isToastVisible,
}: {
  isFullScreenModalOpen: boolean;
  isToastVisible: boolean;
}): SidebarIframeMode {
  return {
    expanded: isFullScreenModalOpen || isToastVisible,
    clickThrough: isToastVisible && !isFullScreenModalOpen,
  };
}

export function setSidebarIframeExpanded(
  iframe: SidebarElement,
  iframeContainer: SidebarElement,
  { clickThrough, expanded }: SidebarIframeMode
) {
  iframe.style.transition = "none";
  iframe.style.width = expanded ? "100vw" : "400px";
  iframe.style.pointerEvents = clickThrough ? "none" : "auto";
  iframeContainer.style.width = expanded ? "100%" : "400px";
  iframeContainer.style.left = expanded ? "0" : "auto";
  iframeContainer.style.right = "0";
}
