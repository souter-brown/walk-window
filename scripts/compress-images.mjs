import sharp from "sharp";
import { rename, unlink } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const targets = [
  { file: "public/brand-mark.png", width: 512, height: 512 },
  { file: "public/icon.png", width: 512, height: 512 },
  { file: "public/icon-512.png", width: 512, height: 512 },
  { file: "src/app/icon.png", width: 512, height: 512 },
  { file: "src/app/apple-icon.png", width: 180, height: 180 },
];

for (const { file, width, height } of targets) {
  const input = path.join(root, file);
  const output = `${input}.optimized.png`;

  await sharp(input)
    .resize(width, height, { fit: "cover", withoutEnlargement: true })
    .png({ quality: 82, compressionLevel: 9, effort: 10 })
    .toFile(output);

  await unlink(input).catch(() => {});
  await rename(output, input);

  const stat = await import("node:fs/promises").then((fs) => fs.stat(input));
  console.log(`${file}: ${width}x${height}, ${Math.round(stat.size / 1024)} KB`);
}
