const { classifyLandingUrl, readBookingCallPage, resolveBookingLink } = require("./booking-link");

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

// The live 2.0 page, cut to what the app reads: the call frame and the guest-email flag in the
// page's serialized props (escaped, as Next.js streams them).
const page2 = (uid, requireEmail = false, origin = "https://cal.video") =>
  `<html><body><iframe title="Cal Video call" class="fixed inset-0" src="${origin}/embed/booking/${uid}" allow="camera; microphone"></iframe>` +
  `<script>self.__next_f.push([1,"{\\"requireEmailForGuests\\":${requireEmail},\\"videoOrigin\\":\\"${origin}\\"}"])</script></body></html>`;

describe("readBookingCallPage", () => {
  test("a 2.0 page's call frame names the video origin and the current booking", () => {
    expect(readBookingCallPage(page2("newUid123"), link)).toEqual({
      kind: "booking-call",
      appOrigin: "https://app.cal.com",
      host: "app.cal.com",
      bookingUid: "newUid123",
      url: "https://app.cal.com/video/newUid123",
      videoOrigin: "https://cal.video",
      requireEmail: false,
    });
  });

  test("reads whether guests must give an email", () => {
    expect(readBookingCallPage(page2(link.bookingUid, true), link).requireEmail).toBe(true);
  });

  test("a Cal Video 1 page has no call frame", () => {
    expect(readBookingCallPage("<html><body><div id=daily></div></body></html>", link)).toBeNull();
  });

  test("never sends a token to a frame that isn't Cal Video's", () => {
    expect(
      readBookingCallPage(page2(link.bookingUid, false, "https://evil.example"), link)
    ).toBeNull();
    expect(
      readBookingCallPage(page2(link.bookingUid, false, "https://cal.video.evil.example"), link)
    ).toBeNull();
  });
});

describe("resolveBookingLink on a 2.0 page", () => {
  const page = (url, html) => async () => ({ ok: true, status: 200, url, text: async () => html });

  test("joins a 2.0 booking call in the app", async () => {
    await expect(resolveBookingLink(link, page(link.url, page2(link.bookingUid)))).resolves.toEqual(
      {
        kind: "booking-call",
        call: expect.objectContaining({
          bookingUid: link.bookingUid,
          videoOrigin: "https://cal.video",
        }),
      }
    );
  });

  test("follows a reschedule to the booking the page now shows", async () => {
    const landed = "https://app.cal.com/video/newUid123";
    await expect(resolveBookingLink(link, page(landed, page2("newUid123")))).resolves.toEqual({
      kind: "booking-call",
      call: expect.objectContaining({ bookingUid: "newUid123", url: landed }),
    });
  });

  test("a Cal Video 1 page still opens in the browser", async () => {
    await expect(
      resolveBookingLink(link, page(link.url, "<html><body></body></html>"))
    ).resolves.toEqual({ kind: "web", url: link.url });
  });
});
