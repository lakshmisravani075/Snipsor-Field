import {onboardingService} from './apiService';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const requireSuccess = response => {
  if (response?.success === false) {
    throw new Error(response.message || 'Unable to save salon images.');
  }
  return response;
};

export const getSalonImages = async salonId => {
  const response = requireSuccess(await onboardingService.getImages(salonId));
  if (!Array.isArray(response?.data)) {
    throw new Error('The server returned an invalid salon image list.');
  }
  return response.data.map(record => {
    if (!record?.image_id || typeof record.image_url !== 'string' || !/^https?:\/\//i.test(record.image_url)) {
      throw new Error('The server returned an image without its ID or URL.');
    }
    return {id: String(record.image_id), uri: record.image_url, uploaded: true};
  });
};

export const uploadSalonImage = async (salonId, photo, onUploaded) => {
  // Keep a successful storage upload across confirmation retries.
  let fileUrl = photo.uploadedUrl;
  if (!fileUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const local = await fetch(photo.uri, {signal: controller.signal});
      const blob = await local.blob();
      const contentType = photo.type || blob.type;
      if (!['image/jpeg', 'image/png'].includes(contentType) || !blob.size || blob.size > MAX_IMAGE_SIZE) {
        throw new Error('Please choose JPG or PNG photos up to 5 MB each.');
      }
      const signed = requireSuccess(await onboardingService.presignImage(salonId, {
        file: {fileName: photo.name, contentType},
      }));
      const upload = signed?.uploads?.[0];
      if (!upload || typeof upload.uploadUrl !== 'string' || !upload.uploadUrl.startsWith('https://') || typeof upload.fileUrl !== 'string' || !upload.fileUrl.startsWith('https://')) {
        throw new Error('The server did not return a valid image upload URL.');
      }
      // Send bytes directly to storage. Never attach the app's bearer token here.
      const result = await fetch(upload.uploadUrl, {
        method: 'PUT', headers: {'Content-Type': contentType}, body: blob, signal: controller.signal,
      });
      if (!result.ok) { throw new Error(`Image upload failed (${result.status}). Please try again.`); }
      fileUrl = upload.fileUrl;
      onUploaded(fileUrl);
    } catch (error) {
      if (error.name === 'AbortError') { throw new Error('Image upload timed out. Please try again.'); }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  // Check persistence first, including when a previous confirmation timed out.
  let images = await getSalonImages(salonId);
  if (!images.some(image => image.uri === fileUrl)) {
    requireSuccess(await onboardingService.confirmImage(salonId, {image: {fileUrl}}));
    images = await getSalonImages(salonId);
  }
  const saved = images.find(image => image.uri === fileUrl);
  if (!saved) { throw new Error('The uploaded image was not returned by the server. Please retry.'); }
  return saved;
};

export const deleteSalonImage = async (salonId, imageId) => {
  requireSuccess(await onboardingService.deleteImage(salonId, imageId));
  return getSalonImages(salonId);
};
