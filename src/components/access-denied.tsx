import { ShieldAlert } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

export function AccessDenied() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <ShieldAlert className="w-16 h-16 text-destructive" />
      <h2 className="text-2xl font-bold">{t("common.accessDenied")}</h2>
      <p className="text-muted-foreground">{t("common.accessDeniedDesc")}</p>
    </div>
  );
}
