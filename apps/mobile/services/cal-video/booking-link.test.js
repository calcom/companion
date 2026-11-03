const { classifyLandingUrl, resolveBookingLink } = require("./booking-link");

const link = {
  kind: "booking",
  origin: "https://app.cal.com",
  host: "app.cal.com",
  bookingUid: "8t9GuhHULYiWHEtZqyhmbV",
  url: "https://app.cal.com/video/8t9GuhHULYiWHEtZqyhmbV",
};

describe("classifyLandingUrl", () => {
  test("reads the outcome pages the web redirects to", () => {
    expect(
      classifyLandingUrl(
        "https://app.cal.com/video/meeting-not-started/8t9GuhHULYiWHEtZqyhmbV",
        link
      )
    ).toEqual({ kind: "not-started" });
    expect(
      classifyLandingUrl("https://app.cal.com/video/meeting-ended/8t9GuhHULYiWHEtZqyhmbV", link)
    ).toEqual({ kind: "ended" });
    expect(classifyLandingUrl("https://app.cal.com/video/no-meeting-found", link)).toEqual({
      kind: "not-found",
    });
    expect(
      classifyLandingUrl("https://app.cal.com/video/no-meeting-found?bookingReferenceUid=x", link)
    ).toEqual({ kind: "not-found" });
  });

  test("a Cal Video room is joined natively", () => {
    expect(classifyLandingUrl("https://cal.video/harbor-thistle-quill", link)).toEqual({
      kind: "room",
      url: "https://cal.video/harbor-thistle-quill",
    });
  });

  test("anything else is the meeting page itself, for a browser", () => {
    expect(classifyLandingUrl(link.url, link)).toEqual({ kind: "web", url: link.url });
    expect(classifyLandingUrl("https://app.cal.com/video/newUid123", link)).toEqual({
      kind: "web",
      url: "https://app.cal.com/video/newUid123",
    });
    expect(classifyLandingUrl("nonsense", link)).toEqual({ kind: "web", url: link.url });
  });
});

describe("resolveBookingLink", () => {
  const answer = (status, url) => async () => ({ ok: status < 400, status, url });

  test("follows the page to its outcome", async () => {
    await expect(
      resolveBookingLink(
        link,
        answer(200, "https://app.cal.com/video/meeting-ended/8t9GuhHULYiWHEtZqyhmbV")
      )
    ).resolves.toEqual({ kind: "ended" });
    await expect(
      resolveBookingLink(link, answer(200, "https://i.cal.video/peer"))
    ).resolves.toEqual({ kind: "room", url: "https://i.cal.video/peer" });
    await expect(resolveBookingLink(link, answer(200, link.url))).resolves.toEqual({
      kind: "web",
      url: link.url,
    });
  });

  test("a missing final URL falls back to the link itself", async () => {
    await expect(resolveBookingLink(link, answer(200, ""))).resolves.toEqual({
      kind: "web",
      url: link.url,
    });
  });

  test("404 is no meeting; a server error is not an answer", async () => {
    await expect(resolveBookingLink(link, answer(404, link.url))).resolves.toEqual({
      kind: "not-found",
    });
    await expect(resolveBookingLink(link, answer(503, link.url))).rejects.toThrow("503");
  });
});
