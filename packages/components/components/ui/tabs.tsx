import * as React from "react";
export function Tabs(props: React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string; value?: string; onValueChange?: (v: string) => void; }) { return <div {...props} />; }
export function TabsList(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
export function TabsTrigger(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { value?: string }) { return <button {...props} />; }
export function TabsContent(props: React.HTMLAttributes<HTMLDivElement> & { value?: string }) { return <div {...props} />; }
