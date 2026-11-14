/**
 * Helpers for viewing / downloading uploaded documents (PDFs, images, ...).
 *
 * Browsers ignore the `download` attribute on cross-origin links, so a Cloudinary
 * PDF would just open in a tab. Cloudinary's `fl_attachment` flag makes the server
 * send Content-Disposition: attachment, which forces a real download.
 */

const CLOUDINARY_UPLOAD_SEGMENT = '/upload/';

export const isCloudinaryUrl = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes(CLOUDINARY_UPLOAD_SEGMENT);

/** URL that downloads the file instead of displaying it. Non-Cloudinary URLs are returned unchanged. */
export const getDownloadUrl = (url) => {
  if (!isCloudinaryUrl(url)) return url || '';
  if (url.includes('/fl_attachment')) return url;
  return url.replace(CLOUDINARY_UPLOAD_SEGMENT, `${CLOUDINARY_UPLOAD_SEGMENT}fl_attachment/`);
};

const stripQuery = (url) => String(url || '').split('?')[0].split('#')[0].toLowerCase();

export const isPdfUrl = (url) => {
  const clean = stripQuery(url);
  return clean.endsWith('.pdf') || clean.includes('/raw/upload/') || clean.includes('application/pdf');
};

export const isImageUrl = (url) => /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/.test(stripQuery(url));
