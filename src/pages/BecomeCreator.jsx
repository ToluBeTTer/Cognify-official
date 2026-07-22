const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";

export default function BecomeCreator() {
  const { toast } = useToast();
  const [me, setMe] = useState(null);
  const [existing, setExisting] = useState(null);
  const [subjects, setSubjects] = useState("");
  const [experience, setExperience] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { db.auth.me().then(setMe); }, []);
  useEffect(() => {
    if (me) db.entities.CreatorApplication.filter({ user_id: me.id }, "-created_date", 1).then(setExisting);
  }, [me]);

  const submit = async () => {
    if (!subjects.trim()) return;
    setBusy(true);
    await db.entities.CreatorApplication.create({
      user_id: me.id, full_name: me.full_name, email: me.email, subjects, experience,
    });
    setBusy(false);
    toast({ title: "Application submitted!" });
    setExisting(await db.entities.CreatorApplication.filter({ user_id: me.id }, "-created_date", 1));
  };

  const status = existing?.status;

  return (
    <div className="max-w-xl">
      <PageHeader title="Become a Tutor" subtitle="Apply to join Cognify as a verified content creator." />
      {status === "pending" && (
        <Card className="p-6 mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2 text-amber-800">
            <Clock className="w-5 h-5" />
            <p className="font-medium">Your application is under review.</p>
          </div>
          <p className="text-sm text-amber-700 mt-2 ml-7">Our admin team will review your submission shortly.</p>
        </Card>
      )}
      {status === "approved" && (
        <Card className="p-6 mb-6 bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-2" />
          <p className="font-medium text-emerald-800">You're approved! Your account has been upgraded to Creator.</p>
        </Card>
      )}
      {status === "rejected" && (
        <Card className="p-6 mb-6 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-800">
            <XCircle className="w-5 h-5" />
            <p className="font-medium">Your application was not approved at this time.</p>
          </div>
          <p className="text-sm text-red-700 mt-2 ml-7">You can reapply below.</p>
        </Card>
      )}
      {(!status || status === "rejected") && (
        <Card className="p-6 space-y-4">
          <div>
            <Label>Subject expertise</Label>
            <Input placeholder="e.g. Algebra, Geometry, Reading" value={subjects} onChange={(e) => setSubjects(e.target.value)} />
          </div>
          <div>
            <Label>Experience / qualifications</Label>
            <Textarea rows={4} placeholder="Tell us about your tutoring experience, credentials, or teaching background..."
              value={experience} onChange={(e) => setExperience(e.target.value)} />
          </div>
          <Button disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit application"}
          </Button>
        </Card>
      )}
    </div>
  );
}