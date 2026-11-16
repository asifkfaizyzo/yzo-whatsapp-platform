import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { MEDIA_CONFIG } from "../constants/media.config.js";

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error(`${path.basename(command)} timed out`));
    }, 30_000);

    const finish = (error, output) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(output);
    };

    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-64_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4_000);
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (code === 0) {
        finish(null, stdout);
      } else {
        finish(
          new Error(
            `${path.basename(command)} failed (${code}): ${stderr.trim()}`,
          ),
        );
      }
    });
  });

export const inspectAudioFile = async (filePath) => {
  const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";
  let probeOutput;

  try {
    probeOutput = await runCommand(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=format_name:stream=codec_type,codec_name,nb_read_packets",
      "-count_packets",
      "-of",
      "json",
      path.resolve(filePath),
    ]);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "FFprobe is required to validate audio uploads. Install FFmpeg or set FFPROBE_PATH.",
      );
    }
    throw error;
  }

  let metadata;
  try {
    metadata = JSON.parse(probeOutput);
  } catch {
    throw new Error("FFprobe returned invalid audio metadata");
  }

  const audioStream = metadata.streams?.find(
    (stream) => stream.codec_type === "audio",
  );
  if (
    !audioStream ||
    !audioStream.codec_name ||
    audioStream.codec_name === "unknown" ||
    !Number.isFinite(Number(audioStream.nb_read_packets)) ||
    Number(audioStream.nb_read_packets) < 1
  ) {
    throw new Error("The uploaded file does not contain a valid audio stream");
  }

  return {
    formats: (metadata.format?.format_name || "")
      .split(",")
      .map((format) => format.trim().toLowerCase()),
    codec: audioStream.codec_name.toLowerCase(),
  };
};

const getWhatsAppAudioMimeType = ({ formats, codec }) => {
  if (formats.includes("ogg") && codec === "opus") return "audio/ogg";
  if (
    ["mp4", "mov", "m4a", "3gp", "3g2"].some((format) =>
      formats.includes(format),
    ) &&
    codec === "aac"
  ) {
    return "audio/mp4";
  }
  if (
    ["aac", "adts"].some((format) => formats.includes(format)) &&
    codec === "aac"
  ) {
    return "audio/aac";
  }
  if (formats.includes("mp3") && codec === "mp3") return "audio/mpeg";
  if (formats.includes("amr") && ["amr_nb", "amr_wb"].includes(codec)) {
    return "audio/amr";
  }

  throw new Error(
    `Unsupported WhatsApp audio format or codec: ${formats.join(",") || "unknown"} / ${codec}`,
  );
};

const extensionByMimeType = {
  "audio/aac": ".aac",
  "audio/amr": ".amr",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
};

const convertToOggOpus = async (inputPath, originalName) => {
  const resolvedInputPath = path.resolve(inputPath);
  const parsedPath = path.parse(resolvedInputPath);
  const outputPath = path.join(
    parsedPath.dir,
    `${parsedPath.name}-${randomUUID()}.ogg`,
  );
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

  try {
    await runCommand(ffmpegPath, [
      "-y",
      "-i",
      resolvedInputPath,
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "64k",
      "-application",
      "voip",
      "-f",
      "ogg",
      outputPath,
    ]);

    const outputMetadata = await inspectAudioFile(outputPath);
    if (
      !outputMetadata.formats.includes("ogg") ||
      outputMetadata.codec !== "opus"
    ) {
      throw new Error("FFmpeg output is not a valid Ogg/Opus audio file");
    }

    const stats = await fs.promises.stat(outputPath);
    if (stats.size === 0) {
      throw new Error("FFmpeg produced an empty voice message");
    }
    if (stats.size > MEDIA_CONFIG.AUDIO.maxSize) {
      throw new Error("Converted voice message exceeds the WhatsApp audio size limit");
    }

    return {
      path: outputPath,
      size: stats.size,
      originalname: `${path.parse(originalName || parsedPath.base).name}.ogg`,
      mimetype: "audio/ogg",
    };
  } catch (error) {
    await fs.promises.rm(outputPath, { force: true }).catch((cleanupError) => {
      console.warn(
        `Failed to remove invalid audio conversion "${outputPath}":`,
        cleanupError.message,
      );
    });
    if (error.code === "ENOENT") {
      throw new Error(
        "FFmpeg is required to send voice messages. Install FFmpeg or set FFMPEG_PATH.",
      );
    }
    throw error;
  }
};

export const processWhatsAppAudio = async (file, isVoiceNote = false) => {
  const metadata = await inspectAudioFile(file.path);

  if (isVoiceNote) {
    return convertToOggOpus(file.path, file.originalname);
  }

  const mimetype = getWhatsAppAudioMimeType(metadata);
  const originalPath = path.parse(file.originalname || file.path);
  return {
    ...file,
    originalname: `${originalPath.name}${extensionByMimeType[mimetype]}`,
    mimetype,
  };
};
