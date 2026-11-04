import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import {
  identifyImageFormat,
  IMAGE_PROCESSING_LIMITS,
  processPublicImageVariants,
  shouldConvertCategoryRasterImage
} from "./publicImagePipeline.js";
import {
  cleanupRequestUploadStagingDirectory,
  createRequestUploadStagingDirectory,
  registerRequestUploadStagingCleanup
} from "./requestUploadStaging.js";

class ImageUploadService {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'categories');
    this.ensureUploadDir();
  }

  ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async removeStagedSource(filePath) {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Category upload staging file cleanup failed.", {
          message: error.message
        });
      }
    }
  }

  getStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, req.uploadStagingDirectory);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        const ext = path.extname(file.originalname);
        const filename = `category-${uniqueSuffix}${ext}`;
        cb(null, filename);
      }
    });
  }

  getFileFilter() {
    return (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/svg+xml';
      
      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP, SVG) are allowed'));
      }
    };
  }

  getUploadMiddleware() {
    const parser = multer({
      storage: this.getStorage(),
      limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
      },
      fileFilter: this.getFileFilter()
    });
    const wrap = (method, ...args) => {
      const parseRequest = parser[method](...args);
      return (req, res, next) => {
        const stagingRoot = os.tmpdir();
        const stagingPrefix = "souqak-category-upload-";
        void createRequestUploadStagingDirectory(stagingRoot, stagingPrefix).then((directory) => {
          req.uploadStagingDirectory = directory;
          parseRequest(req, res, async (parseError) => {
            if (parseError) {
              try {
                await cleanupRequestUploadStagingDirectory(directory, stagingRoot, stagingPrefix);
              } catch (cleanupError) {
                parseError.cleanupErrors = [cleanupError.message];
                console.error("Category upload cleanup failed after a parsing error.", {
                  message: parseError.message,
                  cleanupError: cleanupError.message
                });
              }
              return next(parseError);
            }
            registerRequestUploadStagingCleanup(req, res, directory, stagingRoot, stagingPrefix);
            next();
          });
        }).catch(next);
      };
    };
    return {
      single: (fieldName) => wrap("single", fieldName),
      array: (fieldName, maxCount) => wrap("array", fieldName, maxCount),
      fields: (fields) => wrap("fields", fields)
    };
  }

  async validateUploadedFile(file, req) {
    if (req) req.uploadStagingActive = true;
    try {
      return await this.validateStagedFile(file);
    } finally {
      if (req?.finishUploadStagingOperation) {
        req.finishUploadStagingOperation();
      }
    }
  }

  async validateStagedFile(file) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Check if file exists on disk
    const filePath = file.path;
    if (!fs.existsSync(filePath)) {
      throw new Error('Uploaded file not found on server');
    }

    // Validate file size
    const stats = fs.statSync(filePath);
    if (stats.size > 5 * 1024 * 1024) {
      // Clean up oversized file
      fs.unlinkSync(filePath);
      throw new Error('File size exceeds 5MB limit');
    }

    // Validate file type by reading magic bytes
    const handle = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(1024);
    let bytesRead;
    try {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, 0);
    } finally {
      fs.closeSync(handle);
    }
    const format = identifyImageFormat(buffer.subarray(0, bytesRead));
    const extension = path.extname(file.filename).toLowerCase();
    const expectedFormats = {
      ".jpg": "jpeg",
      ".jpeg": "jpeg",
      ".png": "png",
      ".gif": "gif",
      ".webp": "webp",
      ".svg": "svg"
    };
    const expectedMimeTypes = {
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml"
    };
    if (!format || expectedFormats[extension] !== format || file.mimetype !== expectedMimeTypes[format]) {
      fs.unlinkSync(filePath);
      throw new Error('Invalid image file type');
    }

    if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
      const metadata = await sharp(filePath, {
        failOn: "warning",
        limitInputPixels: IMAGE_PROCESSING_LIMITS.maxInputPixels
      }).metadata();
      const expectedFormats = { ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp" };
      if (metadata.format !== expectedFormats[extension]) {
        throw new Error("Image content does not match its extension.");
      }

      if (shouldConvertCategoryRasterImage(file.filename, metadata)) {
        const baseName = `category-public-${uuidv4()}`;
        const variants = await processPublicImageVariants({
          sourcePath: filePath,
          destination: this.uploadDir,
          baseName,
          maxInputPixels: IMAGE_PROCESSING_LIMITS.maxInputPixels,
          maxInputDimension: IMAGE_PROCESSING_LIMITS.maxInputDimension
        });
        await this.removeStagedSource(filePath);
        return {
          filename: variants.names.full,
          originalname: file.originalname,
          size: (await fs.promises.stat(variants.paths.full)).size,
          mimetype: "image/webp",
          url: `/uploads/categories/${variants.names.full}`,
          variants: variants.names
        };
      }
    }

    const storedPath = path.join(this.uploadDir, path.basename(file.filename));
    await fs.promises.copyFile(filePath, storedPath, fs.constants.COPYFILE_EXCL);
    await this.removeStagedSource(filePath);
    return {
      filename: file.filename,
      originalname: file.originalname,
      size: stats.size,
      mimetype: file.mimetype,
      url: `/uploads/categories/${file.filename}`
    };
  }

  async deleteFile(filename) {
    try {
      const safeFilename = path.basename(filename);
      const filePath = path.join(this.uploadDir, safeFilename);
      const filesToDelete = [filePath];
      if (/^category-public-[a-z0-9-]+\.webp$/i.test(safeFilename)) {
        const baseName = safeFilename.replace(/\.webp$/i, "");
        filesToDelete.push(
          path.join(this.uploadDir, `${baseName}.med.webp`),
          path.join(this.uploadDir, `${baseName}.thumb.webp`)
        );
      }
      let deletedAny = false;
      for (const targetPath of filesToDelete) {
        try {
          await fs.promises.unlink(targetPath);
          deletedAny = true;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      if (deletedAny) logger.info(`Deleted category image variants: ${safeFilename}`);
      return deletedAny;
    } catch (error) {
      logger.error(`Failed to delete category image: ${filename}`, error);
      return false;
    }
  }
}

export default new ImageUploadService();
