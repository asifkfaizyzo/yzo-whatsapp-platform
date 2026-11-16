import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { after, test } from "node:test";
import { sendWhatsAppMedia } from "./whatsapp.mediaSender.js";

const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";
const mediaToolsAvailable =
  spawnSync(ffmpegPath, ["-version"], { stdio: "ignore" }).status === 0 &&
  spawnSync(ffprobePath, ["-version"], { stdio: "ignore" }).status === 0;
const temporaryDirectories = [];

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      fs.promises.rm(directory, { recursive: true, force: true }),
    ),
  );
});

const sendWithMockedFetch = async ({
  file,
  mediaType,
  isVoiceNote = false,
  caption = "Quick Reply caption",
  responses = [
    { ok: true, body: { id: "media-123" } },
    { ok: true, body: { messages: [{ id: "wamid-456" }] } },
  ],
}) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    const response = responses[requests.length - 1];
    return {
      ok: response.ok,
      json: async () => response.body,
    };
  };

  try {
    const result = await sendWhatsAppMedia({
      tenant: {
        whatsappAccessToken: "test-access-token",
        whatsappPhoneId: "phone-123",
      },
      contactPhone: "+15551234567",
      file,
      caption,
      mediaType,
      isVoiceNote,
    });
    return { result, requests };
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("uploads and sends Quick Reply image, video, and document payloads", async () => {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "wa-media-sender-test-"),
  );
  temporaryDirectories.push(directory);

  const cases = [
    {
      mediaType: "IMAGE",
      waType: "image",
      filename: "image.jpg",
      mimetype: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    },
    {
      mediaType: "IMAGE",
      waType: "image",
      filename: "legacy-image.jpg",
      mimetype: "image/jpg",
      uploadedMimeType: "image/jpeg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    },
    {
      mediaType: "VIDEO",
      waType: "video",
      filename: "clip.mp4",
      mimetype: "video/mp4",
      bytes: Buffer.from("mp4-content"),
    },
    {
      mediaType: "VIDEO",
      waType: "video",
      filename: "clip.3gp",
      mimetype: "video/3gpp",
      bytes: Buffer.from("3gp-content"),
    },
    {
      mediaType: "FILE",
      waType: "document",
      filename: "guide.pdf",
      mimetype: "application/pdf",
      bytes: Buffer.from("%PDF-test"),
    },
  ];

  for (const media of cases) {
    const filePath = path.join(directory, media.filename);
    await fs.promises.writeFile(filePath, media.bytes);
    const { result, requests } = await sendWithMockedFetch({
      file: {
        path: filePath,
        originalname: media.filename,
        mimetype: media.mimetype,
        size: media.bytes.length,
      },
      mediaType: media.mediaType,
    });

    assert.equal(result.mediaId, "media-123");
    assert.equal(result.waMessageId, "wamid-456");
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /\/phone-123\/media$/);

    const uploadForm = requests[0].options.body;
    const uploadedFile = uploadForm.get("file");
    assert.equal(uploadedFile.name, media.filename);
    assert.equal(
      uploadedFile.type,
      media.uploadedMimeType || media.mimetype,
    );
    assert.deepEqual(
      Buffer.from(await uploadedFile.arrayBuffer()),
      media.bytes,
    );
    assert.equal(uploadForm.get("messaging_product"), "whatsapp");

    assert.match(requests[1].url, /\/phone-123\/messages$/);
    const message = JSON.parse(requests[1].options.body);
    assert.equal(message.type, media.waType);
    assert.equal(message.to, "15551234567");
    assert.equal(message[media.waType].id, "media-123");
    if (media.waType === "document") {
      assert.equal(message.document.filename, media.filename);
    }
    assert.equal(message[media.waType].caption, "Quick Reply caption");
    assert.equal(message.audio, undefined);
  }
});

test(
  "sends regular MP3 audio without conversion or voice-note flag",
  { skip: !mediaToolsAvailable },
  async () => {
    const directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "wa-audio-sender-test-"),
    );
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "announcement.mp3");
    execFileSync(ffmpegPath, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=500:duration=0.1",
      "-c:a",
      "libmp3lame",
      filePath,
    ]);
    const bytes = await fs.promises.readFile(filePath);

    const { result, requests } = await sendWithMockedFetch({
      file: {
        path: filePath,
        originalname: "announcement.mp3",
        mimetype: "audio/ogg; codecs=opus",
        size: bytes.length,
      },
      mediaType: "AUDIO",
    });

    assert.equal(result.waMessageId, "wamid-456");
    assert.equal(requests[0].options.body.get("file").type, "audio/mpeg");
    assert.deepEqual(
      Buffer.from(
        await requests[0].options.body.get("file").arrayBuffer(),
      ),
      bytes,
    );
    const message = JSON.parse(requests[1].options.body);
    assert.equal(message.type, "audio");
    assert.deepEqual(message.audio, { id: "media-123" });
    assert.equal(message.audio.voice, undefined);
  },
);

test(
  "sends Ogg/Opus voice notes with WhatsApp voice flag",
  { skip: !mediaToolsAvailable },
  async () => {
    const directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "wa-voice-note-sender-test-"),
    );
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "voice-note.ogg");
    execFileSync(ffmpegPath, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=700:duration=0.1",
      "-c:a",
      "libopus",
      "-b:a",
      "64k",
      "-application",
      "voip",
      "-f",
      "ogg",
      filePath,
    ]);
    const bytes = await fs.promises.readFile(filePath);

    const { result, requests } = await sendWithMockedFetch({
      file: {
        path: filePath,
        originalname: "voice-note.ogg",
        mimetype: "audio/ogg",
        size: bytes.length,
      },
      mediaType: "AUDIO",
      isVoiceNote: true,
    });

    assert.equal(result.waMessageId, "wamid-456");
    assert.equal(requests[0].options.body.get("file").type, "audio/ogg");
    const message = JSON.parse(requests[1].options.body);
    assert.equal(message.type, "audio");
    assert.deepEqual(message.audio, { id: "media-123", voice: true });
  },
);

test("propagates WhatsApp upload and send failures", async () => {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "wa-media-failure-test-"),
  );
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, "image.png");
  await fs.promises.writeFile(filePath, Buffer.from("png"));
  const file = {
    path: filePath,
    originalname: "image.png",
    mimetype: "image/png",
    size: 3,
  };

  await assert.rejects(
    sendWithMockedFetch({
      file,
      mediaType: "IMAGE",
      responses: [
        { ok: false, body: { error: { message: "upload rejected" } } },
      ],
    }),
    /Media upload failed: upload rejected/,
  );

  await assert.rejects(
    sendWithMockedFetch({
      file,
      mediaType: "IMAGE",
      responses: [
        { ok: true, body: { id: "media-123" } },
        { ok: false, body: { error: { message: "send rejected" } } },
      ],
    }),
    /WhatsApp send failed: send rejected/,
  );
});
