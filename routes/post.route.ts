import { Router, Request, Response, NextFunction } from "express";
import HttpException from "../exceptions/HttpException";
import { IUserRequest } from "../declarations/request_user";
import { db } from "../lib/database";
import loginRequired from "../middlewares/login_required.middleware";
import roleRequired from "../middlewares/role_required.middleware";
import { buildPagination } from '../lib/utils';
import { hasRole } from "../lib/user_utils";

const postRouter = Router();

/**
 * Get a list of posts
 * @param thread-id <number> Optional param to filter
 */
postRouter.get('/', (req: IUserRequest, res:Response, next: NextFunction) => {
    const { page, limit } = buildPagination(req);
    const threadId = req.query['thread-id'];

    db.task(async t => {
        // TODO - Post get permission
        let query = 'SELECT * FROM posts';
        let queryCount = 'SELECT count(id) FROM posts';
        const params = [];

        if(threadId && !isNaN(threadId)) {
            params.push(threadId);
            query += ' WHERE parent_thread=$1';
            queryCount += ' WHERE parent_thread=$1';
        }

        const total = (await t.query(queryCount, params))[0].count;

        query += ' ORDER BY created_at DESC';
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push((page-1)*limit);
        query += ` OFFSET $${params.length}`;

        const results = await t.query(query, params);

        return res.status(200).json({
            total,
            posts: results
        });
    });

});

/**
 * Get an specified post
 * @param id <number> Id of the post to retrieve
 */
postRouter.get('/:id', (req: IUserRequest, res:Response, next: NextFunction) => {
    const { id } = req.params;

    db.task(async t=> {
        const postSearch = await t.query('SELECT * FROM posts WHERE id=$1', [id]).catch((err:any)=>{return []});

        return res.status(200).json({
            post: postSearch.length > 0? postSearch[0] : null
        });

    });
});

/**
 * Creates a new thread, associated to the user sending the request
 * @param content <String> Content of the post
 * @param name <String> Name of the post (optional)
 * @param description <String> Description of the post (optional)
 * @param threadId <Number> Id of the thread of the post
 */
postRouter.post('/', loginRequired, (req: IUserRequest, res:Response, next: NextFunction) => {

    const { content, name, description, threadId } = req.body;

    if(!content || !threadId) {
        return next(new HttpException(400, 'Thread id and post content are required'));
    }
    if(isNaN(threadId as any)) {
        return next(new HttpException(400, 'Thread id must be integer'));
    }

    db.task(async t => {
        const threadSearch = await t.query('SELECT * FROM threads WHERE id=$1', [threadId]);
        if(threadSearch.length === 0) {
            return next(new HttpException(400, 'Invalid thread id'));
        }

        if(threadSearch[0].is_closed) {
            return next(new HttpException(403, 'Thread is closed'));
        }

        // Create the post
        await t.query(
            'INSERT INTO posts(name, description, content, parent_thread, created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',
            [name, description, content, threadId, req.user?.id]
        )
            .then((post: any)=>{
                return res.status(200).json({
                    post
                });
            })
            .catch((err:any) => {
                console.log(err);
                return next(new HttpException(500, 'Error creating post'));
            })

    });

});

/**
 * Edits the info of a thread
 * Id is mandatory. At least one of the other 3 is mandatory.
 * @param Id <Number> Id of the thread to edit
 * @param description <String> Description of the post
 * @param name <String> Name of the post
 * @param content <String> Content of the post
 */
postRouter.put('/:id', loginRequired, (req: IUserRequest, res:Response, next: NextFunction) => {
    // Check the id passed
    const { id } = req.params;
    if (!id || isNaN(id as any)) {
        return next(new HttpException(400, 'An integer id is necessary'));
    }

    // @ts-ignore
    const userId:number = req.user.id;
    const { name, description, content } = req.body;

    if (name === undefined && description === undefined && content === undefined) {
        return next(new HttpException(400, 'You must edit something'));
    }

    db.task(async t => {
        // TODO - Implement edit tracking
        const postSearch = await t.query('SELECT * FROM posts WHERE id=$1', [id]);
        if(postSearch.length === 0) {
            return next(new HttpException(400, 'Invalid id'));
        }
        
        const postInfo = postSearch[0];
        const threadSearch = await t.query('SELECT * FROM threads WHERE id=$1', [postInfo.parent_thread]);
        if(threadSearch[0].is_closed) {
            return next(new HttpException(401, 'Thread is closed'));
        }
        const hasAdminRole = await hasRole(userId, 'admin');
        if (!hasAdminRole && Number(postInfo.created_by) !== userId ) {
            // It's not admin and it's not who created this, so begone
            return next(new HttpException(403, 'You can\'t do that'));
        }
        let query = 'UPDATE posts SET';
        const params = [];

        // Add the params to the query, if they exists
        if (name) {
            params.push(name);
            query += ` name=$${params.length}`;
        }
        if (description) {
            if (params.length > 0) {
                query += ',';
            }
            params.push(description);
            query += ` description=$${params.length}`;
        }

        if (content) {
            if (params.length > 0) {
                query += ',';
            }
            params.push(content);
            query += ` content=$${params.length}`;
        }

        params.push(id);
        query += `, updated_at=now() WHERE id=$${params.length} RETURNING *`;
        await t.query(query, params)
            .then((postResult: any) => {
                return res.status(200).json({
                    success:true,
                    post: postResult[0]
                })
            })
            .catch((err: any) => {
                return next(new HttpException(500, 'Error updating post'));
            });

    });

});

/**
 * Deletes a post from a thread
 * @param id <Number> Id of the thread to delete
 */
postRouter.delete('/:id', roleRequired('admin'), (req: IUserRequest, res:Response, next: NextFunction) => {

    // Check the id passed
    const { id } = req.params;
    if (!id || isNaN(id as any)) {
        return next(new HttpException(400, 'An integer id is necessary'));
    }


    // Try to delete it
    db.task(async t=> {

        // Does it even exists?
        const postSearch = (await t.query('SELECT id FROM posts WHERE id=$1', [id]).catch((err:any)=>{return []}));
        if(postSearch.length === 0) {
            return next(new HttpException(400, 'Invalid id'));
        }

        await t.query('DELETE FROM posts WHERE id=$1', [id])
            .then(() => {
                return res.status(200).json({
                    success: true
                });
            })
            .catch((err: any) => {
                return next(new HttpException(500, 'Error deleting post'))
            })
    });

});

export default postRouter;