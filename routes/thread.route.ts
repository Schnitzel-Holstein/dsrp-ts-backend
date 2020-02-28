import { Router, Request, Response, NextFunction } from "express";
import HttpException from "../exceptions/HttpException";
import { IUserRequest } from "../declarations/request_user";
import { db } from "../lib/database";
import loginRequired from "../middlewares/login_required.middleware";
import roleRequired from "../middlewares/role_required.middleware";
import { buildPagination } from '../lib/utils';

const threadRouter = Router();

threadRouter.get('/', (req: IUserRequest, res: Response, next:NextFunction) => {
    const { page, limit } = buildPagination(req);
    const postId = req.query['post-id'];


    db.task(async t => {

        // TODO - Thread get permission

        /**|------------------|
         * | Formatted query |
         * |-----------------|
         * 
         * SELECT DISTINCT ON(t.id) t.*, 
                p.created_at AS last_post_date 
            FROM threads AS t 
                inner join (SELECT DISTINCT ON(parent_thread) * 
                            FROM   posts 
                            GROUP  BY id, 
                                        parent_thread 
                            ORDER  BY parent_thread, 
                                        created_at DESC) AS p 
                        ON t.id = p.parent_thread 
            ORDER  BY t.id, 
                    last_post_date DESC; 
         */
        
        let query = 'SELECT distinct on(t.id) t.*,p.created_at as last_post_date FROM threads AS t INNER JOIN (SELECT DISTINCT ON(parent_thread) * FROM posts GROUP BY id, parent_thread ORDER BY parent_thread, created_at DESC) AS p ON t.id = p.parent_thread';
        let queryCount = 'SELECT count(id) FROM threads';
        const params = [];

        if(postId && !isNaN(postId)) {
            params.push(postId);
            query += ' WHERE parent_forum=$1';
            queryCount += ' WHERE parent_forum=$1';
        }

        const total = (await t.query(queryCount, params))[0].count;

        query += ' ORDER BY t.id, last_post_date DESC';
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push((page-1)*limit);
        query += ` OFFSET $${params.length}`;

        const results = await t.query(query, params);

        return res.status(200).json({
            total,
            threads: results
        });
    });

});

/**
 * Get the last post of a thread
 * @param id <number> Id of the thread
 */
threadRouter.get('/last-post/:id', (req: IUserRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    db.task(async t=> {
        const validThread = (await t.query('SELECT id FROM threads WHERE id=$1', [id]).catch((err:any)=>{return []})).length > 0;
        if(!validThread) {
            return next(new HttpException(400, 'Invalid id'));
        }

        const totalPosts = (await t.query('SELECT count(id) FROM posts WHERE parent_thread=$1',[id]))[0].count;
        // Get the last post
        const lastPost = (await t.query('SELECT * FROM posts WHERE parent_thread=$1 ORDER BY created_at DESC LIMIT 1', [id]));

        return res.status(200).json({
            totalPosts,
            post: lastPost.length > 0? lastPost[0] : null
        });
    });
});

/**
 * Return the info o a thread
 */
threadRouter.get('/:id', (req: IUserRequest, res: Response, next:NextFunction) => {
    const { id } = req.params;

    db.task(async t=> {
        const threadSearch = await t.query('SELECT * FROM threads WHERE id=$1', [id]).catch((err:any)=>{return []});

        return res.status(200).json({
            thread: threadSearch.length > 0? threadSearch[0] : null
        });

    });
});



threadRouter.post('/', loginRequired, (req: IUserRequest, res: Response, next:NextFunction) => {

    const { parentForum, name, description, message } = req.body;

    if (!parentForum || !name || !message) {
        return next(new HttpException(400, 'Name, forum id and message are required'));
    }

    db.task(async t => {
        // Check forum existence
        const forumExistence = (await t.query('SELECT id FROM forums WHERE id=$1', [parentForum]).catch((err:any)=>{return []})).length > 0;
        if(!forumExistence) {
            return next(new HttpException(400, 'Invalid forum id'));
        }

        // Create thread
        const createThreadQuery = await t.query(
            'INSERT INTO threads(name,description,parent_forum,created_by) VALUES($1,$2,$3,$4) RETURNING *',
            [name,description,parentForum,req.user?.id]
            ).catch((err:any)=>{return []});

        if(createThreadQuery.length === 0) {
            return next(new HttpException(500, 'Error creating thread'));
        }
        const createdThread = createThreadQuery[0];

        // Try to create post to that thread
        const createPostQuery = await t.query(
            'INSERT INTO posts(content,created_by,parent_thread) VALUES($1,$2,$3) returning *',
            [message, req.user?.id, createdThread.id]
            ).catch((err:any)=>{return []});

        if(createPostQuery.length === 0) {
            // Error creating the post, delete the thread
            await t.query('DELETE FROM threads WHERE id=$1',[createdThread.id]);

            return next(new HttpException(500, 'Error creating thread'));
        }
        const createdPost = createPostQuery[0];

        // All gud, return those things
        return res.status(200).json({
            thread: createdThread,
            post: createdPost
        });
    });
});

threadRouter.post('/status/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next:NextFunction) => {
    const { id } = req.params;
    if (!id || isNaN(id as any)) {
        return next(new HttpException(400, 'An integer id is necessary'));
    }

    db.task(async t=> {
        const threadSearch = await t.query('SELECT * FROM threads WHERE id=$1', [id]);
        if(threadSearch.length === 0) {
            return next(new HttpException(400, 'Invalid thread id'));
        }

        // Update it
        await t.query('UPDATE threads set is_closed = not is_closed WHERE id=$1', [id]);

        return res.status(200).json({
            success: true
        });

    });
});

threadRouter.put('/:id', loginRequired, (req: IUserRequest, res: Response, next:NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const { name, description, parentForum, isPinned, globalPin } = req.body;

    if (!id || isNaN(id as any)) {
        return next(new HttpException(400, 'An integer id is necessary'));
    }

    if (!name && !description && !parentForum && typeof(isPinned) === 'undefined' && typeof(globalPin) === 'undefined') {
        return next(new HttpException(400, 'You must edit something'));
    }

    return next(new HttpException(501, 'Not yet'));
});

threadRouter.delete('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next:NextFunction) => {
    const { id } = req.params;
    if (!id || isNaN(id as any)) {
        return next(new HttpException(400, 'An integer id is necessary'));
    }


    db.task(async t=> {
        const threadSearch = (await t.query('SELECT id FROM threads WHERE id=$1', [id]).catch((err:any)=>{return []}));
        if(threadSearch.length === 0) {
            return next(new HttpException(400, 'Invalid id'));
        }

        await t.query('DELETE FROM threads WHERE id=$1', [id])
            .then(() => {
                return res.status(200).json({
                    success: true
                });
            })
            .catch((err: any) => {
                return next(new HttpException(500, 'Error deleting thread'))
            })
    });
});

export default threadRouter;