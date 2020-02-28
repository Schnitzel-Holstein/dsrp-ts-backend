import { Request } from "express";

export const buildPagination = (req: Request) => {
    let { limit, page } = req.query;
    if((limit && isNaN(limit as any)) || !limit) {
        limit = '10';
    }
    if(page && isNaN(page as any) || !page) {
        page = '1';
    }
    // Min 100 elements and max 100s
    const pageLimit = Math.max(10, Math.min(Number(limit), 100));
    const currentPage = Math.max(1, Number(page));

    return {
        page: currentPage,
        limit: pageLimit
    }
}