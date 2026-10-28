import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockLaunchImageLibraryAsync = jest.fn();
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: (...args) => mockLaunchImageLibraryAsync(...args),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
}));

const mockShowInfoAlert = jest.fn();
jest.mock("@/utils/alerts", () => ({
  showInfoAlert: (...args) => mockShowInfoAlert(...args),
}));

// The manipulator's copies weigh mockShrunk.bytesPerPixel for each pixel of their longest side.
const mockShrunk = {
  loads: [],
  released: 0,
  sources: [],
  resizes: [],
  formats: [],
  sizes: new Map(),
  bytesPerPixel: 1000,
  fail: false,
};
jest.mock("expo-image", () => ({
  Image: {
    loadAsync: async (uri, options) => {
      mockShrunk.loads.push({ uri, options });
      return {
        loadedFrom: uri,
        release: () => {
          mockShrunk.released++;
        },
      };
    },
  },
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
  ImageManipulator: {
    manipulate: (source) => {
      mockShrunk.sources.push(source);
      const context = {
        resize: (size) => {
          mockShrunk.resizes.push(size);
          context.side = size.width ?? size.height;
          return context;
        },
        renderAsync: async () => {
          if (mockShrunk.fail) throw new Error("Could not render the image");
          return {
            saveAsync: async ({ format }) => {
              mockShrunk.formats.push(format);
              const uri = `file:///cache/shrunk-${context.side}.${format}`;
              mockShrunk.sizes.set(uri, context.side * mockShrunk.bytesPerPixel);
              return { uri };
            },
            release: () => {},
          };
        },
        release: () => {},
      };
      return context;
    },
  },
}));

jest.mock("expo-file-system", () => ({
  File: class {
    constructor(uri) {
      this.size = mockShrunk.sizes.get(uri) ?? 0;
    }
  },
}));

const { pickCalEventImage } = require("./pickImage");

beforeEach(() => {
  mockShrunk.loads = [];
  mockShrunk.released = 0;
  mockShrunk.sources = [];
  mockShrunk.resizes = [];
  mockShrunk.formats = [];
  mockShrunk.sizes = new Map();
  mockShrunk.bytesPerPixel = 1000;
  mockShrunk.fail = false;
});

function pick(asset, options = {}) {
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///cache/photo", width: 800, height: 600, fileSize: 1000, ...asset }],
  });
  return pickCalEventImage({ maxBytes: 10 * 1024 * 1024, ...options });
}

/** A 12 MP iPhone photo, re-saved by the picker at 2.5 MB. */
const IPHONE_PHOTO = {
  fileName: "IMG_0001.jpg",
  mimeType: "image/jpeg",
  width: 4032,
  height: 3024,
  fileSize: 2_500_000,
};

describe("pickCalEventImage", () => {
  test("asks iOS for a photo's compatible form, so an iPhone's HEIC comes back as JPEG", async () => {
    await pick({ fileName: "IMG_0001.jpg", mimeType: "image/jpeg" });
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ preferredAssetRepresentationMode: "compatible" })
    );
  });

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

  test("passes on the web's File, which the upload sends there", async () => {
    const file = new File(["png"], "photo.png", { type: "image/png" });
    await expect(pick({ fileName: "photo.png", mimeType: "image/png", file })).resolves.toEqual({
      uri: "file:///cache/photo",
      name: "photo.png",
      type: "image/png",
      file,
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

describe("pickCalEventImage keeps uploads under 1 MB", () => {
  test("leaves a photo under 1 MB as it is", async () => {
    await expect(pick({ ...IPHONE_PHOTO, fileSize: 900_000 })).resolves.toEqual({
      uri: "file:///cache/photo",
      name: "IMG_0001.jpg",
      type: "image/jpeg",
    });
    expect(mockShrunk.resizes).toEqual([]);
  });

  test("scales a heavier photo down, a step at a time, until it's under 1 MB", async () => {
    await expect(pick(IPHONE_PHOTO)).resolves.toEqual({
      uri: "file:///cache/shrunk-838.jpeg",
      name: "IMG_0001.jpg",
      type: "image/jpeg",
    });
    // Only the width is given, so the manipulator keeps the photo's proportions.
    expect(mockShrunk.resizes).toEqual([
      { width: 2048 },
      { width: 1638 },
      { width: 1310 },
      { width: 1048 },
      { width: 838 },
    ]);
  });

  test("scales down the photo expo-image loaded, as iOS can't open its path without the bridge", async () => {
    await pick(IPHONE_PHOTO);
    expect(mockShrunk.loads).toEqual([
      { uri: "file:///cache/photo", options: { maxWidth: 2048, maxHeight: 2048 } },
    ]);
    expect(mockShrunk.sources).toHaveLength(5);
    for (const source of mockShrunk.sources) {
      expect(source).toMatchObject({ loadedFrom: "file:///cache/photo" });
    }
    expect(mockShrunk.released).toBe(1);
  });

  test("holds a portrait photo to its height", async () => {
    await pick({ ...IPHONE_PHOTO, width: 3024, height: 4032 });
    expect(mockShrunk.resizes[0]).toEqual({ height: 2048 });
  });

  test("scales a light photo over maxDimension down to it", async () => {
    mockShrunk.bytesPerPixel = 100;
    const avatar = { ...IPHONE_PHOTO, width: 3000, height: 3000, fileSize: 500_000 };
    await expect(pick(avatar, { maxDimension: 2048 })).resolves.toMatchObject({
      uri: "file:///cache/shrunk-2048.jpeg",
    });
    expect(mockShrunk.resizes).toEqual([{ width: 2048 }]);
  });

  test("keeps a PNG a PNG, so it keeps any transparency", async () => {
    await expect(
      pick({ ...IPHONE_PHOTO, fileName: "logo.png", mimeType: "image/png" })
    ).resolves.toMatchObject({ name: "logo.png", type: "image/png" });
    expect(new Set(mockShrunk.formats)).toEqual(new Set(["png"]));
  });

  test("saves a scaled-down WebP as a JPEG", async () => {
    await expect(
      pick({ ...IPHONE_PHOTO, fileName: "photo.webp", mimeType: "image/webp" })
    ).resolves.toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
    expect(new Set(mockShrunk.formats)).toEqual(new Set(["jpeg"]));
  });

  test("hands the web a File of the scaled-down copy", async () => {
    const realFetch = global.fetch;
    global.fetch = async (uri) => ({
      blob: async () => new Blob([new Uint8Array(mockShrunk.sizes.get(uri))]),
    });
    try {
      const file = new File(["jpeg"], "IMG_0001.jpg", { type: "image/jpeg" });
      const picked = await pick({ ...IPHONE_PHOTO, file });
      expect(picked.file).toBeInstanceOf(File);
      expect(picked.file).toMatchObject({ name: "IMG_0001.jpg", type: "image/jpeg" });
      expect(picked.file.size).toBe(838_000);
    } finally {
      global.fetch = realFetch;
    }
  });

  test("says so when even the smallest try is over 1 MB", async () => {
    mockShrunk.bytesPerPixel = 10_000;
    await expect(pick(IPHONE_PHOTO)).resolves.toBeNull();
    expect(mockShrunk.resizes).toHaveLength(6);
    expect(mockShowInfoAlert).toHaveBeenCalledWith("Photo too large", "Pick a smaller photo.");
  });

  test("says so, and logs why, when the photo can't be scaled down", async () => {
    mockShrunk.fail = true;
    mockShowInfoAlert.mockClear();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(pick(IPHONE_PHOTO)).resolves.toBeNull();
      expect(mockShowInfoAlert).toHaveBeenCalledWith(
        "Error",
        "Couldn't load the photo. Please try again."
      );
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to scale the photo down",
        new Error("Could not render the image")
      );
      expect(mockShrunk.released).toBe(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
