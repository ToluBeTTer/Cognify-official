'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { getAIProvider } from '@/lib/ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  X,
  Image as ImageIcon,
  FileText,
  Loader2,
  Sparkles,
  Users,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

export default function NewQuestionPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [studentNotes, setStudentNotes] = useState('');
  const [requestHuman, setRequestHuman] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdQuestionId, setCreatedQuestionId] = useState<string | null>(null);

  // Loaded from the DB rather than hardcoded — a previous version pinned two
  // specific subject UUIDs directly in source, which would silently break on
  // any environment where those exact rows don't exist (a fresh Supabase
  // project, a reseeded database, etc).
  const [subjectSlugToId, setSubjectSlugToId] = useState<Record<string, string>>({});
  const [domainNameToId, setDomainNameToId] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadLookups = async () => {
      const [subjectsRes, domainsRes] = await Promise.all([
        supabase.from('subjects').select('id, slug'),
        supabase.from('domains').select('id, name'),
      ]);
      if (subjectsRes.data) {
        setSubjectSlugToId(Object.fromEntries(subjectsRes.data.map((s) => [s.slug, s.id])));
      }
      if (domainsRes.data) {
        setDomainNameToId(Object.fromEntries(domainsRes.data.map((d) => [d.name.toLowerCase(), d.id])));
      }
    };
    loadLookups();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large: ${file.name} (max 10MB)`);
        return false;
      }
      return true;
    });

    if (files.length + validFiles.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);

    // Create previews for images
    validFiles.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews((prev) => [...prev, 'pdf']);
      }
    });
  }, [files.length]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && files.length === 0) {
      toast.error('Please enter your question or upload an image');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to submit a question');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload files to Supabase Storage (best-effort — don't block submission).
      // We keep a signed URL alongside each uploaded path so we can hand Milo
      // a real, fetchable URL rather than a local blob preview (previews are
      // base64 data: URIs that only exist in this browser tab and can't be
      // fetched from the server — that mismatch was the root cause of the
      // old "OCR never actually reads the image" behavior).
      const uploadedPaths: string[] = [];
      const uploadedSignedUrls: { path: string; url: string; isImage: boolean }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${i}.${fileExt}`;
        try {
          const { error: uploadError } = await supabase.storage
            .from('question-attachments')
            .upload(fileName, file);
          if (!uploadError) {
            uploadedPaths.push(fileName);
            const { data: signed } = await supabase.storage
              .from('question-attachments')
              .createSignedUrl(fileName, 3600);
            if (signed?.signedUrl) {
              uploadedSignedUrls.push({
                path: fileName,
                url: signed.signedUrl,
                isImage: file.type.startsWith('image/'),
              });
            }
          } else {
            console.warn('File upload warning:', uploadError.message);
          }
        } catch (uploadErr) {
          console.warn('File upload skipped:', uploadErr);
        }
        setUploadProgress(((i + 1) / files.length) * 40);
      }

      setIsUploading(false);
      setIsProcessing(true);
      setUploadProgress(40);

      // Map subject slug to UUID for the FK column
      const subjectId = subject ? (subjectSlugToId[subject] ?? null) : null;

      // Create question record
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .insert({
          user_id: user.id,
          title: title.trim() || null,
          content: content.trim(),
          question_type: files.length > 0 ? (content.trim() ? 'mixed' : 'image') : 'text',
          subject_id: subjectId,
          // domain_id is intentionally left null here and backfilled from the
          // AI's own classification below — there's no manual domain picker
          // in this form, so this always used to insert null anyway.
          domain_id: null,
          student_notes: studentNotes.trim() || null,
          difficulty_perceived: difficulty || null,
          human_requested: requestHuman,
          status: requestHuman ? 'human_requested' : 'pending',
        })
        .select()
        .single();

      if (questionError) throw questionError;

      setUploadProgress(55);

      // Create attachment records for successfully uploaded files
      for (let i = 0; i < uploadedPaths.length; i++) {
        const path = uploadedPaths[i];
        const file = files[i];
        if (!file) continue;
        await supabase.from('attachments').insert({
          question_id: question.id,
          file_name: file.name,
          file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
          file_size: file.size,
          mime_type: file.type,
          storage_path: path,
        });
      }

      setUploadProgress(65);

      // Process with AI. Milo can read images/PDFs directly (vision-capable),
      // so we send the real signed attachment URLs straight into one
      // explanation call instead of a separate OCR round trip — fewer calls,
      // faster feedback, and no risk of the OCR step silently doing nothing.
      const aiProvider = getAIProvider();

      setUploadProgress(80);

      try {
        const aiResult = await aiProvider.generateResponse({
          type: 'explanation',
          content: content.trim(),
          attachments: uploadedSignedUrls.slice(0, 3).map((f) => ({
            type: f.isImage ? 'image' : 'pdf',
            url: f.url,
          })),
          context: { subject },
        });

        if (aiResult.success && aiResult.data?.ocrText) {
          await supabase
            .from('questions')
            .update({
              ocr_extracted_text: aiResult.data.ocrText,
              ocr_confidence: aiResult.data.ocrConfidence ?? null,
            })
            .eq('id', question.id);
        }

        if (aiResult.success && aiResult.data) {
          const detectedDomainName = aiResult.data.classification?.domain?.toLowerCase();
          const detectedDomainId = detectedDomainName ? (domainNameToId[detectedDomainName] ?? null) : null;

          if (detectedDomainId) {
            await supabase.from('questions').update({ domain_id: detectedDomainId }).eq('id', question.id);
          }

          await supabase.from('ai_responses').insert({
            question_id: question.id,
            explanation: aiResult.data.explanation || '',
            hints: aiResult.data.hints || [],
            detected_subject_id: subjectId,
            detected_domain_id: detectedDomainId,
            confidence_score: aiResult.data.classification?.confidence ?? null,
            follow_up_questions: aiResult.data.followUpQuestions || [],
            related_concepts: aiResult.data.relatedConcepts || [],
            status: 'ready',
            provider: aiResult.metadata?.provider || 'mock',
            processing_time_ms: aiResult.metadata?.processingTimeMs,
          });

          // Only update status if not already set to human_requested
          if (!requestHuman) {
            await supabase
              .from('questions')
              .update({ status: 'ai_ready' })
              .eq('id', question.id);
          }
        }
      } catch (aiErr) {
        console.warn('AI processing skipped:', aiErr);
      }

      setUploadProgress(100);
      setCreatedQuestionId(question.id);
      setShowSuccessDialog(true);
    } catch (error: any) {
      console.error('Error submitting question:', error);
      toast.error(`Failed to submit question: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const handleViewQuestion = () => {
    if (createdQuestionId) {
      router.push(`/questions/${createdQuestionId}`);
    }
    setShowSuccessDialog(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ask a Question</h1>
        <p className="text-muted-foreground mt-2">
          Upload an SAT question or type it below to get help
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Question</CardTitle>
              <CardDescription>
                Take a screenshot or photo of any SAT question
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-xl p-10 text-center hover:border-primary/50 hover:bg-primary/[0.02] transition-all cursor-pointer group"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PNG, JPG, WebP, or PDF (max 10MB each, up to {MAX_FILES} files)
                </p>
              </div>

              {files.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {files.map((file, index) => (
                    <div key={index} className="relative group">
                      {previews[index] === 'pdf' ? (
                        <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      ) : previews[index] ? (
                        <img
                          src={previews[index]}
                          alt={`Preview ${index + 1}`}
                          className="aspect-square rounded-lg border object-cover"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Question Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question Details</CardTitle>
              <CardDescription>
                Type your question or add more context
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="Give your question a short title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Question or Description</Label>
                <Textarea
                  id="content"
                  placeholder="Type your question here, or describe what you need help with..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject (optional)</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Math</SelectItem>
                      <SelectItem value="reading-writing">Reading & Writing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Difficulty (optional)</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any specific areas you're struggling with or context that might help..."
                  value={studentNotes}
                  onChange={(e) => setStudentNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Response Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Response Options</CardTitle>
              <CardDescription>
                Choose how you want to receive help
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                onClick={() => setRequestHuman(false)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  !requestHuman
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">AI Explanation</p>
                      <Badge variant="secondary" className="text-xs">
                        Instant
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Get an instant AI-generated explanation with step-by-step solution
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRequestHuman(true)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  requestHuman
                    ? 'border-milo bg-milo/5 shadow-sm'
                    : 'border-border hover:border-milo/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-milo/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-milo" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">AI + Human Expert</p>
                      <Badge variant="outline" className="text-xs border-milo/30 text-milo">
                        In-depth
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Get instant AI help plus a personalized explanation from our expert
                      tutors
                    </p>
                  </div>
                </div>
              </button>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              {(isUploading || isProcessing) && (
                <div className="w-full space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    {isUploading
                      ? 'Uploading files...'
                      : 'Milo is reading your question...'}
                  </p>
                </div>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={isUploading || isProcessing || (!content.trim() && files.length === 0)}
              >
                {isUploading || isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get Help
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to our terms of service
              </p>
            </CardFooter>
          </Card>
        </div>
      </form>

      {/* Success Dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Question Submitted!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your question has been submitted successfully. An AI explanation is ready
              {requestHuman && ', and a human tutor has been notified to provide additional help'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleViewQuestion}>
              View Explanation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
