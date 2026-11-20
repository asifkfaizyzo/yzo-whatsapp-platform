import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { after, test } from "node:test";
import { normalizeMimeType } from "./media.validator.js";
import { inspectAudioFile, processWhatsAppAudio } from "./audio.converter.js";

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

test("normalizes audio MIME types with codec parameters", () => {
  assert.equal(normalizeMimeType(" Audio/Ogg ; codecs=opus "), "audio/ogg");
});

test(
  "probes real audio and only converts explicitly identified voice notes",
  { skip: !mediaToolsAvailable },
  async () => {
    const directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "wa-audio-test-"),
    );
    temporaryDirectories.push(directory);
    const webmPath = path.join(directory, "voice.webm");
    const wavPath = path.join(directory, "voice.wav");
    const mp3Path = path.join(directory, "music.mp3");
    const invalidPath = path.join(directory, "invalid.txt");

    execFileSync(ffmpegPath, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=0.1",
      "-c:a",
      "libopus",
      "-f",
      "webm",
      webmPath,
    ]);
    execFileSync(ffmpegPath, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=700:duration=0.1",
      wavPath,
    ]);
    execFileSync(ffmpegPath, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=500:duration=0.1",
      "-c:a",
      "libmp3lame",
      mp3Path,
    ]);
    await fs.promises.writeFile(invalidPath, "not audio");

    const voice = await processWhatsAppAudio(
      {
        path: webmPath,
        originalname: "voice.webm",
        mimetype: "application/octet-stream",
      },
      true,
    );
    const voiceMetadata = await inspectAudioFile(voice.path);
    assert.equal(voice.mimetype, "audio/ogg");
    assert.equal(voiceMetadata.formats.includes("ogg"), true);
    assert.equal(voiceMetadata.codec, "opus");

    const wavVoice = await processWhatsAppAudio(
      {
        path: wavPath,
        originalname: "voice.wav",
        mimetype: "audio/wav",
      },
      true,
    );
    assert.equal(wavVoice.mimetype, "audio/ogg");
    assert.equal((await inspectAudioFile(wavVoice.path)).codec, "opus");

    const audio = await processWhatsAppAudio(
      {
        path: mp3Path,
        originalname: "music.ogg",
        mimetype: "audio/ogg; codecs=opus",
      },
      false,
    );
    assert.equal(audio.path, mp3Path);
    assert.equal(audio.originalname, "music.mp3");
    assert.equal(audio.mimetype, "audio/mpeg");

    await assert.rejects(
      processWhatsAppAudio(
        {
          path: webmPath,
          originalname: "voice.webm",
          mimetype: "audio/mpeg",
        },
        false,
      ),
      /Unsupported WhatsApp audio format or codec/,
    );
    await assert.rejects(inspectAudioFile(invalidPath));

    const previousFfmpegPath = process.env.FFMPEG_PATH;
    const oggFilesBefore = (await fs.promises.readdir(directory)).filter(
      (name) => name.endsWith(".ogg"),
    ).length;
    process.env.FFMPEG_PATH = path.join(directory, "missing-ffmpeg.exe");
    try {
      await assert.rejects(
        processWhatsAppAudio(
          {
            path: wavPath,
            originalname: "voice.wav",
            mimetype: "audio/wav",
          },
          true,
        ),
        /FFmpeg is required/,
      );
    } finally {
      if (previousFfmpegPath === undefined) {
        delete process.env.FFMPEG_PATH;
      } else {
        process.env.FFMPEG_PATH = previousFfmpegPath;
      }
    }
    const oggFilesAfter = (await fs.promises.readdir(directory)).filter(
      (name) => name.endsWith(".ogg"),
    ).length;
    assert.equal(oggFilesAfter, oggFilesBefore);
  },
);
