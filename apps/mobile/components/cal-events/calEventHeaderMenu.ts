import type { CalEventMenuItem } from "@/components/cal-event-list-item/CalEventMenu.types";
import type { CalEvent } from "@/services/calcom";

interface CalEventHeaderMenuHandlers {
  onOpenPage: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onCancel: () => void;
}

/**
 * The "⋯" menu in an event's header, the same on its page and in its editor: a draft's preview
 * and publish, a live event's page, link, sharing and cancel, and otherwise its page. Without
 * `canManage` (a co-host) the draft and cancel steps are left out.
 */
export function getCalEventHeaderMenu(
  event: Pick<CalEvent, "status">,
  canManage: boolean,
  handlers: CalEventHeaderMenuHandlers
): CalEventMenuItem[] {
  const viewPage: CalEventMenuItem = {
    label: "View event page",
    icon: "compass-outline",
    systemImage: "safari",
    onPress: handlers.onOpenPage,
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
          {
            label: "Publish",
            icon: "rocket-outline",
            systemImage: "paperplane",
            onPress: handlers.onPublish,
          },
        ]
      : [];
  }
  if (event.status !== "published") return [viewPage];
  const items: CalEventMenuItem[] = [
    viewPage,
    { label: "Copy link", icon: "link-outline", systemImage: "link", onPress: handlers.onCopyLink },
    {
      label: "Share event",
      icon: "share-outline",
      systemImage: "square.and.arrow.up",
      onPress: handlers.onShare,
    },
  ];
  if (canManage) {
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
