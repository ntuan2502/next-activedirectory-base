"use client";

import { useParams } from "next/navigation";
import { CompanyEditor } from "../company-editor";

export default function ViewCompanyPage() {
  const params = useParams();
  const id = params.id as string;

  return <CompanyEditor companyId={id} mode="view" />;
}
