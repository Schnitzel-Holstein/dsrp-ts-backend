import { Router, Request, Response, NextFunction } from "express";
import HttpException from "../exceptions/HttpException";
import { IUserRequest } from "../declarations/request_user";
import { db } from "../lib/database";
import loginRequired from "../middlewares/login_required.middleware";
import roleRequired from "../middlewares/role_required.middleware";
import { buildPagination } from '../lib/utils';

const userExtraFieldRouter = Router();

/**
 * Get extra fields
 */
userExtraFieldRouter.get('/', (req: IUserRequest, res: Response, next: NextFunction) => {
    const { limit, page } = buildPagination(req);
    db.task(async t => {
        const results = await t.query('SELECT * FROM user_extra_fields LIMIT $1 OFFSET $2', [limit, (page-1)*limit]);
        const totalResults = (await t.query('SELECT count(id) FROM user_extra_fields'))[0].count;
        return res.status(200).json({
            total: totalResults,
            fields: results
        });
    })
});

/**
 * Get the values associated to users
 */
userExtraFieldRouter.get('/values', (req: IUserRequest, res: Response, next: NextFunction) => {
    const { limit, page } = buildPagination(req);
    const userId = req.query['user'];
    const fieldId = req.query['field'];

    // SELECT fields.username, fields.name, fields.description, fields.user_can_edit, fields.show_on_profile, fields.show_on_post, fields.created_at, fields.updated_at, coalesce(values.extra_field_value, fields.default_value) AS value FROM (select t1.username, t1.id as user_id, t2.* FROM users AS t1 FULL OUTER JOIN user_extra_fields AS t2 ON 1=1) AS fields LEFT JOIN user_extra_field_values AS values ON fields.id = values.extra_field_id AND fields.user_id=values.user_id;
    /**
     * SELECT
        fields.username, 
        fields.name, 
        fields.description, 
        fields.user_can_edit, 
        fields.show_on_profile, 
        fields.show_on_post, 
        fields.created_at, 
        fields.updated_at,
        fields.user_id
        Coalesce(values.extra_field_value, fields.default_value) AS value 
        FROM   (SELECT t1.username, 
                t1.id AS user_id, 
                t2.* 
            FROM   users AS t1 
                FULL OUTER JOIN user_extra_fields AS t2 
                                ON 1 = 1) AS fields 
        LEFT JOIN user_extra_field_values AS VALUES 
                ON fields.id = values.extra_field_id 
                    AND fields.user_id = values.user_id;
    */
    const params:any = [];
    let query = 'SELECT fields.user_id,fields.username, fields.name, fields.description, fields.user_can_edit, fields.show_on_profile, fields.show_on_post, fields.created_at, fields.updated_at, coalesce(values.extra_field_value, fields.default_value) AS value FROM (select t1.username, t1.id as user_id, t2.* FROM users AS t1 FULL OUTER JOIN user_extra_fields AS t2 ON 1=1) AS fields LEFT JOIN user_extra_field_values AS values ON fields.id = values.extra_field_id AND fields.user_id=values.user_id';
    let queryCount = 'SELECT count(*) FROM (select t1.username, t1.id as user_id, t2.* FROM users AS t1 FULL OUTER JOIN user_extra_fields AS t2 ON 1=1) AS fields LEFT JOIN user_extra_field_values AS values ON fields.id = values.extra_field_id AND fields.user_id=values.user_id';

    if(userId && !isNaN(userId as any)) {
        query += ` WHERE fields.user_id=$1`;
        queryCount += ` WHERE fields.user_id=$1`;
        params.push(userId);
    }
    if(fieldId && !isNaN(fieldId as any)) {
        if(params.length > 0) {
            query += ' AND';
            queryCount += ' AND';
        }
        else {
            query += ' WHERE';
            queryCount += ' WHERE';
        }
        params.push(fieldId);
        query += ` fields.id=$${params.length}`;
        queryCount += ` fields.id=$${params.length}`;
    }

    db.task(async t => {
        const totalResults = (await t.query(queryCount, params))[0].count;
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push((page-1)*limit);
        query += ` OFFSET $${params.length}`;
        const results = await t.query(query, params);
        return res.json({
            total: totalResults,
            fields: results
        });
    });
});

/**
 * Get the details of a field
 */
userExtraFieldRouter.get('/:id', (req: IUserRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    db.task(async t => {
        const fieldSearch = await t.query('SELECT * FROM user_extra_fields WHERE id=$1', [id]);
        if(fieldSearch.length === 0) {
            return next(new HttpException(400, 'Invalid id'));
        }
        const field = fieldSearch[0];
        return res.status(200).json({field});
    });
});

/**
 * Create a new field
 * @param name <string> Name of the field
 * @param description <string> a brief description of the field
 * @param defaultValue <string> the default value of that field
 */
userExtraFieldRouter.post('/', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {

    if(!req.user) {
        return next(new HttpException(400, 'You can\'t do that'));
    }

    const {name, description, defaultValue} = req.body;
    if(!name) {
        return next(new HttpException(400, 'Name is required'));
    }

    db.task(async t=> {
        const nameExists = (await t.query("SELECT id FROM user_extra_fields WHERE name=$1", [name])).length > 0;
        if(nameExists) {
            return next(new HttpException(400, 'Name already exists'));
        }
        const createdField = await t.query('INSERT INTO user_extra_Fields(name, description, default_value) VALUES($1,$2,$3) RETURNING *', [name, description, defaultValue]);
        return res.status(200).json({
            field: createdField[0]
        })
    });
});

/**
 * Set the value of a field to a new user
 * @param fieldId <Number> Id of the field to set
 * @param userId <Number> Id of the user to assign the value. If none is passed, it'll be used the one inside the token
 * @param value <string> New value for the param
 */
userExtraFieldRouter.post('/values', loginRequired, (req: IUserRequest, res: Response, next: NextFunction) => {
    if(!req.user) {
        return next(new HttpException(401, 'You can\'t do that'));
    }
    const userId = req.body.userId || req.user.id;
    const { fieldId } = req.body;
    const { value } = req.body;

    if(!userId || !fieldId || !value)  {
        return next(new HttpException(400, 'Missing parameters'));
    }

    db.task(async t => {
        const fieldExistence = (await t.query('SELECT id FROM user_extra_fields WHERE id=$1', [fieldId]).catch((err:any)=>{return []})).length > 0;
        if(!fieldExistence) {
            return next(new HttpException(400, 'Invalid field id'));
        }

        // TODO - Check if field exists and if the user can edit it 

        const valueExists = (await t.query('SELECT * FROM user_extra_field_values WHERE user_id=$1 AND extra_field_id=$2', [userId, fieldId])).length > 0;
        let query = '';
        if (valueExists) {
            // Update the value
            query = 'UPDATE user_extra_field_values SET extra_field_value=$1 WHERE extra_field_id=$2 AND user_id=$3';
        }
        else {
            // Insert it
            query = 'INSERT INTO user_extra_field_Values(extra_field_value, extra_field_id, user_id) VALUES($1,$2,$3)';
        }
        await t.query(query, [value, fieldId, userId]);

        return res.status(200).json({
            success: true
        });
    });
});

/**
 * Change either field name, description or "show"/"allow to edit" values
 */
userExtraFieldRouter.put('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    if(!req.user) {
        return next(new HttpException(401, 'You can\'t do that'));
    }

    const {
        name,
        description,
        defaultValue,
        userCanEdit,
        showOnprofile,
        showOnPost
    } = req.body;
    if(!name && !description && typeof(defaultValue) === undefined && typeof(userCanEdit) !== 'boolean' && typeof(showOnprofile) !== 'boolean' && typeof(showOnPost) !== 'boolean') {
        return next(new HttpException(400, 'You must edit something'));
    }

    // Helper function
    const pushToArray = (arr:any[], value:any, name:string):string => {
        arr.push(value);
        if(arr.length === 1) {
            return ` ${name}=${arr.length}`;
        }
        else {
            return `, ${name}=${arr.length}`;
        }   
    }

    db.task(async t=> {
        const fieldSearch = await t.query('SELECT id FROM user_extra_fields WHERE id=$1', [req.params.id])
            .catch((err:any) => {
                return [];
            });
        if(fieldSearch.length === 0) {
            return next(new HttpException(400, 'Invalid id'));
        }
        let query = 'UPDATE user_extra_fields SET';
        let params:any[] = [];
        if(name) {
            query += pushToArray(params, name, 'name');
        }
        if(description) {
            query += pushToArray(params, description, 'description');
        }
        if(defaultValue) {
            query += pushToArray(params, defaultValue, 'default_value');
        }
        if(typeof(userCanEdit) === 'boolean') {
            query += pushToArray(params, userCanEdit, 'user_can_edit');
        }
        if(typeof(showOnprofile) === 'boolean') {
            query += pushToArray(params, showOnprofile, 'show_on_profile');
        }
        if(typeof(showOnPost) === 'boolean') {
            query += pushToArray(params, showOnPost, 'show_on_post');
        }

        // Set the "updated now" field
        query += `, updated_at=now()`;
        // Update only that one
        params.push(req.params.id);
        query += ` WHERE id=$${params.length}`;

        await t.query(query, params);

        return res.status(200).json({
            success: true
        });
    });
});

/**
 * Delete an extra field
 */
userExtraFieldRouter.delete('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    if(!req.user) {
        return next(new HttpException(401, 'You can\'t do that'));
    }
    db.task(async t=> {
        const fieldSearch = await t.query('SELECT id FROM user_extra_fields WHERE id=$1', [req.params.id])
            .catch((err:any) => {
                return [];
            });
        if(fieldSearch.length === 0) {
            return next(new HttpException(400, 'Invalid id'));
        }

        await t.query('DELETE FROM user_extra_fields WHERE id=$1', [req.params.id])
            .then((res:any) => {
                return res.status(200).json({
                    success: true
                });
            })
            .catch((err:any) => {
                return next(new HttpException(500, 'Error deleting field'));
            })
    })
});

export default userExtraFieldRouter;
