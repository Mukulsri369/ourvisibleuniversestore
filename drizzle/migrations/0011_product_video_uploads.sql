-- Product galleries now also accept optional MP4/WebM media. Existing ordering stores the primary selection.
UPDATE storage.buckets SET file_size_limit = CASE WHEN file_size_limit IS NULL THEN NULL ELSE GREATEST(file_size_limit, 52428800) END,
 allowed_mime_types = CASE WHEN allowed_mime_types IS NULL THEN NULL ELSE
 ARRAY(SELECT DISTINCT unnest(allowed_mime_types || ARRAY['video/mp4','video/webm'])) END
 WHERE id = 'store-images';

