import { env } from "cloudflare:workers";

export const DRAWINGS_PREFIX = "months/";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGE_LENGTH = 300;

const DEFAULT_UPLOAD_CODE_HASH =
  "45ba979e05707044b4a7ba71e14e62c9f56dc4ced0d1b0f8630bca352afa0e32";

type StoredDrawingObject = {
  body: ReadableStream<Uint8Array>;
  etag: string;
  httpEtag?: string;
  uploaded: Date;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
  writeHttpMetadata?: (headers: Headers) => void;
};

type ListedDrawingObject = Omit<StoredDrawingObject, "body"> & {
  key: string;
};

type DrawingsBucket = {
  get: (key: string) => Promise<StoredDrawingObject | null>;
  put: (
    key: string,
    value: ArrayBuffer,
    options: {
      httpMetadata: {
        contentType: string;
        cacheControl: string;
      };
      customMetadata: Record<string, string>;
    },
  ) => Promise<ListedDrawingObject>;
  list: (options: {
    prefix: string;
    cursor?: string;
    include: string[];
  }) => Promise<{
    objects: ListedDrawingObject[];
    truncated: boolean;
    cursor?: string;
  }>;
};

type DrawingsRuntimeEnv = {
  DRAWINGS?: DrawingsBucket;
  DRAWING_UPLOAD_CODE_HASH?: string;
};

export function getDrawingsBucket(): DrawingsBucket {
  const bucket = (env as unknown as DrawingsRuntimeEnv).DRAWINGS;
  if (!bucket) {
    throw new Error("R2 binding DRAWINGS is unavailable.");
  }
  return bucket;
}

export function getDrawingKey(monthId: string) {
  return `${DRAWINGS_PREFIX}${monthId}`;
}

export function isAllowedMonthId(monthId: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthId);
  if (!match) return false;

  const monthIndex = Number(match[1]) * 12 + Number(match[2]) - 1;
  const firstMonthIndex = 2025 * 12 + 2;
  const now = new Date();
  const lastCompletedMonthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth() - 1;
  return monthIndex >= firstMonthIndex && monthIndex <= lastCompletedMonthIndex;
}

export function normalizeMessage(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

export async function verifyUploadCode(code: string) {
  const expectedHash =
    (env as unknown as DrawingsRuntimeEnv).DRAWING_UPLOAD_CODE_HASH ||
    DEFAULT_UPLOAD_CODE_HASH;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  const actualHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  if (actualHash.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < actualHash.length; index += 1) {
    difference |= actualHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

export function isSupportedImage(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  if (contentType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }

  return false;
}
