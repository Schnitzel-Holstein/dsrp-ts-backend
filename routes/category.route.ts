import { Router, Request, Response, NextFunction } from "express";
import HttpException from "../exceptions/HttpException";
import { IUserRequest } from "../declarations/request_user";
import { db } from "../lib/database";
import loginRequired from "../middlewares/login_required.middleware";
import roleRequired from "../middlewares/role_required.middleware";
import { buildPagination } from '../lib/utils';

const categoryRouter = Router();

/**
 * Get all categories
 */
categoryRouter.get('/', (req: IUserRequest, res: Response, next: NextFunction) => {
    const { page, limit } = buildPagination(req);

    db.task(async t => {
        let query = 'SELECT * FROM categories';
        let queryCount = 'SELECT count(id) FROM categories';
        const params = [];

        const totalResults = (await t.query(queryCount))[0].count;

        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push((page-1)*limit);
        query += ` OFFSET $${params.length}`;

        const results = await t.query(query,params);
        
        return res.status(200).json({
            total: totalResults,
            categories: results
        });
    });
});


/**
 * Get info of a category
 * @param id <number>
 */
categoryRouter.get('/:id', (req: IUserRequest, res: Response, next: NextFunction) => {

    const { id } = req.params;
    db.task(async t => {
        const categorySearch = await t.query('SELECT * FROM categories WHERE id=$1', [id]).catch((err:any) => {return [null]});
        return res.status(200).json({
            category: categorySearch[0] || null
        });
    });

});

/**
 * Create a new category and returns its info
 * @param name <string>
 * @param description <string>
 * @param image <string>
 * @param color <string>
 */
categoryRouter.post('/', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const { name, description, image, color } = req.body;

    db.task(async t => {
        // Try to insert it
        const insertedCategory = await t.query(
            'INSERT INTO categories(name, description, image, color) VALUES($1,$2,$3,$4) RETURNING *',
            [name, description, image, color]
        ).catch((err: any) => {
            // MISSION FAILED
            return [];
        });

        if(insertedCategory.length === 0) {
            return next(new HttpException(500, 'Error creating category'));
        }

        return res.status(200).json({
            category: insertedCategory[0]
        });
    });
});

/**
 * Update info of a category
 */
categoryRouter.put('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const { name, description, image, color } = req.body;
    const { id } = req.params;
    if(!name && !description && !image && !color) {
        return next(new HttpException(400, 'You must edit something'));
    }
    if(isNaN(id as any)) {
        return next(new HttpException(400, 'Id must be integer'));
    }
    db.task(async t=> {
        const categoryExistence = (await t.query('SELECT id FROM categories WHERE id=$1',[id]).catch((err:any)=>{return []})).length > 0;
        if(!categoryExistence) {
            return next(new HttpException(400, 'Invalid id'));
        }

        let query = 'UPDATE categories SET';
        let params = [];
        if (name) {
            params.push(name);
            query += ` name=$${params.length}`;
        }

        if ( description ) {
            if ( params.length > 0) {
                query += ',';
            }
            params.push(description);
            query += ` description=$${params.length}`;
        }

        if ( image ) {
            if ( params.length > 0) {
                query += ',';
            }
            params.push(image);
            query += ` image=$${params.length}`;
        }

        if ( color ) {
            if ( params.length > 0) {
                query += ',';
            }
            params.push(color);
            query += ` color=$${params.length}`;
        }

        // Params will always be greater than 1, so just add the ',' 
        params.push(id);
        query += `, updated_at=now() WHERE id=$${params.length} RETURNING *`;

        await t.query(query, params)
            .then((categoryResult: any) => {
                return res.status(200).json({
                    success: true,
                    category: categoryResult[0]
                })
            })
            .catch((err: any) => {
                console.log(err);
                return next(new HttpException(500, 'Internal server error while updating forum'));
            });

    });
});

/**
 * Deletes a category and its children
 */
categoryRouter.delete('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (isNaN(id as any)) {
        return next(new HttpException(400, 'Id must be integer'));
    }

    db.task(async t => {
        const categoryExistence = (await t.query('SELECT id FROM categories WHERE id=$1',[id]).catch((err:any)=>{return []})).length > 0;
        if(!categoryExistence) {
            return next(new HttpException(400, 'Invalid id'));
        }
        await t.query('DELETE FROM forums WHERE category=$1', [id])
            .catch((err: any) => {
                return next(new HttpException(500, 'Internal server error'));
            })
        await t.query('DELETE FROM categories WHERE id=$1', [id])
            .then(()=> {
                return res.status(200).json({
                    success: true
                });
            })
            .catch((err:any) => {
                console.log(err);
                return next(new HttpException(500, 'Internal server error while deleting forum'));
            });
        
    });
});

export default categoryRouter;