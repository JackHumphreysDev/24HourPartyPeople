import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

class UnsupportedImageTypeError extends Error {}

const upload = multer({
  fileFilter: (_request, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new UnsupportedImageTypeError());
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  storage: multer.memoryStorage(),
}).single('profilePicture');

export function parsePlayerImage(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  upload(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (
      error instanceof multer.MulterError &&
      error.code === 'LIMIT_FILE_SIZE'
    ) {
      response.status(413).json({
        error: {
          code: 'IMAGE_TOO_LARGE',
          message: 'Player images must be 5 MB or smaller.',
        },
      });
      return;
    }

    if (error instanceof UnsupportedImageTypeError) {
      response.status(400).json({
        error: {
          code: 'UNSUPPORTED_IMAGE_TYPE',
          message: 'Player images must be JPEG, PNG, or WebP files.',
        },
      });
      return;
    }

    next(error);
  });
}
