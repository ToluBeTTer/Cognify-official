import { supabase } from '@/lib/supabase';

interface VideoResponseLike {
  video_url: string | null;
  video_storage_path?: string | null;
  video_storage_bucket?: string | null;
}

/**
 * Resolves the actual, currently-playable URL for a response's video.
 *
 * Why this exists: when a creator uploads a video file, the submission flow
 * stores a *signed* Supabase Storage URL (valid ~7 days) directly in
 * `video_url` — as if it were permanent. It isn't. After the signature
 * expires, the stored URL 404s forever even though the file is still sitting
 * in storage, because `video_storage_path` (the actual permanent reference)
 * is never used again after upload.
 *
 * This regenerates a fresh signed URL from `video_storage_path` every time
 * it's called, so playback keeps working indefinitely. If there's no
 * storage path (the creator just pasted an external link, e.g. Loom/YouTube),
 * `video_url` is used as-is since that case really is permanent.
 */
async function resolveVideoUrl(
  videoUrl: string | null,
  storagePath: string | null | undefined,
  bucket: string | null | undefined
): Promise<string | null> {
  if (storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket || 'response-videos')
        .createSignedUrl(storagePath, 3600);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (err) {
      console.error('Failed to refresh signed video URL, falling back to stored value:', err);
    }
  }
  return videoUrl ?? null;
}

export async function resolveResponseVideoUrl(response: VideoResponseLike): Promise<string | null> {
  return resolveVideoUrl(response.video_url, response.video_storage_path, response.video_storage_bucket);
}

interface LibraryVideoLike {
  video_url: string;
  video_storage_path?: string | null;
  video_storage_bucket?: string | null;
}

/** Same expiring-signed-URL fix as resolveResponseVideoUrl, for Video Library rows. */
export async function resolveLibraryVideoUrl(video: LibraryVideoLike): Promise<string | null> {
  return resolveVideoUrl(video.video_url, video.video_storage_path, video.video_storage_bucket);
}
