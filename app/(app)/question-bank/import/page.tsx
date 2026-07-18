'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileText,
  Image,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Plus,
  Wand2,
  Edit3,
  Clock,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAIProvider } from '@/lib/ai';
import { toast } from 'sonner';

type ImportBatch = Database['public']['Tables']['import_batches']['Row'];
type Domain = Database['public']['Tables']['domains']['Row'];
type Skill = Database['public']['Tables']['skills']['Row'];

const ACCEPTED_FILE_TYPES = [
  { ext: '.pdf', label: 'PDF', icon: FileText },
  { ext: '.docx', label: 'Word', icon: FileText },
  { ext: '.png', label: 'PNG', icon: Image },
  { ext: '.jpg', label: 'JPG', icon: Image },
  { ext: '.jpeg', label: 'JPEG', icon: Image },
];

interface UploadedFile {
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

export default function QuestionImportPage() {
  const { profile, user } = useAuth();
  const isCreator = profile?.role === 'creator' || profile?.role === 'admin';

  const [mode, setMode] = useState<'upload' | 'manual'>('manual');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [batchName, setBatchName] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [form, setForm] = useState({
    question_text: '',
    format: 'multiple_choice' as 'multiple_choice' | 'numeric_entry',
    choice_a: '', choice_b: '', choice_c: '', choice_d: '',
    correct_answer: '',
    explanation: '',
    hint: '',
    section: '' as 'math' | 'reading' | 'writing' | '',
    domain_id: '',
    skill_id: '',
    difficulty: '' as 'easy' | 'medium' | 'hard' | '',
    tags: '',
    estimated_time: '',
    calculator_allowed: true,
  });

  const loadData = async () => {
    const [domainsRes, skillsRes, batchesRes] = await Promise.all([
      supabase.from('domains').select('*').order('display_order'),
      supabase.from('skills').select('*').order('display_order'),
      user ? supabase.from('import_batches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    ]);
    if (domainsRes.data) setDomains(domainsRes.data);
    if (skillsRes.data) setSkills(skillsRes.data);
    if (batchesRes.data) setBatches(batchesRes.data as ImportBatch[]);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filteredSkills = skills.filter(s => s.domain_id === form.domain_id);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    const valid = dropped.filter(f => ACCEPTED_FILE_TYPES.some(t => f.name.toLowerCase().endsWith(t.ext)));
    setFiles(prev => [...prev, ...valid.map(file => ({
      file,
      status: 'pending' as const,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const valid = selected.filter(f => ACCEPTED_FILE_TYPES.some(t => f.name.toLowerCase().endsWith(t.ext)));
      setFiles(prev => [...prev, ...valid.map(file => ({
        file,
        status: 'pending' as const,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }))]);
    }
  };

  const submitManual = async () => {
    if (!form.question_text || !form.correct_answer || !user) return;

    const choices = form.format === 'multiple_choice'
      ? { a: form.choice_a, b: form.choice_b, c: form.choice_c, d: form.choice_d }
      : null;

    const { error } = await supabase.from('question_imports').insert({
      user_id: user.id,
      status: 'reviewing',
      question_text: form.question_text,
      question_format: form.format,
      choices,
      correct_answer: form.correct_answer,
      explanation: form.explanation || null,
      hint: form.hint || null,
      section: form.section || null,
      domain_id: form.domain_id || null,
      skill_id: form.skill_id || null,
      difficulty: form.difficulty || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      estimated_time_seconds: form.estimated_time ? parseInt(form.estimated_time) * 60 : null,
      calculator_allowed: form.calculator_allowed,
      source: 'imported',
    });

    if (!error) {
      toast.success('Question submitted for review');
      setForm({
        question_text: '', format: 'multiple_choice',
        choice_a: '', choice_b: '', choice_c: '', choice_d: '',
        correct_answer: '', explanation: '', hint: '',
        section: '', domain_id: '', skill_id: '', difficulty: '',
        tags: '', estimated_time: '', calculator_allowed: true,
      });
    } else {
      toast.error(error.message);
    }
  };

  const handleStartImport = async () => {
    if (!user || files.length === 0 || uploading) return;
    setUploading(true);
    setImportProgress({ done: 0, total: files.length });

    const { data: batch, error: batchError } = await supabase
      .from('import_batches')
      .insert({
        user_id: user.id,
        batch_name: batchName.trim() || `Import ${new Date().toLocaleDateString()}`,
        status: 'processing',
        total_files: files.length,
        ai_extraction_enabled: aiEnabled,
      })
      .select()
      .single();

    if (batchError || !batch) {
      toast.error(`Failed to start import: ${batchError?.message || 'Unknown error'}`);
      setUploading(false);
      setImportProgress(null);
      return;
    }

    let totalExtracted = 0;
    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const uploadedFile = files[i];
      setFiles(prev => prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f)));

      try {
        const ext = uploadedFile.file.name.split('.').pop();
        const storagePath = `${user.id}/${batch.id}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('question-imports')
          .upload(storagePath, uploadedFile.file);
        if (uploadError) throw uploadError;

        const { data: fileRow, error: fileRowError } = await supabase
          .from('import_files')
          .insert({
            batch_id: batch.id,
            file_name: uploadedFile.file.name,
            file_type: uploadedFile.file.type || ext || 'unknown',
            file_size: uploadedFile.file.size,
            storage_path: storagePath,
            status: 'processing',
          })
          .select()
          .single();
        if (fileRowError || !fileRow) throw fileRowError || new Error('Failed to create file record');

        const isPdf = uploadedFile.file.type === 'application/pdf';
        const isImage = uploadedFile.file.type.startsWith('image/');

        if (aiEnabled && (isPdf || isImage)) {
          const { data: signed } = await supabase.storage
            .from('question-imports')
            .createSignedUrl(storagePath, 3600);
          if (!signed?.signedUrl) throw new Error('Could not generate a signed URL for extraction');

          const aiResult = await getAIProvider().extractQuestions(signed.signedUrl, isPdf ? 'pdf' : 'image');
          const extracted = aiResult.data?.extractedQuestions;

          if (!aiResult.success || !extracted?.length) {
            await supabase.from('import_files').update({
              status: 'failed',
              error_message: aiResult.error || 'No questions could be extracted from this file',
              processed_at: new Date().toISOString(),
            }).eq('id', fileRow.id);
            setFiles(prev => prev.map((f, idx) => (idx === i ? { ...f, status: 'error', error: aiResult.error || 'No questions extracted' } : f)));
          } else {
            const rows = extracted.map((q) => ({
              batch_id: batch.id,
              file_id: fileRow.id,
              user_id: user.id,
              status: 'reviewing' as const,
              question_text: q.question_text,
              question_format: q.question_format,
              choices: q.choices ?? null,
              correct_answer: q.correct_answer ?? null,
              explanation: q.explanation ?? null,
              hint: q.hint ?? null,
              section: q.section ?? null,
              difficulty: q.difficulty ?? null,
              section_confidence: q.section_confidence ?? null,
              difficulty_confidence: q.difficulty_confidence ?? null,
              source: 'imported' as const,
            }));

            const { error: insertError } = await supabase.from('question_imports').insert(rows);
            if (insertError) throw insertError;

            totalExtracted += rows.length;
            await supabase.from('import_files').update({
              status: 'completed',
              processed_at: new Date().toISOString(),
            }).eq('id', fileRow.id);
            setFiles(prev => prev.map((f, idx) => (idx === i ? { ...f, status: 'uploaded' } : f)));
          }
        } else {
          // Either AI extraction is off, or this is a file type Claude can't
          // read directly yet (e.g. .docx) — stored for a human to enter
          // manually via the Manual tab later.
          await supabase.from('import_files').update({ status: 'manual_review' }).eq('id', fileRow.id);
          setFiles(prev => prev.map((f, idx) => (idx === i ? { ...f, status: 'uploaded' } : f)));
        }

        processedCount++;
      } catch (err: any) {
        console.error('Import file failed:', err);
        setFiles(prev => prev.map((f, idx) => (idx === i ? { ...f, status: 'error', error: err?.message || 'Unknown error' } : f)));
      }

      setImportProgress({ done: i + 1, total: files.length });
    }

    await supabase.from('import_batches').update({
      status: 'manual_review',
      processed_files: processedCount,
      total_questions: totalExtracted,
      completed_at: new Date().toISOString(),
    }).eq('id', batch.id);

    setUploading(false);
    setImportProgress(null);

    if (totalExtracted > 0) {
      toast.success(
        `Import finished: ${totalExtracted} question${totalExtracted === 1 ? '' : 's'} extracted from ${processedCount}/${files.length} file(s). Check the review queue.`
      );
    } else if (processedCount > 0) {
      toast.success(`${processedCount} file(s) uploaded for manual entry.`);
    } else {
      toast.error('Import did not complete for any file — see the errors above.');
    }

    loadData();
  };

  if (!isCreator) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Creator access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/study"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Questions</h1>
          <p className="text-muted-foreground">Add questions to the bank</p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'upload' | 'manual')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="manual" className="gap-2"><Edit3 className="h-4 w-4" />Manual</TabsTrigger>
          <TabsTrigger value="upload" className="gap-2"><Upload className="h-4 w-4" />Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>Add questions for admin review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Question *</Label>
                <Textarea placeholder="Enter question..." value={form.question_text}
                  onChange={(e) => setForm({...form, question_text: e.target.value})} className="min-h-20" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={form.format} onValueChange={(v) => setForm({...form, format: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="numeric_entry">Numeric Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Correct Answer *</Label>
                  <Input placeholder={form.format === 'multiple_choice' ? 'A, B, C, or D' : '42'}
                    value={form.correct_answer} onChange={(e) => setForm({...form, correct_answer: e.target.value})} />
                </div>
              </div>

              {form.format === 'multiple_choice' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>A</Label><Input value={form.choice_a} onChange={(e) => setForm({...form, choice_a: e.target.value})} /></div>
                  <div className="space-y-2"><Label>B</Label><Input value={form.choice_b} onChange={(e) => setForm({...form, choice_b: e.target.value})} /></div>
                  <div className="space-y-2"><Label>C</Label><Input value={form.choice_c} onChange={(e) => setForm({...form, choice_c: e.target.value})} /></div>
                  <div className="space-y-2"><Label>D</Label><Input value={form.choice_d} onChange={(e) => setForm({...form, choice_d: e.target.value})} /></div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Explanation</Label><Textarea value={form.explanation} onChange={(e) => setForm({...form, explanation: e.target.value})} /></div>
                <div className="space-y-2"><Label>Hint</Label><Input value={form.hint} onChange={(e) => setForm({...form, hint: e.target.value})} /></div>
              </div>

              <Separator />

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select value={form.section} onValueChange={(v) => setForm({...form, section: v as any, domain_id: '', skill_id: ''})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Math</SelectItem>
                      <SelectItem value="reading">Reading</SelectItem>
                      <SelectItem value="writing">Writing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select value={form.domain_id} onValueChange={(v) => setForm({...form, domain_id: v, skill_id: ''})} disabled={!form.section}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {domains.filter(d => d.subject_id?.includes(form.section)).map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select value={form.difficulty} onValueChange={(v) => setForm({...form, difficulty: v as any})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="calc" checked={form.calculator_allowed} onCheckedChange={(v) => setForm({...form, calculator_allowed: v as boolean})} />
                <Label htmlFor="calc">Calculator Allowed</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setForm({
                  question_text: '', format: 'multiple_choice',
                  choice_a: '', choice_b: '', choice_c: '', choice_d: '',
                  correct_answer: '', explanation: '', hint: '',
                  section: '', domain_id: '', skill_id: '', difficulty: '',
                  tags: '', estimated_time: '', calculator_allowed: true
                })}>Clear</Button>
                <Button onClick={submitManual} disabled={!form.question_text || !form.correct_answer}>
                  <Plus className="h-4 w-4 mr-2" />Add for Review
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Files</CardTitle>
              <CardDescription>Drag and drop PDF or image files — Word docs are accepted too but go straight to manual review, since AI extraction can only read images and PDFs directly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batch Name (optional)</Label>
                  <Input placeholder={`Import ${new Date().toLocaleDateString()}`} value={batchName}
                    onChange={(e) => setBatchName(e.target.value)} disabled={uploading} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="ai-toggle">AI extraction</Label>
                    <p className="text-xs text-muted-foreground">Automatically pull out questions from each file</p>
                  </div>
                  <Switch id="ai-toggle" checked={aiEnabled} onCheckedChange={setAiEnabled} disabled={uploading} />
                </div>
              </div>

              <div className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50"
                onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
                <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="mb-2 text-lg font-medium">Drop files here</p>
                <p className="text-sm text-muted-foreground mb-4">PDF, Word, PNG, JPG</p>
                <Input type="file" className="hidden" id="file-input" multiple
                  accept={ACCEPTED_FILE_TYPES.map(t => t.ext).join(',')} onChange={handleFileSelect} disabled={uploading} />
                <Button variant="outline" asChild disabled={uploading}><label htmlFor="file-input">Browse</label></Button>
              </div>
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded border">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{f.file.name}</span>
                      {f.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {f.status === 'uploaded' && <Badge className="bg-success/10 text-success border-success/25"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>}
                      {f.status === 'error' && <Badge variant="destructive" title={f.error}><XCircle className="h-3 w-3 mr-1" />Failed</Badge>}
                      <Button variant="ghost" size="icon" disabled={uploading} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {files.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    {importProgress ? `Processing ${importProgress.done}/${importProgress.total}...` : `${files.length} file(s) ready`}
                  </p>
                  <Button onClick={handleStartImport} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    Start Import
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {batches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Batches</CardTitle>
                <CardDescription>Your last {batches.length} import{batches.length === 1 ? '' : 'es'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded border text-sm">
                    <div>
                      <p className="font-medium">{b.batch_name || 'Untitled batch'}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.processed_files}/{b.total_files} files · {b.total_questions} question(s) extracted
                        {b.completed_at ? ` · ${new Date(b.completed_at).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={b.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">
                        {b.status.replace('_', ' ')}
                      </Badge>
                      {b.total_questions > 0 && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/question-bank/import-queue">Review</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
