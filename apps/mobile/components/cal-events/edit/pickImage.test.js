import { describe, expect, jest, test } from "@jest/globals";

const mockLaunchImageLibraryAsync = jest.fn();
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: (...args) => mockLaunchImageLibraryAsync(...args),
}));

const mockShowInfoAlert = jest.fn();
jest.mock("@/utils/alerts", () => ({
  showInfoAlert: (...args) => mockShowInfoAlert(...args),
}));

const { pickCalEventImage } = require("./pickImage");

function pick(asset) {
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///cache/photo", width: 800, height: 600, fileSize: 1000, ...asset }],
  });
  return pickCalEventImage({ maxBytes: 10 * 1024 * 1024 });
}

describe("pickCalEventImage", () => {
  test("uses the picker's MIME type", async () => {
    await expect(pick({ fileName: "photo.png", mimeType: "image/png" })).resolves.toEqual({
      uri: "file:///cache/photo",
      name: "photo.png",
      type: "image/png",
    });
  });

  test("falls back to the file extension when there is no MIME type", async () => {
    await expect(pick({ fileName: "photo.WEBP", mimeType: undefined })).resolves.toMatchObject({
      type: "image/webp",
    });
  });

  test("says so and resolves to null when the picker fails", async () => {
    mockLaunchImageLibraryAsync.mockRejectedValue(new Error("Failed to read picked image"));
    await expect(pickCalEventImage({ maxBytes: 10 * 1024 * 1024 })).resolves.toBeNull();
    expect(mockShowInfoAlert).toHaveBeenCalledWith(
      "Error",
      "Couldn't load the photo. Please try again."
    );
  });

  test("rejects an unsupported MIME type even when the extension looks supported", async () => {
    await expect(pick({ fileName: "animated.jpg", mimeType: "image/gif" })).resolves.toBeNull();
    expect(mockShowInfoAlert).toHaveBeenCalledWith(
      "Unsupported photo",
      "Pick a JPEG, PNG or WebP photo."
    );
  });
});
