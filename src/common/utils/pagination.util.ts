import { PaginationQueryDto } from "../dto/pagination-query.dto";

export interface PaginationOptions {
  defaultOrderBy?: any;
  searchFields?: string[];
}

export function buildPrismaPagination(
  dto: PaginationQueryDto,
  options?: PaginationOptions,
) {
  const { page = 1, limit = 10, sortBy, sortOrder, search } = dto || {};
  
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // 1. Build OrderBy
  let orderBy = options?.defaultOrderBy || { createdAt: "desc" };
  if (sortBy) {
    if (Array.isArray(orderBy)) {
       orderBy = [{ [sortBy]: sortOrder || "asc" }];
    } else {
       orderBy = { [sortBy]: sortOrder || "asc" };
    }
  }

  // 2. Build Search (Where)
  const searchWhere: any = {};
  if (search && options?.searchFields?.length) {
    if (options.searchFields.length === 1) {
      searchWhere[options.searchFields[0]] = { contains: search, mode: "insensitive" };
    } else {
      searchWhere["OR"] = options.searchFields.map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    }
  }

  return { skip, take, orderBy, searchWhere };
}
