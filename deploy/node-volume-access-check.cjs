const fs = require("node:fs");

function assertWritableDirectory(fsApi, directory) {
  const stats = fsApi.statSync(directory);
  if (!stats.isDirectory()) {
    throw new Error(`Storage path is not a directory: ${directory}`);
  }
  fsApi.accessSync(directory, fsApi.constants.W_OK | fsApi.constants.X_OK);
}

function assertOptionalWritableDirectory(fsApi, directory) {
  try {
    fsApi.lstatSync(directory);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  assertWritableDirectory(fsApi, directory);
}

function validateNodeVolumeAccess({
  fsApi = fs,
  uploadsDirectory,
  privateUploadsDirectory
}) {
  assertWritableDirectory(fsApi, uploadsDirectory);
  assertWritableDirectory(fsApi, privateUploadsDirectory);

  for (const name of ["avatars", "receipts", "ids", "logos"]) {
    assertOptionalWritableDirectory(fsApi, `${uploadsDirectory}/${name}`);
  }
  for (const name of ["message-attachments", "auction-documents"]) {
    assertOptionalWritableDirectory(fsApi, `${privateUploadsDirectory}/${name}`);
  }
}

module.exports = { validateNodeVolumeAccess };

if (require.main === module) {
  const [uploadsDirectory, privateUploadsDirectory] = process.argv.slice(2);
  if (!uploadsDirectory || !privateUploadsDirectory) {
    console.error("Storage access check requires public and private upload directories.");
    process.exitCode = 2;
  } else {
    try {
      validateNodeVolumeAccess({ uploadsDirectory, privateUploadsDirectory });
    } catch {
      console.error("Storage access check failed for a required or existing upload directory.");
      process.exitCode = 1;
    }
  }
}
