import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

interface UpdateDepartmentBody {
  code?: string;
  nameVi?: string;
  nameEn?: string;
  companyId?: string | null;
  parentId?: string | null;
  managerId?: string | null;
  cascadeUpdate?: boolean;
  subDepartmentIds?: string[];
  userIds?: string[];
  users?: {
    set: { id: string }[];
  };
}

interface FormattedDepartmentLog {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  company: string;
  parentDepartment: string;
  manager: string;
  subDepartments: string;
  users: string;
}

interface DepartmentWithRelations {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  companyObj?: { code: string; nameVi: string } | null;
  parentObj?: { code: string; nameVi: string } | null;
  managerObj?: { displayName: string | null; username: string } | null;
  subDepartments?: { code: string; nameVi: string }[] | null;
  users?: { id: string; username: string; displayName: string }[] | null;
}

function formatDepartmentForLog(dept: DepartmentWithRelations): FormattedDepartmentLog {
  return {
    id: dept.id,
    code: dept.code,
    nameVi: dept.nameVi,
    nameEn: dept.nameEn,
    company: dept.companyObj ? `${dept.companyObj.code} - ${dept.companyObj.nameVi}` : "GLOBAL",
    parentDepartment: dept.parentObj ? `${dept.parentObj.code} - ${dept.parentObj.nameVi}` : "None",
    manager: dept.managerObj ? `${dept.managerObj.displayName || dept.managerObj.username} (${dept.managerObj.username})` : "None",
    subDepartments: dept.subDepartments && dept.subDepartments.length > 0
      ? dept.subDepartments.map((d) => `${d.code} - ${d.nameVi}`).join(", ")
      : "None",
    users: dept.users && dept.users.length > 0
      ? dept.users.map((u) => `${u.displayName || u.username} (${u.username})`).join(", ")
      : "None",
  };
}

// GET: Lấy thông tin chi tiết một phòng ban
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;

    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        companyObj: true,
        parentObj: true,
        managerObj: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!dept) {
      return NextResponse.json({ error: t("errors.departmentNotFound") }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: dept,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json({ error: rawMessage }, { status: 500 });
  }
}

// Hàm đệ quy kiểm tra xem phòng ban A có phải là con/cháu của phòng ban B hay không
async function isDescendant(childId: string, parentId: string): Promise<boolean> {
  if (childId === parentId) return true;
  
  const child = await prisma.department.findUnique({
    where: { id: childId },
    select: { parentId: true },
  });

  if (!child || !child.parentId) return false;
  if (child.parentId === parentId) return true;

  return isDescendant(child.parentId, parentId);
}



// PATCH: Cập nhật phòng ban
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_UPDATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateDepartmentBody;
    const { code, nameVi, nameEn, companyId, parentId, managerId, subDepartmentIds, userIds } = body;

    const existingDept = await prisma.department.findUnique({
      where: { id },
      include: {
        companyObj: true,
        parentObj: true,
        managerObj: true,
        subDepartments: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!existingDept) {
      return NextResponse.json({ error: t("errors.departmentNotFound") }, { status: 404 });
    }

    // Xác định công ty mục tiêu sau cập nhật (có thể là một ID cụ thể hoặc null)
    const targetCompanyId = companyId !== undefined ? companyId : existingDept.companyId;

    // Kiểm tra tính hợp lệ của công ty mới
    if (companyId !== undefined && companyId !== null) {
      const companyExists = await prisma.company.findUnique({
        where: { id: companyId },
      });
      if (!companyExists) {
        return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
      }
    }

    const updateData: UpdateDepartmentBody = {};

    if (code !== undefined) {
      const formattedCode = code.trim();
      if (!formattedCode) {
        return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
      }

      // Kiểm tra trùng mã phòng ban trên toàn hệ thống
      if (formattedCode.toLowerCase() !== existingDept.code.toLowerCase()) {
        const duplicate = await prisma.department.findFirst({
          where: {
            code: {
              equals: formattedCode,
              mode: "insensitive",
            },
            id: { not: id },
          },
        });

        if (duplicate) {
          return NextResponse.json({ error: t("errors.departmentCodeExists") }, { status: 400 });
        }
      }
      updateData.code = formattedCode;
    }

    // Xác định parentId cuối cùng
    const finalParentId = parentId !== undefined ? parentId : existingDept.parentId;

    if (finalParentId !== null) {
      if (finalParentId === id) {
        return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
      }

      const parentExists = await prisma.department.findUnique({
        where: { id: finalParentId },
      });

      if (!parentExists) {
        return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
      }

      // Kiểm tra tránh chọn phòng ban con của chính mình làm cha
      if (finalParentId !== existingDept.parentId) {
        const isLoop = await isDescendant(finalParentId, id);
        if (isLoop) {
          return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
        }
      }

      // Kiểm tra chéo Phòng ban cha thuộc cùng công ty (hoặc cha toàn cục)
      if (parentExists.companyId !== null && parentExists.companyId !== targetCompanyId) {
        return NextResponse.json({ error: t("errors.parentDepartmentMustBelongToCompany") }, { status: 400 });
      }
    }

    updateData.parentId = finalParentId;

    if (nameVi !== undefined) updateData.nameVi = nameVi.trim();
    if (nameEn !== undefined) updateData.nameEn = nameEn.trim();

    // Kiểm tra Trưởng phòng phải thuộc về phòng ban này và tự động liên kết với công ty mục tiêu
    if (managerId !== undefined) {
      if (managerId !== null) {
        const userInDept = await prisma.user.findFirst({
          where: {
            id: managerId,
            departments: { some: { id } },
          },
        });
        if (!userInDept) {
          return NextResponse.json({ error: t("errors.managerMustBelongToDepartment") }, { status: 400 });
        }

        if (targetCompanyId) {
          const hasCompany = await prisma.user.findFirst({
            where: {
              id: managerId,
              companies: { some: { id: targetCompanyId } },
            },
          });
          if (!hasCompany) {
            await prisma.user.update({
              where: { id: managerId },
              data: {
                companies: { connect: { id: targetCompanyId } },
              },
            });
          }
        }
      }
      updateData.managerId = managerId || null;
    }

    if (companyId !== undefined) {
      updateData.companyId = companyId;
    }

    if (userIds !== undefined) {
      updateData.users = {
        set: userIds.map((uId: string) => ({ id: uId })),
      };
    }

    // Kiểm tra vòng lặp phân cấp cho các con mới gán
    if (subDepartmentIds !== undefined) {
      for (const childId of subDepartmentIds) {
        if (childId === id) {
          return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
        }
        const isLoop = await isDescendant(id, childId);
        if (isLoop) {
          return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
        }
      }
    }

    // Nếu thay đổi công ty
    const companyChanged = companyId !== undefined && companyId !== existingDept.companyId;
    
    // Nếu thay đổi công ty và công ty mới không phải toàn cục (targetCompanyId !== null)
    if (companyChanged && targetCompanyId !== null) {
      // Kiểm tra xem có phòng ban con nào trực tiếp thuộc công ty khác không
      const diffCompanyChild = await prisma.department.findFirst({
        where: {
          parentId: id,
          companyId: { not: targetCompanyId },
        },
      });
      if (diffCompanyChild) {
        return NextResponse.json({ error: t("errors.cannotChangeCompanyWithSubDepartments") }, { status: 400 });
      }
    }

    // Thực hiện cập nhật chính phòng ban đó
    const updatedDept = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        companyObj: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    // Sau khi cập nhật, thực hiện đồng bộ công ty cho nhân viên
    if (userIds !== undefined && targetCompanyId) {
      for (const uId of userIds) {
        const hasCompany = await prisma.user.findFirst({
          where: {
            id: uId,
            companies: { some: { id: targetCompanyId } },
          },
        });
        if (!hasCompany) {
          await prisma.user.update({
            where: { id: uId },
            data: {
              companies: { connect: { id: targetCompanyId } },
            },
          });
        }
      }
    }

    let newChildIds: string[] = [];

    // Xử lý cập nhật các phòng ban con
    if (subDepartmentIds !== undefined) {
      // Chặn nếu gán con thuộc công ty khác
      if (targetCompanyId !== null) {
        const diffCompanySubDept = await prisma.department.findFirst({
          where: {
            id: { in: subDepartmentIds },
            companyId: { not: targetCompanyId },
          },
        });
        if (diffCompanySubDept) {
          return NextResponse.json({ error: t("errors.cannotAddSubDepartmentDifferentCompany") }, { status: 400 });
        }
      }

      const currentChildren = await prisma.department.findMany({
        where: { parentId: id },
        select: { id: true },
      });
      const currentChildIds = currentChildren.map(c => c.id);

      const removedChildIds = currentChildIds.filter(cId => !subDepartmentIds.includes(cId));
      newChildIds = subDepartmentIds.filter(cId => !currentChildIds.includes(cId));

      if (removedChildIds.length > 0) {
        await prisma.department.updateMany({
          where: { id: { in: removedChildIds } },
          data: { parentId: null },
        });
      }

      if (newChildIds.length > 0) {
        await prisma.department.updateMany({
          where: { id: { in: newChildIds } },
          data: { parentId: id },
        });
      }
    }

    // Đồng bộ liên kết công ty cho nhân viên trực thuộc phòng ban hiện tại (nếu công ty thay đổi)
    const oldCompanyId = existingDept.companyId;
    const shouldSyncCompany = companyChanged && targetCompanyId;
    if (shouldSyncCompany && targetCompanyId) {
      // Tìm tất cả nhân viên thuộc phòng ban này
      const usersInDept = await prisma.user.findMany({
        where: {
          departments: {
            some: { id },
          },
        },
        select: { id: true },
      });

      const uniqueUserIds = new Set<string>();
      usersInDept.forEach(u => uniqueUserIds.add(u.id));
      if (updatedDept.managerId) {
        uniqueUserIds.add(updatedDept.managerId);
      }

      if (uniqueUserIds.size > 0) {
        const userIdList = Array.from(uniqueUserIds);
        
        // Connect từng user với công ty mới
        for (const uId of userIdList) {
          const hasCompany = await prisma.user.findFirst({
            where: {
              id: uId,
              companies: { some: { id: targetCompanyId } },
            },
          });
          if (!hasCompany) {
            await prisma.user.update({
              where: { id: uId },
              data: {
                companies: { connect: { id: targetCompanyId } },
              },
            });
          }

          // Disconnect user khỏi công ty cũ nếu họ không còn phòng ban nào ở công ty cũ
          if (oldCompanyId && oldCompanyId !== targetCompanyId) {
            const remainingDeptsInOldCompany = await prisma.department.count({
              where: {
                companyId: oldCompanyId,
                users: { some: { id: uId } },
              },
            });

            if (remainingDeptsInOldCompany === 0) {
              await prisma.user.update({
                where: { id: uId },
                data: {
                  companies: { disconnect: { id: oldCompanyId } },
                },
              });
            }
          }
        }
      }
    }

    // Fetch full department details after all updates for rich log comparison
    const finalUpdatedDept = await prisma.department.findUnique({
      where: { id },
      include: {
        companyObj: true,
        parentObj: true,
        managerObj: true,
        subDepartments: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    // Ghi audit log
    const targetInfo = `${updatedDept.companyObj?.code || "GLOBAL"} / ${updatedDept.code}`;
    await logAction("department:update", targetInfo, {
      status: "success",
      message: "auditLogsPage.messages.updateDepartmentSuccess",
      data: {
        before: formatDepartmentForLog(existingDept),
        after: finalUpdatedDept ? formatDepartmentForLog(finalUpdatedDept) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedDept,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json({ error: rawMessage }, { status: 500 });
  }
}

// DELETE: Xóa phòng ban
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_DELETE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;

    const existingDept = await prisma.department.findUnique({
      where: { id },
      include: {
        companyObj: true,
        parentObj: true,
        managerObj: true,
        subDepartments: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            users: true,
            subDepartments: true,
          },
        },
      },
    });

    if (!existingDept) {
      return NextResponse.json({ error: t("errors.departmentNotFound") }, { status: 404 });
    }

    // Kiểm tra xem có nhân viên trực thuộc phòng ban không
    if (existingDept._count.users > 0) {
      return NextResponse.json(
        { error: t("errors.cannotDeleteDepartmentHasUsers") },
        { status: 400 },
      );
    }

    // Kiểm tra xem có phòng ban con trực thuộc không
    if (existingDept._count.subDepartments > 0) {
      return NextResponse.json(
        { error: t("errors.cannotDeleteDepartmentHasSubDepartments") },
        { status: 400 },
      );
    }

    // Thực hiện xóa
    await prisma.department.delete({
      where: { id },
    });

    // Ghi audit log
    const targetInfo = `${existingDept.companyObj?.code || "GLOBAL"} / ${existingDept.code}`;
    await logAction("department:delete", targetInfo, {
      status: "success",
      message: "auditLogsPage.messages.deleteDepartmentSuccess",
      data: {
        before: formatDepartmentForLog(existingDept),
        after: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json({ error: rawMessage }, { status: 500 });
  }
}
