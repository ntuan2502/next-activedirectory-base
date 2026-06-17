"use client";

import React, { useState, useEffect, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { Building2, Save, ArrowLeft, RefreshCw, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { CompanyContext } from "./[id]/layout";

interface CompanyEditorProps {
  companyId?: string;
  mode: "view" | "edit" | "create";
}

export function CompanyEditor({ companyId, mode }: CompanyEditorProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  // For create mode, context is null (no provider wrapping)
  const companyContext = useContext(CompanyContext);
  const companyData = companyContext?.companyData ?? null;
  const setCompanyData = companyContext?.setCompanyData ?? null;

  const isCreateMode = mode === "create";

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isSaving, setIsSaving] = useState(false);

  // Form State initialized from context if available
  const [formCode, setFormCode] = useState(companyData?.code || "");
  const [formNameVi, setFormNameVi] = useState(companyData?.nameVi || "");
  const [formNameEn, setFormNameEn] = useState(companyData?.nameEn || "");
  const [formTaxCode, setFormTaxCode] = useState(companyData?.taxCode || "");
  const [formTaxAddress, setFormTaxAddress] = useState(companyData?.taxAddress || "");

  const [initialState, setInitialState] = useState<{
    code: string;
    nameVi: string;
    nameEn: string;
    taxCode: string;
    taxAddress: string;
  } | null>(companyData ? {
    code: companyData.code,
    nameVi: companyData.nameVi || "",
    nameEn: companyData.nameEn || "",
    taxCode: companyData.taxCode || "",
    taxAddress: companyData.taxAddress || "",
  } : null);

  useEffect(() => {
    if (companyData) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setFormCode(companyData.code);
      setFormNameVi(companyData.nameVi || "");
      setFormNameEn(companyData.nameEn || "");
      setFormTaxCode(companyData.taxCode || "");
      setFormTaxAddress(companyData.taxAddress || "");
      setInitialState({
        code: companyData.code,
        nameVi: companyData.nameVi || "",
        nameEn: companyData.nameEn || "",
        taxCode: companyData.taxCode || "",
        taxAddress: companyData.taxAddress || "",
      });
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [companyData]);

  const isReadOnly = mode === "view" || !hasPermission(PERMISSIONS.COMPANIES_UPDATE);

  const isChanged = isCreateMode ? true : (
    !initialState ? false : (
      formCode.trim() !== initialState.code ||
      formNameVi.trim() !== initialState.nameVi ||
      formNameEn.trim() !== initialState.nameEn ||
      formTaxCode.trim() !== initialState.taxCode ||
      formTaxAddress.trim() !== initialState.taxAddress
    )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      return toast.error(t("companiesPage.codePlaceholder"));
    }

    setIsSaving(true);
    try {
      const url = isCreateMode ? "/api/companies" : `/api/companies/${companyId}`;
      const method = isCreateMode ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim().toUpperCase(),
          nameVi: formNameVi.trim(),
          nameEn: formNameEn.trim(),
          taxCode: formTaxCode.trim(),
          taxAddress: formTaxAddress.trim(),
        }),
      });

      if (res.ok) {
        toast.success(isCreateMode ? t("companiesPage.successCreate") : t("companiesPage.successUpdate"));
        if (!isCreateMode) {
          setInitialState({
            code: formCode.trim().toUpperCase(),
            nameVi: formNameVi.trim(),
            nameEn: formNameEn.trim(),
            taxCode: formTaxCode.trim(),
            taxAddress: formTaxAddress.trim(),
          });
          setCompanyData?.((prev) => prev ? {
            ...prev,
            code: formCode.trim().toUpperCase(),
            nameVi: formNameVi.trim(),
            nameEn: formNameEn.trim(),
            taxCode: formTaxCode.trim(),
            taxAddress: formTaxAddress.trim(),
          } : null);
        }
        router.push("/companies");
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.failedToSave"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  // Permission check: create needs COMPANIES_CREATE, view/edit needs COMPANIES_READ
  if (isCreateMode && !hasPermission(PERMISSIONS.COMPANIES_CREATE)) {
    return <AccessDenied />;
  }
  if (!isCreateMode && !hasPermission(PERMISSIONS.COMPANIES_READ)) {
    return <AccessDenied />;
  }

  // Header titles
  const headerTitle = isCreateMode
    ? t("companiesPage.addCompany")
    : isReadOnly
      ? t("companiesPage.viewCompany")
      : t("companiesPage.editCompany");

  const headerDescription = isCreateMode
    ? t("companiesPage.addCompanyDesc")
    : isReadOnly
      ? t("companiesPage.viewCompanyDesc")
      : t("companiesPage.editCompanyDesc");

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/companies")}
            disabled={isSaving}
            className="h-10 w-10 cursor-pointer border-muted/70"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary" />
              {headerTitle}
            </h1>
            <p className="text-muted-foreground mt-1">
              {headerDescription}
              {!isCreateMode && companyData?.code && (
                <>: <strong className="text-foreground">{companyData.code}</strong></>
              )}
            </p>
          </div>
        </div>

        {mode === "view" && hasPermission(PERMISSIONS.COMPANIES_UPDATE) && (
          <Button
            onClick={() => router.push(`/companies/${companyId}/edit`)}
            className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0 flex items-center gap-2 self-start sm:self-center"
          >
            <Edit className="h-4 w-4" />
            {t("common.edit")}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card className="shadow-lg">
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="font-semibold">
                  {t("companiesPage.form.code")} {!isCreateMode && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="code"
                  placeholder={t("companiesPage.codePlaceholder")}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  disabled={!isCreateMode} // Disabled in edit and view modes
                  className="disabled:bg-muted/30 uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxCode" className="font-semibold">
                  {t("companiesPage.form.taxCode")}
                </Label>
                <Input
                  id="taxCode"
                  placeholder={t("companiesPage.taxCodePlaceholder")}
                  value={formTaxCode}
                  onChange={(e) => setFormTaxCode(e.target.value)}
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nameVi" className="font-semibold">
                  {t("companiesPage.form.nameVi")}
                </Label>
                <Input
                  id="nameVi"
                  placeholder={t("companiesPage.nameViPlaceholder")}
                  value={formNameVi}
                  onChange={(e) => setFormNameVi(e.target.value)}
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nameEn" className="font-semibold">
                  {t("companiesPage.form.nameEn")}
                </Label>
                <Input
                  id="nameEn"
                  placeholder={t("companiesPage.nameEnPlaceholder")}
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="taxAddress" className="font-semibold">
                  {t("companiesPage.form.taxAddress")}
                </Label>
                <Input
                  id="taxAddress"
                  placeholder={t("companiesPage.taxAddressPlaceholder")}
                  value={formTaxAddress}
                  onChange={(e) => setFormTaxAddress(e.target.value)}
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/companies")}
            disabled={isSaving}
            className="h-10 px-5 font-semibold text-sm cursor-pointer"
          >
            {isReadOnly ? t("common.close") : t("common.cancel")}
          </Button>
          {!isReadOnly && (
            <Button
              type="submit"
              disabled={isSaving || !formCode.trim() || !isChanged}
              className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0 flex items-center gap-2"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("common.save")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
