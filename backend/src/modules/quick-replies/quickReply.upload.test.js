import assert from "node:assert/strict";
import { test } from "node:test";
import { validateQuickReplyMediaFile } from "./quickReply.upload.js";

test("validates Quick Reply image MIME types against extensions and limits", () => {
  assert.deepEqual(
    validateQuickReplyMediaFile({
      originalname: "offer.JPG",
      mimetype: "image/jpg",
      size: 1024,
    }),
    { mediaType: "IMAGE", mediaMimeType: "image/jpeg" },
  );

  assert.throws(
    () =>
      validateQuickReplyMediaFile({
        originalname: "offer.png",
        mimetype: "image/jpeg",
        size: 1024,
      }),
    /File extension does not match/,
  );

  assert.throws(
    () =>
      validateQuickReplyMediaFile({
        originalname: "animation.gif",
        mimetype: "image/gif",
        size: 1024,
      }),
    /Invalid media type/,
  );
});

test("validates Quick Reply video extensions and WhatsApp size limit", () => {
  assert.deepEqual(
    validateQuickReplyMediaFile({
      originalname: "promo.mp4",
      mimetype: "video/mp4",
      size: 16 * 1024 * 1024,
    }),
    { mediaType: "VIDEO", mediaMimeType: "video/mp4" },
  );

  assert.throws(
    () =>
      validateQuickReplyMediaFile({
        originalname: "promo.3gp",
        mimetype: "video/mp4",
        size: 1024,
      }),
    /File extension does not match/,
  );

  assert.throws(
    () =>
      validateQuickReplyMediaFile({
        originalname: "promo.mp4",
        mimetype: "video/mp4",
        size: 16 * 1024 * 1024 + 1,
      }),
    /Video size must be less than/,
  );
});

test("keeps regular audio Quick Replies as audio attachments", () => {
  assert.deepEqual(
    validateQuickReplyMediaFile({
      originalname: "announcement.aac",
      mimetype: "audio/aac",
      size: 1024,
    }),
    { mediaType: "AUDIO", mediaMimeType: "audio/aac" },
  );
});
