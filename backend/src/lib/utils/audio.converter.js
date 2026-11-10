import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const convertWebmToOggOpus = async (inputPath, originalName) => {
  const resolvedInputPath = path.resolve(inputPath);
  const parsedPath = path.parse(resolvedInputPath);
  const outputPath = path.join(
    parsedPath.dir,
    `${parsedPath.name}-${randomUUID()}.ogg`,
  );
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

  await new Promise((resolve, reject) => {
    const process = spawn(
      ffmpegPath,
      [
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
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";

    process.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            code === null
              ? "FFmpeg was terminated while converting the voice message"
              : `FFmpeg audio conversion failed (${code}): ${stderr.trim()}`,
          ),
        );
      }
    });
  }).catch(async (error) => {
    await fs.promises.rm(outputPath, { force: true });
    if (error.code === "ENOENT") {
      throw new Error(
        "FFmpeg is required to send recorded voice messages. Install FFmpeg or set FFMPEG_PATH.",
      );
    }
    throw error;
  });

  const stats = await fs.promises.stat(outputPath);
  return {
    path: outputPath,
    size: stats.size,
    originalname: `${path.parse(originalName || parsedPath.base).name}.ogg`,
    mimetype: "audio/ogg",
  };
};
