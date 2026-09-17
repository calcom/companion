type SidebarElement = {
  style: Pick<CSSStyleDeclaration, "left" | "pointerEvents" | "right" | "transition" | "width">;
};

interface SidebarIframeMode {
  clickThrough: boolean;
  expanded: boolean;
}

interface SidebarIframeMessage {
  modalId?: string;
  source?: string;
  type: "cal-companion-collapse" | "cal-companion-expand";
}

export function createSidebarIframeState() {
  const activeModalIds = new Set<string>();
  let isLegacyFullScreenModalOpen = false;
  let isToastVisible = false;

  return {
    getMode() {
      return getSidebarIframeMode({
        isFullScreenModalOpen: isLegacyFullScreenModalOpen || activeModalIds.size > 0,
        isToastVisible,
      });
    },
    handleMessage({ modalId, source, type }: SidebarIframeMessage) {
      const isExpanding = type === "cal-companion-expand";

      if (source === "toast") {
        isToastVisible = isExpanding;
      } else if (source === "modal" && modalId) {
        if (isExpanding) {
          activeModalIds.add(modalId);
        } else {
          activeModalIds.delete(modalId);
        }
      } else {
        isLegacyFullScreenModalOpen = isExpanding;
      }
    },
  };
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
