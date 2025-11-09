/**
 * User Profile Picture Upload - POST /api/users/me/profile-picture
 * 
 * Purpose: Upload and process user profile picture to Azure Blob Storage
 * 
 * This endpoint handles profile picture uploads with comprehensive validation:
 * - File size: Maximum 5MB
 * - File types: JPG, PNG only (validated via magic bytes)
 * - Image resolution: Minimum 512×512, Maximum 2048×2048 pixels
 * - Auto-resize: Images >1024×1024 are resized to 1024×1024
 * - Format conversion: All images converted to JPEG for consistency
 * 
 * Storage:
 * - Container: profile-pictures
 * - Filename: {userId}.jpg (overwrites previous image)
 * - Content-Type: image/jpeg
 * - Public read access (CDN-friendly)
 * 
 * Processing Pipeline:
 * 1. Extract file from multipart/form-data
 * 2. Validate file size (<5MB)
 * 3. Validate magic bytes (JPG/PNG)
 * 4. Load image with sharp, validate dimensions
 * 5. Resize if needed (>1024×1024 → 1024×1024)
 * 6. Convert to JPEG format
 * 7. Upload to Azure Blob Storage
 * 8. Update user profile with new URL
 * 9. Return updated profile
 * 
 * Dependencies:
 * - sharp: Image processing and validation
 * - @azure/storage-blob: Azure Blob Storage SDK
 * 
 * NOTE: This implementation uses a simplified approach for MVP.
 * For production at scale, consider:
 * - Azure Functions Blob binding for direct upload
 * - Azure CDN for profile picture delivery
 * - Background job queue for image processing
 * - Image optimization (WebP format)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { BlobServiceClient } from '@azure/storage-blob';
import { validateJWT } from '../../middleware/auth';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { ApiResponse, UserProfile, ErrorCode } from '../../types/shared';

// Note: sharp will be installed as a dependency
// For now, we'll create a placeholder that can be replaced when sharp is available
interface SharpInstance {
  metadata(): Promise<{ width?: number; height?: number; format?: string }>;
  resize(width: number, height: number, options?: any): SharpInstance;
  jpeg(options?: any): SharpInstance;
  toBuffer(): Promise<Buffer>;
}

// Placeholder for sharp - will be replaced with actual import after npm install
let sharp: ((input: Buffer) => SharpInstance) | null = null;
try {
  sharp = require('sharp');
} catch {
  // sharp not installed yet - will be added to package.json
  console.warn('sharp module not found - install with: npm install sharp');
}

/**
 * Image validation constants
 */
const VALIDATION = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MIN_WIDTH: 512,
  MIN_HEIGHT: 512,
  MAX_WIDTH: 2048,
  MAX_HEIGHT: 2048,
  RESIZE_THRESHOLD: 1024,
  RESIZE_WIDTH: 1024,
  RESIZE_HEIGHT: 1024,
  JPEG_QUALITY: 85,
} as const;

/**
 * Magic bytes for file type validation
 */
const MAGIC_BYTES = {
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47],
} as const;

/**
 * Upload profile picture
 * 
 * @param request - HTTP request with multipart/form-data
 * @param context - Function invocation context
 * @returns Updated user profile with new profilePictureUrl
 */
async function uploadProfilePicture(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(
      ErrorCode.AUTH_INVALID,
      'Invalid or missing authentication token',
      401
    );
  }

  // Check if sharp is available
  if (!sharp) {
    context.error('sharp module not installed');
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Image processing module not available. Please contact support.',
      503
    );
  }

  try {
    // Extract file from request body
    const fileBuffer = await extractFileFromRequest(request);

    if (!fileBuffer) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'No file provided. Please upload an image file.',
        400
      );
    }

    // Validate file size
    if (fileBuffer.length > VALIDATION.MAX_FILE_SIZE) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `File size exceeds maximum of 5MB. Your file: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`,
        400
      );
    }

    // Validate magic bytes (file type)
    const validationType = validateMagicBytes(fileBuffer);
    if (!validationType) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid file type. Only JPG and PNG images are supported.',
        400
      );
    }

    // Process image with sharp
    let imageBuffer: Buffer;
    try {
      const image = sharp(fileBuffer);
      const metadata = await image.metadata();

      // Validate dimensions
      if (!metadata.width || !metadata.height) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Unable to read image dimensions. Please try a different image.',
          400
        );
      }

      if (metadata.width < VALIDATION.MIN_WIDTH || metadata.height < VALIDATION.MIN_HEIGHT) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Image too small. Minimum resolution: ${VALIDATION.MIN_WIDTH}×${VALIDATION.MIN_HEIGHT}px. Your image: ${metadata.width}×${metadata.height}px`,
          400
        );
      }

      if (metadata.width > VALIDATION.MAX_WIDTH || metadata.height > VALIDATION.MAX_HEIGHT) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Image too large. Maximum resolution: ${VALIDATION.MAX_WIDTH}×${VALIDATION.MAX_HEIGHT}px. Your image: ${metadata.width}×${metadata.height}px`,
          400
        );
      }

      // Resize if needed and convert to JPEG
      let processedImage = image;

      if (metadata.width > VALIDATION.RESIZE_THRESHOLD || metadata.height > VALIDATION.RESIZE_THRESHOLD) {
        context.info(`Resizing image from ${metadata.width}×${metadata.height} to ${VALIDATION.RESIZE_WIDTH}×${VALIDATION.RESIZE_HEIGHT}`);
        processedImage = processedImage.resize(VALIDATION.RESIZE_WIDTH, VALIDATION.RESIZE_HEIGHT, {
          fit: 'cover',
          position: 'center',
        });
      }

      // Convert to JPEG
      processedImage = processedImage.jpeg({ quality: VALIDATION.JPEG_QUALITY });
      imageBuffer = await processedImage.toBuffer();

      context.info(`Image processed: ${imageBuffer.length} bytes`);

    } catch (error: any) {
      context.error('Error processing image with sharp:', error);
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Failed to process image. Please ensure the file is a valid JPG or PNG image.',
        400
      );
    }

    // Upload to Azure Blob Storage
    const userId = authContext.userId;
    const profilePictureUrl = await uploadToBlob(imageBuffer, userId, context);

    // Update user profile
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getUsersContainer();

    const { resource: existingProfile } = await container.item(userId, userId).read<UserProfile>();

    if (!existingProfile) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        'User profile not found. Please try logging in again.',
        404
      );
    }

    const updatedProfile: UserProfile = {
      ...existingProfile,
      profilePictureUrl,
      updatedAt: new Date().toISOString(),
    };

    const { resource: savedProfile } = await container.item(userId, userId).replace(updatedProfile);

    if (!savedProfile) {
      throw new Error('Failed to save updated profile');
    }

    context.info(`Profile picture updated for user: ${userId}`);

    // Return updated profile (exclude _etag)
    const profileResponse: Omit<UserProfile, '_etag'> = {
      id: savedProfile.id,
      type: savedProfile.type,
      userId: savedProfile.userId,
      email: savedProfile.email,
      displayName: savedProfile.displayName,
      profilePictureUrl: savedProfile.profilePictureUrl,
      timezone: savedProfile.timezone,
      currency: savedProfile.currency,
      preferences: savedProfile.preferences,
      createdAt: savedProfile.createdAt,
      lastLoginAt: savedProfile.lastLoginAt,
      updatedAt: savedProfile.updatedAt,
    };

    return createSuccessResponse(profileResponse);

  } catch (error: any) {
    context.error('Error uploading profile picture:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to upload profile picture. Please try again.',
      500
    );
  }
}

/**
 * Extract file buffer from multipart/form-data request
 * 
 * Note: Azure Functions v4 provides request.arrayBuffer() for binary data
 * This is a simplified implementation for MVP
 */
async function extractFileFromRequest(request: HttpRequest): Promise<Buffer | null> {
  try {
    // Get request body as ArrayBuffer
    const arrayBuffer = await request.arrayBuffer();
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return null;
    }

    // Convert ArrayBuffer to Buffer
    return Buffer.from(arrayBuffer);

  } catch (error) {
    console.error('Error extracting file from request:', error);
    return null;
  }
}

/**
 * Validate file type using magic bytes
 * 
 * @param buffer - File buffer
 * @returns File type ('jpeg' | 'png') or null if invalid
 */
function validateMagicBytes(buffer: Buffer): 'jpeg' | 'png' | null {
  if (buffer.length < 4) {
    return null;
  }

  // Check JPEG magic bytes (FF D8 FF)
  if (
    buffer[0] === MAGIC_BYTES.JPEG[0] &&
    buffer[1] === MAGIC_BYTES.JPEG[1] &&
    buffer[2] === MAGIC_BYTES.JPEG[2]
  ) {
    return 'jpeg';
  }

  // Check PNG magic bytes (89 50 4E 47)
  if (
    buffer[0] === MAGIC_BYTES.PNG[0] &&
    buffer[1] === MAGIC_BYTES.PNG[1] &&
    buffer[2] === MAGIC_BYTES.PNG[2] &&
    buffer[3] === MAGIC_BYTES.PNG[3]
  ) {
    return 'png';
  }

  return null;
}

/**
 * Upload image to Azure Blob Storage
 * 
 * @param imageBuffer - Processed image buffer
 * @param userId - User ID for filename
 * @param context - Function invocation context
 * @returns Public URL of uploaded image
 */
async function uploadToBlob(
  imageBuffer: Buffer,
  userId: string,
  context: InvocationContext
): Promise<string> {
  const connectionString = process.env.BLOB_CONNECTION_STRING;
  
  if (!connectionString) {
    throw new Error('BLOB_CONNECTION_STRING not configured');
  }

  const containerName = 'profile-pictures';
  const blobName = `${userId}.jpg`;

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Ensure container exists (create if not)
  await containerClient.createIfNotExists({
    access: 'blob', // Public read access for CDN
  });

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload image
  await blockBlobClient.uploadData(imageBuffer, {
    blobHTTPHeaders: {
      blobContentType: 'image/jpeg',
      blobCacheControl: 'public, max-age=31536000', // Cache for 1 year
    },
  });

  context.info(`Image uploaded to blob: ${blobName}`);

  // Return public URL
  return blockBlobClient.url;
}

/**
 * Create success response with data
 */
function createSuccessResponse<T>(data: T): HttpResponseInit {
  const response: ApiResponse<T> = {
    success: true,
    data
  };

  return {
    status: 200,
    jsonBody: response,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

/**
 * Create error response
 */
function createErrorResponse(code: ErrorCode, message: string, status: number): HttpResponseInit {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message
    }
  };

  return {
    status,
    jsonBody: response,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

// Register route
app.http('users-upload-profile-picture', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'users/me/profile-picture',
  handler: uploadProfilePicture
});
