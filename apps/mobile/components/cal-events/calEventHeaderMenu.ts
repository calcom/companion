import type { CalEventMenuItem } from "@/components/cal-event-list-item/CalEventMenu.types";
import type { CalEvent } from "@/services/calcom";
import { getCalEventLinkActions } from "@/utils/cal-events";

interface CalEventHeaderMenuHandlers {
  onOpenPage: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onCancel: () => void;
}

/**
 * The "⋯" menu in an event's header, the same on its page and in its editor, in the card menu's
 * order: look at it, hand out its link, then change it. A draft gets its preview, its link and
 * publish; a published or past event its page, link and sharing, and cancel while it's published;
 * a cancelled event its page, whose link isn't handed out, as on the web. Without `canManage`
 * (a co-host) the draft and cancel steps are left out.
 */
export function getCalEventHeaderMenu(
  event: Pick<CalEvent, "status">,
  canManage: boolean,
  handlers: CalEventHeaderMenuHandlers
): CalEventMenuItem[] {
  const copyLink: CalEventMenuItem = {
    label: "Copy link",
    icon: "link-outline",
    systemImage: "link",
    onPress: handlers.onCopyLink,
  };
  if (event.status === "draft") {
    return canManage
      ? [
          {
            label: "Preview",
            icon: "eye-outline",
            systemImage: "eye",
            onPress: handlers.onPreview,
          },
          copyLink,
          {
            label: "Publish",
            icon: "rocket-outline",
            systemImage: "paperplane",
            onPress: handlers.onPublish,
          },
        ]
      : [];
  }
  const items: CalEventMenuItem[] = [
    {
      label: "View event page",
      icon: "compass-outline",
      systemImage: "safari",
      onPress: handlers.onOpenPage,
    },
  ];
  if (getCalEventLinkActions(event.status).canShare) {
    items.push(copyLink, {
      label: "Share event",
      icon: "share-outline",
      systemImage: "square.and.arrow.up",
      onPress: handlers.onShare,
    });
  }
  if (canManage && event.status === "published") {
    items.push({
      label: "Cancel event",
      icon: "ban-outline",
      systemImage: "xmark.circle",
      destructive: true,
      onPress: handlers.onCancel,
    });
  }
  return items;
}
