"use client";

import { useState, useEffect, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { Network, Save, ArrowLeft, RefreshCw, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { DepartmentContext } from "./[id]/layout";
import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { SingleSelectCombobox } from "@/components/single-select-combobox";

interface Company {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  companyIds?: string[];
  departmentIds?: string[];
}



interface Department {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  companyId: string | null;
  parentId: string | null;
}

interface DepartmentEditorProps {
  departmentId?: string;
  mode: "view" | "edit" | "create";
}

export function DepartmentEditor({ departmentId, mode }: DepartmentEditorProps) {
  const { user: currentUser } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  // For create mode, context is null
  const deptContext = useContext(DepartmentContext);
  const departmentData = deptContext?.departmentData ?? null;
  const setDepartmentData = deptContext?.setDepartmentData ?? null;

  const isCreateMode = mode === "create";

  const hasPermission = useCallback((perm: string) => {
    if (!currentUser?.permissions) return false;
    if (currentUser.permissions.includes("*")) return true;
    return currentUser.permissions.includes(perm);
  }, [currentUser]);

  const [isSaving, setIsSaving] = useState(false);
  const [companies, setCompanies] = useState<Company[]>(() => {
    return deptContext?.availableCompanies || [];
  });
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    return deptContext?.availableUsers || [];
  });
  const [allDepartments, setAllDepartments] = useState<Department[]>(() => {
    return deptContext?.availableDepartments || [];
  });
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(isCreateMode ? true : !deptContext);

  // Form State
  const [formCode, setFormCode] = useState(departmentData?.code || "");
  const [formNameVi, setFormNameVi] = useState(departmentData?.nameVi || "");
  const [formNameEn, setFormNameEn] = useState(departmentData?.nameEn || "");
  const [formCompanyId, setFormCompanyId] = useState(departmentData?.companyId || "");
  const [formParentId, setFormParentId] = useState(departmentData?.parentId || "");
  const [formManagerId, setFormManagerId] = useState(departmentData?.managerId || "");
  
  const [formSubDepartmentIds, setFormSubDepartmentIds] = useState<string[]>(() => {
    if (departmentData && deptContext?.availableDepartments) {
      return deptContext.availableDepartments
        .filter((d) => d.parentId === departmentData.id)
        .map((d) => d.id);
    }
    return [];
  });
  const [formUserIds, setFormUserIds] = useState<string[]>(() => {
    return departmentData?.users?.map((u) => u.id) || [];
  });

  const [initialState, setInitialState] = useState<{
    code: string;
    nameVi: string;
    nameEn: string;
    companyId: string | null;
    parentId: string;
    managerId: string;
    subDepartmentIds: string[];
    userIds: string[];
  } | null>(() => {
    if (departmentData && deptContext?.availableDepartments) {
      const childIds = deptContext.availableDepartments
        .filter((d) => d.parentId === departmentData.id)
        .map((d) => d.id);
      const mappedUserIds = departmentData.users?.map((u) => u.id) || [];
      return {
        code: departmentData.code,
        nameVi: departmentData.nameVi,
        nameEn: departmentData.nameEn,
        companyId: departmentData.companyId || "",
        parentId: departmentData.parentId || "",
        managerId: departmentData.managerId || "",
        subDepartmentIds: childIds,
        userIds: mappedUserIds,
      };
    }
    return null;
  });

  // Load companies & users
  useEffect(() => {
    if (deptContext) return;

    async function loadData() {
      try {
        const [companiesRes, usersRes] = await Promise.all([
          fetch("/api/companies?limit=100"),
          fetch("/api/users?limit=1000")
        ]);

        if (companiesRes.ok && usersRes.ok) {
          const companiesData = await companiesRes.json();
          const usersData = await usersRes.json();

          if (companiesData.success) {
            setCompanies(companiesData.data || []);
          }
          if (usersData.success) {
            setAllUsers(usersData.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch dropdowns data", err);
      } finally {
        setIsLoadingDropdowns(false);
      }
    }
    loadData();
  }, [deptContext]);

  // Fetch all departments in the system for parent selection
  useEffect(() => {
    if (deptContext) return;

    async function fetchAllDepartments() {
      try {
        const res = await fetch("/api/departments?limit=1000");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setAllDepartments(data.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch departments", err);
      }
    }

    fetchAllDepartments();
  }, [deptContext]);

  // Reset parent and manager when company changes in create mode
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isCreateMode) {
      setFormParentId("");
      setFormManagerId("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [formCompanyId, isCreateMode]);

  // Sync state from context when data is loaded (edit/view modes)
  useEffect(() => {
    if (departmentData) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setFormCode(departmentData.code);
      setFormNameVi(departmentData.nameVi);
      setFormNameEn(departmentData.nameEn);
      setFormCompanyId(departmentData.companyId || "");
      setFormParentId(departmentData.parentId || "");
      setFormManagerId(departmentData.managerId || "");
      setFormUserIds(departmentData.users?.map((u) => u.id) || []);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [departmentData]);

  useEffect(() => {
    if (departmentData && allDepartments.length > 0) {
      const childIds = allDepartments
        .filter((d) => d.parentId === departmentData.id)
        .map((d) => d.id);
      const mappedUserIds = departmentData.users?.map((u) => u.id) || [];
      
      /* eslint-disable react-hooks/set-state-in-effect */
      setFormSubDepartmentIds(childIds);
      setInitialState({
        code: departmentData.code,
        nameVi: departmentData.nameVi,
        nameEn: departmentData.nameEn,
        companyId: departmentData.companyId || "",
        parentId: departmentData.parentId || "",
        managerId: departmentData.managerId || "",
        subDepartmentIds: childIds,
        userIds: mappedUserIds,
      });
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [departmentData, allDepartments]);

  const isReadOnly = mode === "view" || (departmentData ? !hasPermission(PERMISSIONS.DEPARTMENTS_UPDATE) : false);

  const isChanged = isCreateMode ? true : (
    !initialState ? false : (
      formCode.trim() !== initialState.code ||
      formNameVi.trim() !== initialState.nameVi ||
      formNameEn.trim() !== initialState.nameEn ||
      formCompanyId !== initialState.companyId ||
      formParentId !== initialState.parentId ||
      formManagerId !== initialState.managerId ||
      JSON.stringify([...formSubDepartmentIds].sort()) !== JSON.stringify([...initialState.subDepartmentIds].sort()) ||
      JSON.stringify([...formUserIds].sort()) !== JSON.stringify([...initialState.userIds].sort())
    )
  );

  // Helper check for loop parent
  const isDescendant = useCallback((deptId: string, parentIdToCheck: string): boolean => {
    function check(dId: string, pId: string): boolean {
      if (dId === pId) return true;
      const dept = allDepartments.find(d => d.id === dId);
      if (!dept || !dept.parentId) return false;
      if (dept.parentId === pId) return true;
      return check(dept.parentId, pId);
    }
    return check(deptId, parentIdToCheck);
  }, [allDepartments]);

  // Filter list of valid parent departments
  const validParentDepartments = allDepartments.filter((dept) => {
    const deptCompanyId = dept.companyId || "";
    // Cho phép cha là phòng ban toàn cục (deptCompanyId === "") hoặc cha thuộc cùng công ty
    if (deptCompanyId !== "" && deptCompanyId !== formCompanyId) return false;

    if (isCreateMode) return true;
    if (!departmentId) return true;
    
    // Cannot select itself
    if (dept.id === departmentId) return false;
    
    // Cannot select a department that is its descendant to avoid loops
    if (isDescendant(dept.id, departmentId)) return false;

    return true;
  });

  // Filter list of valid sub-departments
  const validSubDepartments = allDepartments.filter((dept) => {
    // Không được chọn chính nó
    if (dept.id === departmentId) return false;

    // Không được chọn các phòng ban là tổ tiên của nó để tránh loop
    if (departmentId && isDescendant(departmentId, dept.id)) return false;

    // Chỉ cho phép chọn nếu phòng ban chưa có cha, hoặc đang là con của nó
    if (dept.parentId !== null && dept.parentId !== departmentId) return false;

    // Ràng buộc công ty: nếu cha có công ty, con phải thuộc cùng công ty
    const deptCompanyId = dept.companyId || "";
    if (formCompanyId !== "" && deptCompanyId !== formCompanyId) return false;

    return true;
  });

  // Filter list of users belonging to this department for manager selection.
  // The user must belong to this department to be a manager.
  // We also include the current manager (if any) in the list just in case.
  const validManagers = isCreateMode
    ? []
    : allUsers.filter(
        (u) =>
          u.departmentIds?.includes(departmentId || "") ||
          u.id === formManagerId
      );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      return toast.error(t("departmentsPage.form.codeRequired"));
    }
    if (!formNameVi.trim()) {
      return toast.error(t("departmentsPage.form.nameViRequired"));
    }
    if (!formNameEn.trim()) {
      return toast.error(t("departmentsPage.form.nameEnRequired"));
    }

    setIsSaving(true);
    try {
      const url = isCreateMode ? "/api/departments" : `/api/departments/${departmentId}`;
      const method = isCreateMode ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim(),
          nameVi: formNameVi.trim(),
          nameEn: formNameEn.trim(),
          companyId: formCompanyId || null,
          parentId: formParentId || null,
          managerId: formManagerId || null,
          subDepartmentIds: formSubDepartmentIds,
          userIds: formUserIds,
        }),
      });

      if (res.ok) {
        toast.success(isCreateMode ? t("departmentsPage.messages.createSuccess") : t("departmentsPage.messages.updateSuccess"));
        if (!isCreateMode && setDepartmentData) {
          const updatedData = await res.json();
          if (updatedData.success && updatedData.data) {
            setInitialState({
              code: formCode.trim(),
              nameVi: formNameVi.trim(),
              nameEn: formNameEn.trim(),
              companyId: formCompanyId,
              parentId: formParentId,
              managerId: formManagerId,
              subDepartmentIds: formSubDepartmentIds,
              userIds: formUserIds,
            });
            // Fetch updated detail to populate full object in context
            await deptContext?.fetchDepartment();
          }
        }
        router.push("/departments");
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

  // Permission checks
  if (isCreateMode && !hasPermission(PERMISSIONS.DEPARTMENTS_CREATE)) {
    return <AccessDenied />;
  }
  if (!isCreateMode && !hasPermission(PERMISSIONS.DEPARTMENTS_READ)) {
    return <AccessDenied />;
  }

  // Titles & Headers
  const headerTitle = isCreateMode
    ? t("departmentsPage.createDepartment")
    : isReadOnly
      ? t("departmentsPage.viewDepartment")
      : t("departmentsPage.editDepartment");

  const headerDescription = isCreateMode
    ? t("departmentsPage.createDepartmentDesc")
    : isReadOnly
      ? t("departmentsPage.viewDepartmentDesc")
      : t("departmentsPage.editDepartmentDesc");

  const currentName = locale === "vi" ? departmentData?.nameVi : departmentData?.nameEn;

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/departments")}
            disabled={isSaving}
            className="h-10 w-10 cursor-pointer border-muted/70"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Network className="w-8 h-8 text-primary" />
              {headerTitle}
            </h1>
            <p className="text-muted-foreground mt-1">
              {headerDescription}
              {!isCreateMode && currentName && (
                <>: <strong className="text-foreground">{currentName}</strong></>
              )}
            </p>
          </div>
        </div>

        {mode === "view" && hasPermission(PERMISSIONS.DEPARTMENTS_UPDATE) && (
          <Button
            onClick={() => router.push(`/departments/${departmentId}/edit`)}
            className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0 flex items-center gap-2 self-start sm:self-center"
          >
            <Edit className="h-4 w-4" />
            {t("common.edit")}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card className="shadow-lg !overflow-visible">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              {t("departmentsPage.infoTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code */}
              <div className="space-y-2">
                <Label htmlFor="code" className="font-semibold text-sm">
                  {t("departmentsPage.form.code")} {!isReadOnly && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="code"
                  placeholder={t("departmentsPage.form.codePlaceholder")}
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
                />
              </div>

              {/* Company selection */}
              <div className="space-y-2">
                <Label htmlFor="companyId" className="font-semibold text-sm">
                  {t("departmentsPage.form.company")}
                </Label>
                {isLoadingDropdowns ? (
                  <div className="h-10 flex items-center text-xs text-muted-foreground bg-muted/10 px-3 rounded border">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {t("common.loading")}...
                  </div>
                ) : (
                  <SingleSelectCombobox
                    options={companies.map((company) => ({
                      id: company.id,
                      label: `${company.code} - ${locale === "vi" ? company.nameVi : company.nameEn}`,
                      code: company.code,
                    }))}
                    value={formCompanyId}
                    onChange={setFormCompanyId}
                    disabled={isReadOnly}
                    emptyLabel={`-- ${t("common.none")} --`}
                    placeholder={t("departmentsPage.form.company")}
                  />
                )}
              </div>

              {/* Name VI */}
              <div className="space-y-2">
                <Label htmlFor="nameVi" className="font-semibold text-sm">
                  {t("departmentsPage.form.nameVi")} {!isReadOnly && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="nameVi"
                  placeholder={t("departmentsPage.form.nameViPlaceholder")}
                  value={formNameVi}
                  onChange={(e) => setFormNameVi(e.target.value)}
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
                />
              </div>

              {/* Name EN */}
              <div className="space-y-2">
                <Label htmlFor="nameEn" className="font-semibold text-sm">
                  {t("departmentsPage.form.nameEn")} {!isReadOnly && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="nameEn"
                  placeholder={t("departmentsPage.form.nameEnPlaceholder")}
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
                />
              </div>

              {/* Parent Department */}
              <div className="space-y-2">
                <Label htmlFor="parentId" className="font-semibold text-sm">
                  {t("departmentsPage.form.parentDepartment")}
                </Label>
                {isLoadingDropdowns ? (
                  <div className="h-10 flex items-center text-xs text-muted-foreground bg-muted/10 px-3 rounded border">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {t("common.loading")}...
                  </div>
                ) : (
                  <SingleSelectCombobox
                    options={validParentDepartments.map((dept) => ({
                      id: dept.id,
                      label: `${dept.code} - ${locale === "vi" ? dept.nameVi : dept.nameEn}`,
                      code: dept.code,
                    }))}
                    value={formParentId}
                    onChange={setFormParentId}
                    disabled={isReadOnly}
                    emptyLabel={`-- ${t("departmentsPage.form.noneParent")} --`}
                    placeholder={t("departmentsPage.form.parentDepartment")}
                  />
                )}
              </div>

              {/* Manager */}
              <div className="space-y-2">
                <Label htmlFor="managerId" className="font-semibold text-sm">
                  {t("departmentsPage.form.manager")}
                </Label>
                {isLoadingDropdowns ? (
                  <div className="h-10 flex items-center text-xs text-muted-foreground bg-muted/10 px-3 rounded border">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {t("common.loading")}...
                  </div>
                ) : (
                  <SingleSelectCombobox
                    options={validManagers.map((u) => ({
                      id: u.id,
                      label: `${u.username} (${u.displayName || u.username})`,
                      code: u.username,
                    }))}
                    value={formManagerId}
                    onChange={setFormManagerId}
                    disabled={isReadOnly}
                    emptyLabel={`-- ${t("departmentsPage.form.noneManager")} --`}
                    placeholder={t("departmentsPage.form.manager")}
                  />
                )}
              </div>

              {/* Sub-departments selection */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subDepartments" className="font-semibold text-sm">
                  {t("departmentsPage.form.subDepartments")}
                </Label>
                {isLoadingDropdowns ? (
                  <div className="h-10 flex items-center text-xs text-muted-foreground bg-muted/10 px-3 rounded border">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {t("common.loading")}...
                  </div>
                ) : (
                  <MultiSelectCombobox
                    options={validSubDepartments.map((d) => ({
                      id: d.id,
                      label: `${d.code} - ${locale === "vi" ? d.nameVi : d.nameEn}`,
                      code: d.code,
                    }))}
                    selectedIds={formSubDepartmentIds}
                    onChange={setFormSubDepartmentIds}
                    placeholder={t("departmentsPage.form.noneSubDepartments")}
                    disabled={isReadOnly}
                  />
                )}
              </div>

              {/* Associated Employees selection */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="users" className="font-semibold text-sm">
                  {t("departmentsPage.form.users")}
                </Label>
                {isLoadingDropdowns ? (
                  <div className="h-10 flex items-center text-xs text-muted-foreground bg-muted/10 px-3 rounded border">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {t("common.loading")}...
                  </div>
                ) : (
                  <MultiSelectCombobox
                    options={allUsers.map((u) => ({
                      id: u.id,
                      label: `${u.displayName || u.username} (${u.username})`,
                      code: u.username,
                    }))}
                    selectedIds={formUserIds}
                    onChange={setFormUserIds}
                    placeholder={t("departmentsPage.form.noneUsers")}
                    disabled={isReadOnly}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/departments")}
            disabled={isSaving}
            className="h-10 px-5 font-semibold text-sm cursor-pointer"
          >
            {isReadOnly ? t("common.close") : t("common.cancel")}
          </Button>
          {!isReadOnly && (
            <Button
              type="submit"
              disabled={isSaving || !formCode.trim() || !formNameVi.trim() || !formNameEn.trim() || !isChanged}
              className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("common.save")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
