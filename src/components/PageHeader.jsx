import React from "react";

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-primary tracking-tight" style={{ fontWeight: 600 }}>
          {title}
        </h1>
        {subtitle && <p className="text-slate-500 mt-1.5 text-sm sm:text-base">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}