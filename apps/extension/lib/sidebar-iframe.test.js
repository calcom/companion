import { getSidebarIframeMode, setSidebarIframeExpanded } from "./sidebar-iframe";

function createStyledElement() {
  return {
    style: {
      left: "",
      pointerEvents: "",
      right: "",
      transition: "",
      width: "",
    },
  };
}

describe("setSidebarIframeExpanded", () => {
  test("makes the full-screen notification iframe click-through", () => {
    const iframe = createStyledElement();
    const container = createStyledElement();

    setSidebarIframeExpanded(
      iframe,
      container,
      getSidebarIframeMode({ isFullScreenModalOpen: false, isToastVisible: true })
    );

    expect(iframe.style).toMatchObject({
      pointerEvents: "none",
      transition: "none",
      width: "100vw",
    });
    expect(container.style).toMatchObject({ left: "0", right: "0", width: "100%" });
  });

  test("restores sidebar interaction after the notification collapses", () => {
    const iframe = createStyledElement();
    const container = createStyledElement();

    setSidebarIframeExpanded(
      iframe,
      container,
      getSidebarIframeMode({ isFullScreenModalOpen: false, isToastVisible: false })
    );

    expect(iframe.style).toMatchObject({
      pointerEvents: "auto",
      transition: "none",
      width: "400px",
    });
    expect(container.style).toMatchObject({ left: "auto", right: "0", width: "400px" });
  });

  test("keeps interactive full-screen modals interactive", () => {
    for (const isToastVisible of [false, true]) {
      expect(getSidebarIframeMode({ isFullScreenModalOpen: true, isToastVisible })).toEqual({
        clickThrough: false,
        expanded: true,
      });
    }
  });
});
