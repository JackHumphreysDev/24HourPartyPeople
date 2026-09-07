import { v2 as cloudinary } from 'cloudinary';

export type StoredPlayerImage = {
  publicId: string;
  url: string;
};

export class ImageStorageConfigurationError extends Error {
  constructor() {
    super('Cloudinary image storage is not configured.');
    this.name = 'ImageStorageConfigurationError';
  }
}

function configureCloudinary(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new ImageStorageConfigurationError();
  }

  cloudinary.config({
    api_key: apiKey,
    api_secret: apiSecret,
    cloud_name: cloudName,
    secure: true,
  });
}

export async function uploadPlayerImage(
  contents: Buffer,
): Promise<StoredPlayerImage> {
  configureCloudinary();

  const result = await new Promise<{
    public_id: string;
    secure_url: string;
  }>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        folder: '24-hour-party-people/players',
        resource_type: 'image',
        transformation: [
          {
            aspect_ratio: '1:1',
            crop: 'fill',
            fetch_format: 'auto',
            gravity: 'auto',
            height: 800,
            quality: 'auto',
            width: 800,
          },
        ],
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error('Cloudinary did not return an image.'));
          return;
        }

        resolve(uploadResult);
      },
    );

    upload.end(contents);
  });

  return {
    publicId: result.public_id,
    url: result.secure_url,
  };
}

export async function deletePlayerImage(publicId: string): Promise<void> {
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, {
    invalidate: true,
    resource_type: 'image',
  });
}
