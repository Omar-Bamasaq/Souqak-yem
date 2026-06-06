import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "../utils/logger.js";

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

  getStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `category-${uniqueSuffix}${ext}`;
        cb(null, filename);
      }
    });
  }

  getFileFilter() {
    return (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed'));
      }
    };
  }

  getUploadMiddleware() {
    return multer({
      storage: this.getStorage(),
      limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
      },
      fileFilter: this.getFileFilter()
    });
  }

  async validateUploadedFile(file) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Check if file exists on disk
    const filePath = path.join(this.uploadDir, file.filename);
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
    const buffer = fs.readFileSync(filePath, { start: 0, end: 12 });
    const isImage = this.isImageBuffer(buffer);
    
    if (!isImage) {
      fs.unlinkSync(filePath);
      throw new Error('Invalid image file type');
    }

    return {
      filename: file.filename,
      originalname: file.originalname,
      size: stats.size,
      mimetype: file.mimetype,
      url: `/uploads/categories/${file.filename}`
    };
  }

  isImageBuffer(buffer) {
    // JPEG signature
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // PNG signature
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // GIF signature
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
    // WebP signature
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
    
    return false;
  }

  async deleteFile(filename) {
    try {
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted category image: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete category image: ${filename}`, error);
      return false;
    }
  }
}

export default new ImageUploadService();
