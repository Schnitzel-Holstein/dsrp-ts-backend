import { Router, Request, Response, NextFunction } from "express";
import HttpException from "../exceptions/HttpException";
import { IUserRequest } from "../declarations/request_user";
import { db } from "../lib/database";
import loginRequired from "../middlewares/login_required.middleware";
import roleRequired from "../middlewares/role_required.middleware";
import { buildPagination } from '../lib/utils';

const forumRouter = Router();

/**
 * Get all forums
 * @param type <string> 'parent' | 'child'
 * @param parent-id <number> id of the parent
 */
forumRouter.get('/', (req: IUserRequest, res: Response, next: NextFunction) => {
    const { page, limit } = buildPagination(req);
    const { type } = req.query;
    const categoryId = req.query['category-id'];
    const parentId = req.query['parent-id'];

    db.task(async t => {
        let query = 'SELECT * FROM forums';
        let queryCount = 'SELECT count(id) FROM forums';
        let params = [];

        if(type && ['parent', 'child'].includes(type)) {
            if(type === 'parent') {
                query += ' WHERE parent_forum IS null';
                queryCount += ' WHERE parent_forum IS null';
            }
            else if(!isNaN(parentId as any)) {
                query += ' WHERE parent_forum=$1';
                queryCount += ' WHERE parent_forum=$1';
                params.push(parentId);
            }
        }

        if(categoryId && !isNaN(categoryId)) {
            if(params.length === 0 || type && type === 'parent') {
                query += ' WHERE';
                queryCount += ' WHERE';
            }
            else {
                query += ' AND';
                queryCount += ' AND';
            }
            params.push(categoryId);
            query += ` category=$${params.length}`;
            queryCount += ` category=$${params.length}`;
        }

        const totalResults = (await t.query(queryCount, params))[0].count;

        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push((page-1)*limit);
        query += ` OFFSET $${params.length}`;

        const results = await t.query(query,params);

        return res.status(200).json({
            total: totalResults,
            forums: results
        });
    });
});


forumRouter.get('/last-post/:id', (req: IUserRequest, res:Response, next:NextFunction) => {

    const { id } = req.params;
    if(isNaN(id as any)) {
        return next(new HttpException(400, 'Id must be integer'));
    }

    const processedForums:number[] = [];
    const processedThreads:any[] = [];

    db.task(async t => {
        let forums = [id];
        let lastForumPost:any = null;
        let lastForumPostThread: any = null;
        // BFS search (kinda)
        do {
            // Grab the forum
            const forum = forums[0];
            // Get its threads
            const threads = await t.query('SELECT * FROM threads WHERE parent_forum=$1', [forum]);

            // Process each thread
            for(const thread of threads) {
                // If it was processed, skip
                if(processedThreads.find(t => t.id === thread.id)) {
                    continue;
                }

                // Get total of posts ( for pagination )
                const totalPosts = (await t.query('SELECT count(id) FROM posts WHERE parent_thread=$1',[thread.id]))[0].count;
                // Get the last post
                const lastPost = (await t.query('SELECT * FROM posts WHERE parent_thread=$1 ORDER BY created_at DESC LIMIT 1', [thread.id]));

                // Check if it was created after the previous one set
                if(!lastForumPost || (lastPost.length > 0 && lastPost[0].created_at > lastForumPost.created_at)) {
                    // Set it as last post
                    lastForumPost = lastPost[0];
                    // Set the details of that thread
                    lastForumPostThread = {
                        thread,
                        totalPosts
                    };
                }

                // Mark thread as processed
                processedThreads.push(thread);
            }

            // Mark forum as processed
            processedForums.push(Number(forum));

            // Process child forums
            const childForums = (await t.query('SELECT id FROM forums WHERE parent_forum=$1', [forum])).map((f:any)=>{return Number(f.id)});
            for (let i=0;i<childForums.length;i++) {
                if(!processedForums.includes(childForums[i])) {
                    forums.push(childForums[i]);
                }
            }

            // Delete current forum from array
            forums.shift();
        } while(forums.length > 0);

        return res.status(200).json({
            thread: lastForumPostThread,
            post: lastForumPost
        });
    });

});


/**
 * Get info of a forum by its id
 * @param id <number>
 */
forumRouter.get('/:id', (req: IUserRequest, res: Response, next: NextFunction) => {

    const { id } = req.params;
    db.task(async t => {
        const forumSearch = await t.query('SELECT * FROM forums WHERE id=$1', [id]).catch((err:any) => {return [null]});
        return res.status(200).json({
            forum: forumSearch[0] || null
        });
    });

});

/**
 * Create a new forum and return its id
 * @param name <string>
 * @param description <string>
 * @param image <string>
 * @param parent <integer>
 */
forumRouter.post('/', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const { name, description, image, parent, category } = req.body;
    if (!name) {
        return next(new HttpException(400, 'Name is required'));
    }

    if (parent && isNaN(parent as any)) {
        return next(new HttpException(400, 'Parent id must be integer'));
    }

    if (category && isNaN(category as any)) {
        return next(new HttpException(400, 'Category must be integer'));
    }

    if(!category && !parent) {
        return next(new HttpException(400, 'You must send either parent or category'));
    }

    db.task(async t => {
        // Check if the parent exists
        if(parent) {
            const parentExists = (await t.query('SELECT id FROM forums WHERE id=$1', [parent]).catch((err:any)=>{return []})).length > 0;
            if(!parentExists) {
                return next(new HttpException(400, 'Invalid parent id'));
            }
        }
        if(category) {
            const categoryExists = (await t.query('SELECT id FROM categories WHERE id=$1', [category]).catch((err:any)=>{return []})).length > 0
            if(!categoryExists) {
                return next(new HttpException(400, 'Invalid category id'));
            }
        }
        // Try to insert it
        const insertedForum = await t.query(
            'INSERT INTO forums(name, description, image, parent_forum, category) VALUES($1,$2,$3,$4,$5) RETURNING *',
            [name, description, image, parent, category]
        ).catch((err: any) => {
            // MISSION FAILED
            return [];
        });

        if(insertedForum.length === 0) {
            return next(new HttpException(500, 'Error creating forum'));
        }

        return res.status(200).json({
            forum: insertedForum[0]
        });
    });
});

/**
 * Update info of a forum
 */
forumRouter.put('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const { name, description, image, parent, category } = req.body;
    const { id } = req.params;
    if(!name && !description && !image && (parent === undefined)) {
        return next(new HttpException(400, 'You must edit something'));
    }
    if(isNaN(id as any)) {
        return next(new HttpException(400, 'Id must be integer'));
    }
    db.task(async t=> {
        const forumExistence = (await t.query('SELECT id FROM forums WHERE id=$1',[id]).catch((err:any)=>{return []})).length > 0;
        if(!forumExistence) {
            return next(new HttpException(400, 'Invalid id'));
        }

        let query = 'UPDATE forums SET';
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

        if ( parent !== undefined ) {
            if (parent !== null && parent !== 'null' && isNaN(parent as any)) {
                return next(new HttpException(400, 'Parent id must be integer'));
            }
            if(parent !== null && parent !== 'null') {
                const parentExistence = (await t.query('SELECT id FROM forums WHERE id=$1',[parent]).catch((err:any)=>{return []})).length > 0;
                if (!parentExistence) {
                    return next(new HttpException(400, 'Invalid parent forum id'));
                }
            }
            if ( params.length > 0) {
                query += ',';
            }
            params.push(parent===null || parent==='null'? null : parent);
            query += ` parent_forum=$${params.length}`;
        }

        if ( category !== undefined ) {
            if (isNaN(category as any)) {
                return next(new HttpException(400, 'Category id must be integer'));
            }

            const categoryExistence = (await t.query('SELECT id FROM categories WHERE id=$1',[category]).catch((err:any)=>{return []})).length > 0;
            if (!categoryExistence) {
                return next(new HttpException(400, 'Invalid category id'));
            }

            if ( params.length > 0) {
                query += ',';
            }
            params.push(category);
            query += ` category=$${params.length}`;
        }

        // Params will always be greater than 1, so just add the ','
        params.push(id);
        query += `, updated_at=now() WHERE id=$${params.length} RETURNING *`;

        await t.query(query, params)
            .then((forumResult: any) => {
                return res.status(200).json({
                    success: true,
                    forum: forumResult[0]
                })
            })
            .catch((err: any) => {
                console.log(err);
                return next(new HttpException(500, 'Internal server error while updating forum'));
            });

    });
});

/**
 * Deletes a forum and its children
 */
forumRouter.delete('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (isNaN(id as any)) {
        return next(new HttpException(400, 'Id must be integer'));
    }

    db.task(async t => {
        const forumExistence = (await t.query('SELECT id FROM forums WHERE id=$1',[id]).catch((err:any)=>{return []})).length > 0;
        if(!forumExistence) {
            return next(new HttpException(400, 'Invalid id'));
        }
        await t.query('DELETE FROM forums WHERE id=$1', [id])
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

export default forumRouter;
