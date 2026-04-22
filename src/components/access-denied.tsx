import { ShieldAlert } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <ShieldAlert className="w-16 h-16 text-destructive" />
      <h2 className="text-2xl font-bold">Access Denied</h2>
      <p className="text-muted-foreground">You do not have permission to access this page.</p>
    </div>
  );
}
