import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiStar, FiUpload, FiX } from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Upload the chosen photos first; the review itself only carries the resulting URLs.
export const uploadReviewPhotos = async (files) => {
  if (!files?.length) return [];
  const formData = new FormData();
  files.forEach((f) => formData.append('images', f));
  const res = await api.post('/user/reviews/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const urls = res?.data?.urls ?? res?.urls ?? res?.data?.data?.urls;
  if (!Array.isArray(urls) || urls.length !== files.length) {
    throw new Error('Photo upload failed');
  }
  return urls;
};

const ReviewForm = ({ productId, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const handleImageUpload = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const valid = picked.filter((f) => {
      if (!PHOTO_TYPES.includes(f.type)) {
        toast.error(`${f.name}: only JPG, PNG, WEBP or GIF photos are allowed`);
        return false;
      }
      if (f.size > MAX_PHOTO_BYTES) {
        toast.error(`${f.name} is larger than 5 MB`);
        return false;
      }
      return true;
    });
    if (images.length + valid.length > MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
    }
    setImages([...images, ...valid.slice(0, MAX_PHOTOS - images.length)]);
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const onFormSubmit = async (data) => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (!onSubmit || submitting) return;
    setSubmitting(true);
    try {
      let imageUrls = [];
      try {
        imageUrls = await uploadReviewPhotos(images);
      } catch (err) {
        toast.error(err?.response?.data?.message || err?.message || 'Could not upload photos. Please try again.');
        return;
      }

      const reviewData = {
        ...data,
        rating,
        images: imageUrls,
        productId,
        date: new Date().toISOString(),
      };

      const result = await onSubmit(reviewData);
      if (result === false) {
        return;
      }
      reset();
      setRating(0);
      setImages([]);
      toast.success('Review submitted! It will appear after approval.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6 mb-8"
    >
      <h3 className="text-xl font-bold text-gray-800 mb-6">Write a Review</h3>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
        {/* Rating */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="focus:outline-none"
              >
                <FiStar
                  className={`text-3xl transition-colors ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-gray-600">({rating} out of 5)</span>
            )}
          </div>
        </div>

        {/* Review Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Review Title
          </label>
          <input
            type="text"
            {...register('title', {
              required: 'Review title is required',
              minLength: {
                value: 3,
                message: 'Title must be at least 3 characters',
              },
            })}
            className={`w-full px-4 py-3 rounded-xl border-2 ${
              errors.title
                ? 'border-red-300 focus:border-red-500'
                : 'border-gray-200 focus:border-green-500'
            } focus:outline-none transition-colors`}
            placeholder="Give your review a title"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        {/* Review Text */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Your Review <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('comment', {
              required: 'Review text is required',
              minLength: {
                value: 10,
                message: 'Review must be at least 10 characters',
              },
            })}
            rows={5}
            className={`w-full px-4 py-3 rounded-xl border-2 ${
              errors.comment
                ? 'border-red-300 focus:border-red-500'
                : 'border-gray-200 focus:border-green-500'
            } focus:outline-none transition-colors resize-none`}
            placeholder="Share your experience with this product..."
          />
          {errors.comment && (
            <p className="mt-1 text-sm text-red-600">{errors.comment.message}</p>
          )}
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Photos (Optional, max 3)
          </label>
          <div className="flex flex-wrap gap-3">
            {images.map((image, index) => (
              <div key={`${image.name}-${index}`} className="relative" data-testid="review-photo-preview">
                <img
                  src={URL.createObjectURL(image)}
                  alt={`Review ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <FiX className="text-xs" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-green-500 transition-colors">
                <FiUpload className="text-gray-400 text-xl" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  data-testid="review-photo-input"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-8 py-3 gradient-green text-white rounded-xl font-semibold hover:shadow-glow-green transition-all duration-300 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {submitting ? (images.length ? 'Uploading photos…' : 'Submitting…') : 'Submit Review'}
        </button>
      </form>
    </motion.div>
  );
};

export default ReviewForm;

