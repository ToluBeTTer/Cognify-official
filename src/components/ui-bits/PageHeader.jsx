import React from "react";

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}