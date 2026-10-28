import { File as StoredFile } from "expo-file-system";
import { Image, type ImageRef } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { CalEventImageFile } from "@/services/calcom";
import { showInfoAlert } from "@/utils/alerts";

const TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const ACCEPTED_TYPES = new Set(Object.values(TYPES_BY_EXTENSION));

/**
 * The most an upload may weigh, whatever the API's own limit. Vercel, in front of API v2, turns
 * away a photo from about 1 MiB with a 503 before the API sees it (PRO-4057).
 */
export const CAL_EVENT_UPLOAD_MAX_BYTES = 1_000_000;

// A photo over the limits is redrawn at most SHRINK_FIRST_SIDE pixels on its longest side, then a
// fifth smaller each time it still weighs too much.
const SHRINK_FIRST_SIDE = 2048;
const SHRINK_STEP = 0.8;
const SHRINK_TRIES = 6;
const SHRINK_QUALITY = 0.8;

/**
 * Lets the user pick a photo from their library for an event's cover or a person's avatar.
 * Resolves to null when they cancel, or (after saying so) when the picker fails or the photo is
 * not a JPEG, PNG or WebP. iPhone HEIC photos come back as JPEG: the picker asks iOS for the
 * compatible form. A photo over the upload limit or `maxDimension` comes back scaled down to fit,
 * in the same proportions.
 */
export async function pickCalEventImage({
  maxBytes,
  maxDimension,
  aspect,
}: {
  maxBytes: number;
  /** The longest side the API takes, in pixels. */
  maxDimension?: number;
  /** Crop to this aspect ratio; free when unset. */
  aspect?: [number, number];
}): Promise<CalEventImageFile | null> {
  // The picker rejects when it can't hand the photo over, e.g. an iCloud original that won't
  // download. Say so: the callers fire this from a tap and drop the promise.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: aspect !== undefined,
    aspect,
    quality: 0.85,
    // The picker otherwise keeps a photo's own format, which for an iPhone's is HEIC (the API
    // turns it away). Cropping goes through another picker, which saves JPEG either way.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  }).catch(() => null);
  if (!result) {
    showInfoAlert("Error", "Couldn't load the photo. Please try again.");
    return null;
  }
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  // Trust the picker's MIME type; the file extension only fills in when it reports none.
  const extension = (asset.fileName ?? asset.uri).split(".").pop()?.toLowerCase() ?? "";
  const type = asset.mimeType || TYPES_BY_EXTENSION[extension];
  if (!type || !ACCEPTED_TYPES.has(type)) {
    showInfoAlert("Unsupported photo", "Pick a JPEG, PNG or WebP photo.");
    return null;
  }
  const name =
    asset.fileName ?? `photo.${type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1]}`;
  // expo-image-picker gives the web its File, which the upload needs there.
  const photo: CalEventImageFile = { uri: asset.uri, name, type, file: asset.file };

  const fitted = await fitImage(photo, asset, {
    maxBytes: Math.min(maxBytes, CAL_EVENT_UPLOAD_MAX_BYTES),
    maxDimension,
  }).catch((error: unknown) => {
    console.error("Failed to scale the photo down", error);
    return "failed" as const;
  });
  if (fitted === "failed") {
    showInfoAlert("Error", "Couldn't load the photo. Please try again.");
    return null;
  }
  if (!fitted) {
    showInfoAlert("Photo too large", "Pick a smaller photo.");
    return null;
  }
  return fitted;
}

/**
 * The photo itself when it's within the limits, else a scaled-down copy in the same proportions,
 * smaller on each try until it is. Null when even the last try weighs too much.
 */
async function fitImage(
  photo: CalEventImageFile,
  { width, height, fileSize }: { width: number; height: number; fileSize?: number },
  { maxBytes, maxDimension = Number.POSITIVE_INFINITY }: { maxBytes: number; maxDimension?: number }
): Promise<CalEventImageFile | null> {
  const longSide = Math.max(width, height);
  if (longSide <= maxDimension && (fileSize ?? byteSize(photo)) <= maxBytes) return photo;

  // A PNG stays a PNG so it keeps any transparency; anything else becomes a JPEG.
  const png = photo.type === "image/png";
  const type = png ? "image/png" : "image/jpeg";
  const name = `${photo.name.replace(/\.[^.]*$/, "")}.${png ? "png" : "jpg"}`;
  let side = Math.min(longSide, maxDimension, SHRINK_FIRST_SIDE);
  // Loaded through expo-image: on iOS the manipulator can't open a file path itself, as it needs the
  // bridge the New Architecture doesn't have. Loading at most `side` pixels also spares decoding a
  // 48 MP photo in full.
  const source = await Image.loadAsync(photo.uri, { maxWidth: side, maxHeight: side });
  try {
    for (let tries = 0; tries < SHRINK_TRIES; tries++) {
      // Given one side, the manipulator works out the other from the photo's proportions.
      const saved = await saveResized(
        source,
        width >= height ? { width: side } : { height: side },
        png ? SaveFormat.PNG : SaveFormat.JPEG
      );
      const copy: CalEventImageFile = { uri: saved.uri, name, type };
      if (photo.file) {
        // The web uploads a File, so the copy needs one too.
        copy.file = new File([await (await fetch(saved.uri)).blob()], name, { type });
      }
      if (byteSize(copy) <= maxBytes) return copy;
      side = Math.floor(side * SHRINK_STEP);
    }
    return null;
  } finally {
    source.release();
  }
}

/** Saves `source` at `size` as a new file, and frees the native images that took, even on failure. */
async function saveResized(
  source: ImageRef,
  size: { width: number } | { height: number },
  format: SaveFormat
) {
  const context = ImageManipulator.manipulate(source).resize(size);
  try {
    const image = await context.renderAsync();
    try {
      return await image.saveAsync({ format, compress: SHRINK_QUALITY });
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** On the web, its File's size; elsewhere, the size of the file the picker or manipulator wrote. */
function byteSize(photo: CalEventImageFile): number {
  return photo.file ? photo.file.size : new StoredFile(photo.uri).size;
}

export const CAL_EVENT_COVER_MAX_BYTES = 10 * 1024 * 1024;
export const CAL_EVENT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const CAL_EVENT_AVATAR_MAX_DIMENSION = 2048;
