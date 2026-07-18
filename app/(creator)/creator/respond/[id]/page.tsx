'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Send, Save, ImageIcon, User, Upload, Video, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { assistTutorResponse, type TutorResponseAssist } from '@/lib/ai/admin-ai-client';

type Question = Database['public']['Tables']['questions']['Row'];
type AIResponse = Database['public']['Tables']['ai_responses']['Row'];

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  storage_path: string;
  storage_bucket: string;
  signedUrl?: string;
}

interface StudentProfile {
  full_name: string | null;
  grade_level: number | null;
  target_sat_score: number | null;
  preferred_subjects: string[] | null;
  bio: string | null;
}

export default function CreatorRespondPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const questionId = params.id as string;
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [claim, setClaim] = useState<{ id: string } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [isAssisting, setIsAssisting] = useState(false);
  const [assistResult, setAssistResult] = useState<TutorResponseAssist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [teachingNotes, setTeachingNotes] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [uploadedVideoPath, setUploadedVideoPath] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !questionId) return;
      try {
        const [questionRes, aiRes, claimRes] = await Promise.all([
          supabase.from('questions').select('*').eq('id', questionId).maybeSingle(),
          supabase.from('ai_responses').select('*').eq('question_id', questionId).maybeSingle(),
          supabase.from('question_claims').select('id').eq('question_id', questionId).eq('creator_id', user.id).in('status', ['claimed', 'in_progress']).maybeSingle(),
        ]);
        if (questionRes.error) throw questionRes.error;
        if (!questionRes.data) { router.push('/creator/queue'); return; }
        setQuestion(questionRes.data);
        setAiResponse(aiRes.data);
        setClaim(claimRes.data);

        // Fetch attachments
        const { data: attachmentData } = await supabase
          .from('attachments')
          .select('id, file_name, file_type, mime_type, storage_path, storage_bucket')
          .eq('question_id', questionId);

        if (attachmentData && attachmentData.length > 0) {
          const withUrls = await Promise.all(
            attachmentData.map(async (att: Attachment) => {
              try {
                const { data: urlData } = await supabase.storage
                  .from(att.storage_bucket || 'question-attachments')
                  .createSignedUrl(att.storage_path, 3600);
                return { ...att, signedUrl: urlData?.signedUrl };
              } catch {
                return att;
              }
            })
          );
          setAttachments(withUrls);
        }

        // Fetch student profile (allowed during active claim)
        if (questionRes.data.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, grade_level, target_sat_score, preferred_subjects, bio')
            .eq('user_id', questionRes.data.user_id)
            .maybeSingle();
          setStudentProfile(profileData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, questionId, router]);

  // Handle video file selection
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      toast.error('Video must be under 500MB');
      return;
    }

    setVideoFile(file);
    setVideoUrl(''); // Clear external URL if file selected
    setUploadedVideoPath(null);

    // Create preview
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
  };

  // Upload video to storage
  const uploadVideo = async (): Promise<string | null> => {
    if (!videoFile || !user) return null;

    setVideoUploading(true);
    setVideoUploadProgress(0);

    try {
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${user.id}/${questionId}/${Date.now()}.${fileExt}`;

      // Upload with progress simulation (Supabase doesn't support progress events natively)
      const { data, error } = await supabase.storage
        .from('response-videos')
        .upload(fileName, videoFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      setVideoUploadProgress(100);
      setUploadedVideoPath(data.path);
      return data.path;
    } catch (error: any) {
      console.error('Video upload error:', error);
      toast.error(`Failed to upload video: ${error?.message || 'Unknown error'}`);
      return null;
    } finally {
      setVideoUploading(false);
    }
  };

  // Clear video
  const clearVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setUploadedVideoPath(null);
    setVideoUploadProgress(0);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleAssistResponse = async () => {
    if (!question) return;
    setIsAssisting(true);
    try {
      const { data: attempts } = await supabase
        .from('practice_attempts')
        .select('is_correct, domain')
        .eq('user_id', question.user_id)
        .order('attempted_at', { ascending: false })
        .limit(150);

      const result = await assistTutorResponse(
        { text: question.content, subject: question.subject_id, topic: null },
        { practiceAttempts: (attempts ?? []).map((a: any) => ({ correct: a.is_correct, topic: a.domain })) }
      );
      setAssistResult(result);
    } catch (err: any) {
      toast.error(err?.message || 'Could not get AI help right now');
    } finally {
      setIsAssisting(false);
    }
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!user || !question) return;
    if (!claim) {
      toast.error('You no longer hold an active claim on this question — reclaim it below before submitting.');
      return;
    }
    if (!explanation.trim()) { toast.error('Please provide an explanation'); return; }
    setIsSubmitting(true);
    try {
      // Upload video if selected
      let finalVideoUrl = videoUrl.trim() || null;
      let videoStoragePath = null;

      if (videoFile) {
        const uploadedPath = await uploadVideo();
        if (uploadedPath) {
          videoStoragePath = uploadedPath;
          // Deliberately NOT storing a signed URL here — signed URLs expire
          // (they used to be stashed in video_url as if permanent, which
          // meant every uploaded video quietly broke a week later). Playback
          // always resolves a fresh signed URL from video_storage_path on
          // demand instead (see lib/supabase/video-url.ts).
          finalVideoUrl = null;
        }
      }

      const { error: responseError } = await supabase.from('human_responses').insert({
        question_id: questionId,
        claim_id: claim.id,
        creator_id: user.id,
        explanation: explanation.trim(),
        teaching_notes: teachingNotes.trim() || null,
        video_url: finalVideoUrl,
        video_storage_path: videoStoragePath,
        video_storage_bucket: videoStoragePath ? 'response-videos' : null,
        status: isDraft ? 'pending' : 'ready',
        is_approved: false,
      });
      if (responseError) throw responseError;

      await Promise.all([
        supabase.from('question_claims').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', claim.id),
        supabase.from('questions').update({ status: isDraft ? 'claimed' : 'human_ready' }).eq('id', questionId),
      ]);

      if (isDraft) {
        toast.success('Draft saved');
      } else {
        toast.success('Response submitted successfully!');
        router.push('/creator/completed');
      }
    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast.error(`Failed to submit response: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isReclaiming, setIsReclaiming] = useState(false);

  const handleReclaim = async () => {
    if (!user || !question) return;
    setIsReclaiming(true);
    try {
      const { data, error } = await supabase
        .from('question_claims')
        .insert({ question_id: question.id, creator_id: user.id, status: 'claimed' })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Someone else currently holds the active claim on this question.');
        } else {
          throw error;
        }
        return;
      }

      await supabase.from('questions').update({ status: 'claimed' }).eq('id', question.id);
      setClaim(data);
      toast.success('Claim restored — you can submit your response now.');
    } catch (error: any) {
      console.error('Error reclaiming question:', error);
      toast.error(`Failed to reclaim: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsReclaiming(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!question) return (
    <div className="text-center py-12">
      <p>Question not found</p>
      <Button className="mt-4" asChild><Link href="/creator/queue">Back to Queue</Link></Button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/creator/queue"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Response</h1>
          <p className="text-muted-foreground">Provide a clear, step-by-step explanation for the student</p>
        </div>
      </div>

      {!claim && (
        <Card className="border-warning/25 bg-warning/10">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                You don't currently hold an active claim on this question — it may have been released,
                or claimed by someone else. You can still draft here, but you'll need to reclaim it before submitting.
              </p>
            </div>
            <Button size="sm" onClick={handleReclaim} disabled={isReclaiming}>
              {isReclaiming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reclaim Question
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column: question + student info */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Question</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">{question.title || 'Untitled'}</p>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{question.content}</p>
              </div>

              {/* Attachments / Images */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Attached Images ({attachments.length})
                  </p>
                  <div className="grid gap-2">
                    {attachments.map((att) => (
                      att.signedUrl && att.mime_type?.startsWith('image/') ? (
                        <div key={att.id} className="relative rounded-lg overflow-hidden border bg-muted">
                          <img
                            src={att.signedUrl}
                            alt={att.file_name}
                            className="w-full object-contain max-h-64"
                          />
                          <p className="text-xs text-muted-foreground px-2 py-1 bg-background/80">{att.file_name}</p>
                        </div>
                      ) : att.signedUrl ? (
                        <a
                          key={att.id}
                          href={att.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ImageIcon className="h-3 w-3" />{att.file_name}
                        </a>
                      ) : null
                    ))}
                  </div>
                </div>
              )}

              {question.ocr_extracted_text && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium mb-1">Extracted Text</p>
                  <p className="text-sm">{question.ocr_extracted_text}</p>
                </div>
              )}
              {question.student_notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium mb-1">Student Notes</p>
                  <p className="text-sm">{question.student_notes}</p>
                </div>
              )}
              {aiResponse && (
                <>
                  <Separator />
                  <div>
                    <Badge variant="secondary" className="mb-2">AI Explanation</Badge>
                    <p className="text-sm whitespace-pre-wrap line-clamp-6">{aiResponse.explanation}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Student profile card */}
          {studentProfile && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Student Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {studentProfile.full_name && (
                  <p className="font-medium">{studentProfile.full_name}</p>
                )}
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  {studentProfile.grade_level && (
                    <span>Grade {studentProfile.grade_level}</span>
                  )}
                  {studentProfile.target_sat_score && (
                    <span>Target: {studentProfile.target_sat_score}</span>
                  )}
                </div>
                {studentProfile.preferred_subjects && studentProfile.preferred_subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {studentProfile.preferred_subjects.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs capitalize">{s}</Badge>
                    ))}
                  </div>
                )}
                {studentProfile.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{studentProfile.bio}</p>
                )}
                <Link
                  href={`/creator/students/${question.user_id}`}
                  className="text-xs text-primary hover:underline"
                >
                  View full profile
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: response form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Response</CardTitle>
            <CardDescription>Provide a clear, step-by-step explanation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-primary/40 hover:bg-primary/5"
              onClick={handleAssistResponse}
              disabled={isAssisting}
            >
              {isAssisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Get AI drafting help
            </Button>
            {assistResult && (
              <div className="p-4 rounded-lg border border-primary/25 bg-primary/5 space-y-3">
                <div>
                  <p className="text-xs font-medium text-primary mb-1">Suggested approach</p>
                  <p className="text-sm">{assistResult.approach}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-primary mb-1">Key points to hit</p>
                  <ul className="text-sm list-disc list-inside space-y-0.5">
                    {assistResult.key_points.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setExplanation(assistResult.suggested_response)}
                >
                  Use this draft as a starting point
                </Button>
                <p className="text-xs text-muted-foreground">
                  This is a starting point, not a final answer — review and edit before sending.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="explanation">Explanation *</Label>
              <Textarea id="explanation" placeholder="Explain the concept step by step..." value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={10} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teachingNotes">Teaching Notes (optional)</Label>
              <Textarea id="teachingNotes" placeholder="Additional context or tips..." value={teachingNotes} onChange={(e) => setTeachingNotes(e.target.value)} rows={3} />
            </div>

            {/* Video upload section */}
            <div className="space-y-3">
              <Label>Video Explanation (optional)</Label>

              {/* Video preview or upload area */}
              {videoPreview ? (
                <div className="relative rounded-lg overflow-hidden border bg-muted">
                  <video
                    src={videoPreview}
                    controls
                    className="w-full max-h-64 object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={clearVideo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : videoUploading ? (
                <div className="p-8 border-2 border-dashed rounded-lg text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading video...</p>
                  <Progress value={videoUploadProgress} className="h-2" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* File upload button */}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload video from device</span>
                    <span className="text-xs text-muted-foreground">MP4, WebM, MOV up to 500MB</span>
                  </Button>

                  {/* OR divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">OR</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* External URL input */}
                  <div className="space-y-1">
                    <Input
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => { setVideoUrl(e.target.value); clearVideo(); }}
                      disabled={!!videoFile}
                    />
                    <p className="text-xs text-muted-foreground">Paste a YouTube, Vimeo, or Loom link</p>
                  </div>
                </div>
              )}

              {/* Show selected file info */}
              {videoFile && !videoPreview && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Video className="h-4 w-4 text-primary" />
                  <span className="text-sm flex-1 truncate">{videoFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              )}
            </div>
            <Separator />
            <div className="flex gap-3">
              <Button onClick={() => handleSubmit(true)} variant="outline" disabled={isSubmitting || !explanation.trim()}>
                <Save className="mr-2 h-4 w-4" />Save Draft
              </Button>
              <Button onClick={() => handleSubmit(false)} disabled={isSubmitting || !explanation.trim()}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : <><Send className="mr-2 h-4 w-4" />Submit Response</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
