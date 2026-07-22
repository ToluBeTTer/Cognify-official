const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Bookmark, Loader2, Trash2 } from "lucide-react";

const typeColor = {
  "AI explanation": "bg-primary/10 text-primary",
  "Human explanation": "bg-emerald-100 text-emerald-700",
  Note: "bg-amber-100 text-amber-700",
  Bookmark: "bg-blue-100 text-blue-700",
};

export default function Saved() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => db.entities.SavedItem.list("-created_date", 100).then(setItems).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    await db.entities.SavedItem.delete(id);
    toast({ title: "Removed" });
    load();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title="Saved" subtitle="Your personal library of explanations, notes, and bookmarks." />

      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nothing saved yet. Bookmark explanations from Milo or the Question Bank.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-xs rounded-full px-2.5 py-0.5 ${typeColor[item.type] || "bg-slate-100 text-slate-600"}`}>{item.type}</span>
                <button onClick={() => remove(item.id)} className="text-slate-300 hover:text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-medium text-slate-900 text-sm">{item.title}</h3>
              {item.content && <p className="text-sm text-slate-500 mt-2 line-clamp-4 whitespace-pre-wrap">{item.content}</p>}
              {item.subject && <p className="text-xs text-slate-400 mt-auto pt-3">{item.subject}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}