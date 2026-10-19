import { describe, expect, it } from "vitest";
import { getPagination, paginate } from "./pagination.js";

describe("pagination", () => {
  it("calculates pagination consistently", () => {
    expect(getPagination({ page: 1, pageSize: 25 }, 0)).toEqual({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    expect(getPagination({ page: 2, pageSize: 10 }, 21)).toEqual({ page: 2, pageSize: 10, total: 21, totalPages: 3 });
  });

  it("passes limit and offset for the requested page", async () => {
    const calls: [number, number][] = [];
    const result = await paginate(
      { page: 3, pageSize: 10 },
      async (limit, offset) => {
        calls.push([limit, offset]);
        return ["x"];
      },
      async () => 21,
    );
    expect(calls).toEqual([[10, 20]]);
    expect(result).toEqual({ data: ["x"], pagination: { page: 3, pageSize: 10, total: 21, totalPages: 3 } });
  });
});
