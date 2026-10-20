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
 * Lets the user pick a photo from their library for an event's cover or a person's avatar.
 * Resolves to null when they cancel, or when the photo is too big or not a JPEG, PNG or WebP
 * (after saying so). HEIC photos come back as JPEG, which the picker converts.
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
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: aspect !== undefined,
    aspect,
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  // Trust the picker's MIME type; the file extension only fills in when it reports none.
  const extension = (asset.fileName ?? asset.uri).split(".").pop()?.toLowerCase() ?? "";
  const type = asset.mimeType || TYPES_BY_EXTENSION[extension];
  if (!type || !ACCEPTED_TYPES.has(type)) {
    showInfoAlert("Unsupported photo", "Pick a JPEG, PNG or WebP photo.");
    return null;
  }
  if (asset.fileSize !== undefined && asset.fileSize > maxBytes) {
    showInfoAlert(
      "Photo too large",
      `Pick a photo under ${Math.round(maxBytes / (1024 * 1024))} MB.`
    );
    return null;
  }
  if (maxDimension !== undefined && Math.max(asset.width, asset.height) > maxDimension) {
    showInfoAlert(
      "Photo too large",
      `Pick a photo at most ${maxDimension} pixels wide and high, or crop it smaller.`
    );
    return null;
  }
  const name =
    asset.fileName ?? `photo.${type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1]}`;
  return { uri: asset.uri, name, type };
}

export const CAL_EVENT_COVER_MAX_BYTES = 10 * 1024 * 1024;
export const CAL_EVENT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const CAL_EVENT_AVATAR_MAX_DIMENSION = 2048;
