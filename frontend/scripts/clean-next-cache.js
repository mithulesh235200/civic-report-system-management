const fs = require("fs");
const path = require("path");

const cacheDirs = [".next", "next-cache"];

for (const dir of cacheDirs) {
  const target = path.resolve(process.cwd(), dir);

  try {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 250,
    });
  } catch (error) {
    if (["EPERM", "EBUSY", "ENOTEMPTY"].includes(error.code)) {
      console.warn(`Skipping locked Next.js cache folder: ${dir}. It is safe to continue.`);
      continue;
    }

    throw error;
  }
}
