const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import ReactMarkdown from "react-markdown";
import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, Trash2 } from "lucide-react";

export default function SavedItems() {
  const [items, setItems] = useState([]);
  const load = () => db.entities.SavedItem.list("-created_date", 100).then(setItems);
  useEffect(() => { load(); }, []);

  const remove = async (id) => { await db.entities.SavedItem.delete(id); load(); };

  return (
    <div>
      <PageHeader title="Saved Items" subtitle="Your bookmarked explanations and notes." />
      {items.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>Nothing saved yet.</p>
        </Card>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((it) => (
          <Card key={it.id} className="p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex flex-wrap gap-2">
                {it.subject && <Badge variant="secondary">{it.subject}</Badge>}
                <Badge variant="outline" className="capitalize">{it.item_type?.replace("_", " ")}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => remove(it.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <h3 className="font-medium mb-2">{it.title}</h3>
            {it.content && <div className="prose prose-sm max-w-none line-clamp-6"><ReactMarkdown>{it.content}</ReactMarkdown></div>}
          </Card>
        ))}
      </div>
    </div>
  );
}