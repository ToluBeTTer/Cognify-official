'use client';

import { supabase } from '@/lib/supabase';

async function callAdminAI(action: string, payload: Record<string, any>): Promise<any> {
  let token: string | undefined;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch {
    // fall through — the route will reject with a clear 403
  }

  const res = await fetch('/api/admin-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `Admin AI request failed (${res.status})`);
  }
  return json.data;
}

export interface ApplicationAnalysis {
  recommendation: 'approve' | 'reject' | 'review_manually';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  strengths?: string;
  concerns?: string;
}

export interface VideoMetadataSuggestion {
  title: string;
  description: string;
  tags: string[];
  reasoning?: string;
}

export interface TutorResponseAssist {
  suggested_response: string;
  approach: string;
  key_points: string[];
}

/** Analyze a creator/tutor role request against the applicant's own student activity. Admin-only. */
export function analyzeCreatorApplication(application: any, studentProfile: any): Promise<ApplicationAnalysis> {
  return callAdminAI('analyze_application', { application, studentProfile });
}

/** Suggest an improved title/description/tags for a library video. Admin or creator. */
export function optimizeVideoMetadata(video: any): Promise<VideoMetadataSuggestion> {
  return callAdminAI('optimize_video_metadata', { video });
}

/** Draft a starting-point response for a tutor answering a specific student, using the student's weak topics. */
export function assistTutorResponse(question: any, studentProfile: any): Promise<TutorResponseAssist> {
  return callAdminAI('assist_tutor_response', { question, studentProfile });
}
