import { prisma } from "@/lib/db";
import { logAction } from "@/modules/audit-logs/services";
import { CreateDepartmentInput, UpdateDepartmentInput, DepartmentWithRelations, FormattedDepartmentLog } from "./types";
import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "@/lib/errors";

// Hàm đệ quy kiểm tra xem phòng ban A có phải là con/cháu của phòng ban B hay không
export async function isDescendant(
  childId: string,
  parentId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  if (childId === parentId) return true;
  
  const client = tx || prisma;
  const child = await client.department.findUnique({
    where: { id: childId },
    select: { parentId: true },
  });

  if (!child || !child.parentId) return false;
  if (child.parentId === parentId) return true;

  return isDescendant(child.parentId, parentId, tx);
}

export function formatDepartmentForLog(dept: DepartmentWithRelations): FormattedDepartmentLog {
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

export async function getDepartmentsList(params: {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: string;
  companyId: string;
}) {
  const { page, limit, search, sortBy, sortOrder, companyId } = params;
  const offset = (page - 1) * limit;

  const where: Prisma.DepartmentWhereInput = {};

  if (companyId) {
    where.companyId = companyId;
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { nameVi: { contains: search, mode: "insensitive" } },
      { nameEn: { contains: search, mode: "insensitive" } },
    ];
  }

  const allowedSortFields = ["code", "nameVi", "nameEn", "createdAt"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "code";
  const sortDirection = sortOrder === "desc" ? "desc" : "asc";

  const orderBy: Prisma.DepartmentOrderByWithRelationInput = {
    [sortField]: sortDirection,
  };

  const [total, departments] = await Promise.all([
    prisma.department.count({ where }),
    prisma.department.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: {
        companyObj: {
          select: {
            id: true,
            code: true,
            nameVi: true,
            nameEn: true,
          },
        },
        parentObj: {
          select: {
            id: true,
            code: true,
            nameVi: true,
            nameEn: true,
          },
        },
        managerObj: {
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
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    departments,
    pagination: {
      page,
      limit,
      totalCount: total,
      totalPages,
    },
  };
}

export async function getDepartmentById(id: string) {
  return prisma.department.findUnique({
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
}

export async function createDepartment(input: CreateDepartmentInput) {
  const { code, nameVi, nameEn, companyId, parentId, managerId, subDepartmentIds, userIds } = input;
  const companyIdVal = companyId || null;

  return prisma.$transaction(async (tx) => {
    if (parentId) {
      const parentDept = await tx.department.findUnique({
        where: { id: parentId },
      });
      if (!parentDept || (parentDept.companyId !== null && parentDept.companyId !== companyIdVal)) {
        throw new BadRequestError("errors.parentDepartmentMustBelongToCompany");
      }
    }

    if (managerId) {
      throw new BadRequestError("errors.managerMustBelongToDepartment");
    }

    const formattedCode = code.trim();

    const existing = await tx.department.findFirst({
      where: {
        code: {
          equals: formattedCode,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw new BadRequestError("errors.departmentCodeExists");
    }

    const newDept = await tx.department.create({
      data: {
        code: formattedCode,
        nameVi: (nameVi || "").trim(),
        nameEn: (nameEn || "").trim(),
        companyId: companyIdVal,
        parentId: parentId || null,
        managerId: managerId || null,
        users: userIds && userIds.length > 0 ? {
          connect: userIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        companyObj: true,
      },
    });

    if (userIds && userIds.length > 0 && companyIdVal) {
      for (const uId of userIds) {
        const hasCompany = await tx.user.findFirst({
          where: {
            id: uId,
            companies: { some: { id: companyIdVal } },
          },
        });
        if (!hasCompany) {
          await tx.user.update({
            where: { id: uId },
            data: {
              companies: { connect: { id: companyIdVal } },
            },
          });
        }
      }
    }

    if (subDepartmentIds && subDepartmentIds.length > 0) {
      if (companyIdVal) {
        const diffCompanySubDept = await tx.department.findFirst({
          where: {
            id: { in: subDepartmentIds },
            companyId: { not: companyIdVal },
          },
        });
        if (diffCompanySubDept) {
          throw new BadRequestError("errors.cannotAddSubDepartmentDifferentCompany");
        }
      }

      await tx.department.updateMany({
        where: { id: { in: subDepartmentIds } },
        data: { parentId: newDept.id },
      });
    }

    const fullDept = await tx.department.findUnique({
      where: { id: newDept.id },
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

    const targetInfo = `${newDept.companyObj?.code || "GLOBAL"} / ${newDept.code}`;
    await logAction("department:create", targetInfo, {
      status: "success",
      message: "auditLogsPage.messages.createDepartmentSuccess",
      data: {
        before: null,
        after: fullDept ? formatDepartmentForLog(fullDept) : null,
      },
    });

    return newDept;
  });
}

export async function updateDepartment(id: string, input: UpdateDepartmentInput) {
  const { code, nameVi, nameEn, companyId, parentId, managerId, subDepartmentIds, userIds } = input;

  return prisma.$transaction(async (tx) => {
    const existingDept = await tx.department.findUnique({
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
      throw new NotFoundError("errors.departmentNotFound");
    }

    const targetCompanyId = companyId !== undefined ? companyId : existingDept.companyId;

    if (companyId !== undefined && companyId !== null) {
      const companyExists = await tx.company.findUnique({
        where: { id: companyId },
      });
      if (!companyExists) {
        throw new BadRequestError("errors.invalidPayload");
      }
    }

    const updateData: Prisma.DepartmentUncheckedUpdateInput = {};

    if (code !== undefined) {
      const formattedCode = code.trim();
      if (!formattedCode) {
        throw new BadRequestError("errors.invalidPayload");
      }

      if (formattedCode.toLowerCase() !== existingDept.code.toLowerCase()) {
        const duplicate = await tx.department.findFirst({
          where: {
            code: {
              equals: formattedCode,
              mode: "insensitive",
            },
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new BadRequestError("errors.departmentCodeExists");
        }
      }
      updateData.code = formattedCode;
    }

    const finalParentId = parentId !== undefined ? parentId : existingDept.parentId;

    if (finalParentId !== null) {
      if (finalParentId === id) {
        throw new BadRequestError("errors.invalidPayload");
      }

      const parentExists = await tx.department.findUnique({
        where: { id: finalParentId },
      });

      if (!parentExists) {
        throw new BadRequestError("errors.invalidPayload");
      }

      if (finalParentId !== existingDept.parentId) {
        const isLoop = await isDescendant(finalParentId, id, tx);
        if (isLoop) {
          throw new BadRequestError("errors.invalidPayload");
        }
      }

      if (parentExists.companyId !== null && parentExists.companyId !== targetCompanyId) {
        throw new BadRequestError("errors.parentDepartmentMustBelongToCompany");
      }
    }

    updateData.parentId = finalParentId;

    if (nameVi !== undefined) updateData.nameVi = nameVi.trim();
    if (nameEn !== undefined) updateData.nameEn = nameEn.trim();

    if (managerId !== undefined) {
      if (managerId !== null) {
        const userInDept = await tx.user.findFirst({
          where: {
            id: managerId,
            departments: { some: { id } },
          },
        });
        if (!userInDept) {
          throw new BadRequestError("errors.managerMustBelongToDepartment");
        }

        if (targetCompanyId) {
          const hasCompany = await tx.user.findFirst({
            where: {
              id: managerId,
              companies: { some: { id: targetCompanyId } },
            },
          });
          if (!hasCompany) {
            await tx.user.update({
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

    if (subDepartmentIds !== undefined) {
      for (const childId of subDepartmentIds) {
        if (childId === id) {
          throw new BadRequestError("errors.invalidPayload");
        }
        const isLoop = await isDescendant(id, childId, tx);
        if (isLoop) {
          throw new BadRequestError("errors.invalidPayload");
        }
      }
    }

    const companyChanged = companyId !== undefined && companyId !== existingDept.companyId;
    
    if (companyChanged && targetCompanyId !== null) {
      const diffCompanyChild = await tx.department.findFirst({
        where: {
          parentId: id,
          companyId: { not: targetCompanyId },
        },
      });
      if (diffCompanyChild) {
        throw new BadRequestError("errors.cannotChangeCompanyWithSubDepartments");
      }
    }

    const updatedDept = await tx.department.update({
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

    if (userIds !== undefined && targetCompanyId) {
      for (const uId of userIds) {
        const hasCompany = await tx.user.findFirst({
          where: {
            id: uId,
            companies: { some: { id: targetCompanyId } },
          },
        });
        if (!hasCompany) {
          await tx.user.update({
            where: { id: uId },
            data: {
              companies: { connect: { id: targetCompanyId } },
            },
          });
        }
      }
    }

    let newChildIds: string[] = [];

    if (subDepartmentIds !== undefined) {
      if (targetCompanyId !== null) {
        const diffCompanySubDept = await tx.department.findFirst({
          where: {
            id: { in: subDepartmentIds },
            companyId: { not: targetCompanyId },
          },
        });
        if (diffCompanySubDept) {
          throw new BadRequestError("errors.cannotAddSubDepartmentDifferentCompany");
        }
      }

      const currentChildren = await tx.department.findMany({
        where: { parentId: id },
        select: { id: true },
      });
      const currentChildIds = currentChildren.map(c => c.id);

      const removedChildIds = currentChildIds.filter(cId => !subDepartmentIds.includes(cId));
      newChildIds = subDepartmentIds.filter(cId => !currentChildIds.includes(cId));

      if (removedChildIds.length > 0) {
        await tx.department.updateMany({
          where: { id: { in: removedChildIds } },
          data: { parentId: null },
        });
      }

      if (newChildIds.length > 0) {
        await tx.department.updateMany({
          where: { id: { in: newChildIds } },
          data: { parentId: id },
        });
      }
    }

    const oldCompanyId = existingDept.companyId;
    const shouldSyncCompany = companyChanged && targetCompanyId;
    if (shouldSyncCompany && targetCompanyId) {
      const usersInDept = await tx.user.findMany({
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
        
        for (const uId of userIdList) {
          const hasCompany = await tx.user.findFirst({
            where: {
              id: uId,
              companies: { some: { id: targetCompanyId } },
            },
          });
          if (!hasCompany) {
            await tx.user.update({
              where: { id: uId },
              data: {
                companies: { connect: { id: targetCompanyId } },
              },
            });
          }

          if (oldCompanyId && oldCompanyId !== targetCompanyId) {
            const remainingDeptsInOldCompany = await tx.department.count({
              where: {
                companyId: oldCompanyId,
                users: { some: { id: uId } },
              },
            });

            if (remainingDeptsInOldCompany === 0) {
              await tx.user.update({
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

    const finalUpdatedDept = await tx.department.findUnique({
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

    const targetInfo = `${updatedDept.companyObj?.code || "GLOBAL"} / ${updatedDept.code}`;
    await logAction("department:update", targetInfo, {
      status: "success",
      message: "auditLogsPage.messages.updateDepartmentSuccess",
      data: {
        before: formatDepartmentForLog(existingDept),
        after: finalUpdatedDept ? formatDepartmentForLog(finalUpdatedDept) : null,
      },
    });

    return updatedDept;
  });
}

export async function deleteDepartment(id: string) {
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
    throw new NotFoundError("errors.departmentNotFound");
  }

  if (existingDept._count.users > 0) {
    throw new BadRequestError("errors.cannotDeleteDepartmentHasUsers");
  }

  if (existingDept._count.subDepartments > 0) {
    throw new BadRequestError("errors.cannotDeleteDepartmentHasSubDepartments");
  }

  await prisma.department.delete({
    where: { id },
  });

  const targetInfo = `${existingDept.companyObj?.code || "GLOBAL"} / ${existingDept.code}`;
  await logAction("department:delete", targetInfo, {
    status: "success",
    message: "auditLogsPage.messages.deleteDepartmentSuccess",
    data: {
      before: formatDepartmentForLog(existingDept),
      after: null,
    },
  });

  return true;
}
