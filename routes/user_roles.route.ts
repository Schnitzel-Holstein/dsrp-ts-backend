import { Router, Request, Response, NextFunction } from "express";
import HttpException from "../exceptions/HttpException";
import { IUserRequest } from "../declarations/request_user";
import { db } from "../lib/database";
import roleRequired from "../middlewares/role_required.middleware";
import { buildPagination } from '../lib/utils';

const forbiddenRoles = ['user', 'admin'];

const userRolesRouter = Router();

userRolesRouter.get('/', (req: IUserRequest, res: Response, next: NextFunction) => {
    
    const { page, limit } = buildPagination(req);
    const { type } = req.query;

    db.task(async t=> {
        let query = 'SELECT * FROM user_roles';
        let queryCount = 'SELECT count(id) FROM user_roles';
        let params = [];

        if(type) {
            query += ' WHERE type=$1';
            queryCount += ' WHERE type=$1';
            params.push(type);
        }

        const totalResults = (await t.query(queryCount, params))[0].count;
        
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push((page-1)*limit);
        query += ` OFFSET $${params.length}`;
        const results = await t.query(query,params);
        

        return res.status(200).json({
            total: totalResults,
            roles: results
        });
    });
});

/**
 * Get the list of valid role types
 */
userRolesRouter.get('/types', (req: IUserRequest, res: Response, next: NextFunction) => {
    const { page, limit } = buildPagination(req);
    db.task(async t => {
        const results = await t.query('SELECT * FROM valid_role_types LIMIT $1 OFFSET $2', [limit, (page-1)*limit]);
        const totalResults = (await t.query('SELECT count(*) FROM valid_role_types'))[0].count;
        return res.status(200).json({
            total: totalResults,
            roleTypes: results
        });
    })
});

/**
 * Get a list of assigned roles to users
 * @param userid Optional <Number> Id of the user to filter
 * @param roleType Optional <Text> Name of role type to filter (default "general", "faction" or "rank")
 */
userRolesRouter.get('/assigned', (req: IUserRequest, res: Response, next: NextFunction) => {

    const { page, limit } = buildPagination(req);
    db.task(async t=> {
        let query = 'SELECT roles.id, roles.name, assigned.user_id, roles.type FROM user_roles_inventory AS assigned INNER JOIN user_roles AS roles ON assigned.role_id=roles.id';
        let queryCount = 'SELECT count(*) FROM user_roles_inventory AS assigned INNER JOIN user_roles AS roles ON assigned.role_id=roles.id';
        let params = [];

        if (req.query['user-id'] && !isNaN(req.query['user-id'] as any)) {
            params.push(req.query['user-id']);
            query += ` WHERE assigned.user_id=$${params.length}`;
            queryCount += ` WHERE assigned.user_id=$${params.length}`;
        }

        if (req.query['role-type']) {
            if (params.length === 0) {
                query += ' WHERE';
                queryCount += ' WHERE';
            }
            else {
                query += ' AND';
                queryCount += ' AND';
            }
            params.push(req.query['role-type']);
            query += ` roles.type=$${params.length}`;
            queryCount += ` roles.type=$${params.length}`;
        }

        const total = (await t.query(queryCount, params))[0].count;
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push((page-1)*limit);
        query += ` OFFSET $${params.length}`;
        const results = (await t.query(query, params));

        return res.status(200).json({
            roles:results,
            total
        });
    });
});

/**
 * Get an user role, searching by its id
 * @param <Number> id
 */
userRolesRouter.get('/:id', (req: IUserRequest, res: Response, next: NextFunction) => {
    db.task(async t=> {
        // Gimme a valid id. I Dare you, i double dare you
        const roleSearch = await t.query('SELECT * FROM user_roles WHERE id=$1', [req.params.id])
            .catch((err:any) => {
                return [];
            });
        if(roleSearch.length === 0) {
            return next(new HttpException(400, 'Invalid id'));
        }
        return res.status(200).json({
            role: roleSearch[0]
        });
    });
});

/**
 * Creates a new role
 * @param Name <string> Name of the role. Must be unique
 * @param Color <string> Color of the role
 * @param Image <string> URL of the image to display (if any)
 * @param type <string> Role type (by default general, faction, rank)
 */
userRolesRouter.post('/', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const {name, color, image, type} = req.body;
    if(!name || !type) {
        return next(new HttpException(400, 'Name and type are required'));
    }
    
    db.task(async t=> {
        const validTypes = (await t.query('SELECT name FROM valid_role_types')).map((r:any) => r.name);
        if (!validTypes.includes(type)) {
            return next(new HttpException(400, 'Invalid role type'));
        }

        // Two roles with the same name? Are you crazy?
        const nameExists = (await t.query('SELECT id FROM user_roles WHERE name=$1', [name])).length > 0;
        if(nameExists) {
            return next(new HttpException(400, 'Name already exists'));
        }
        const createdRole = await t.query('INSERT INTO user_roles(name, color, type, image) VALUES($1,$2,$3,$4) RETURNING *', [name, color, type, image]);

        return res.status(200).json({
            success:true,
            role: createdRole[0]
        });
    });
});

/**
 * Assigns a new role to a user
 * @param userId <Number> Id of the user to assign the role
 * @param roleId <Number> Id of the role to assign to the user
 */
userRolesRouter.post('/assigned', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const {userId, roleId} = req.body;

    // We only want numbers here
    if(isNaN(userId as any) || isNaN(roleId as any)){
        return next(new HttpException(400, 'Userid And roleId must be integers'));
    }

    db.task(async t => {
        //Is it even assigned to anyone?
        const alreadyAssigned = (await t.query("SELECT * FROM user_roles_inventory WHERE user_id=$1 AND role_id=$2", [userId, roleId]).catch((err:any)=>{return []})).length > 0;
        if(alreadyAssigned) {
            return next(new HttpException(400, 'Role is already assigned'));
        }

        await t.query('INSERT INTO user_roles_inventory(user_id, role_id) VALUES($1,$2)', [userId, roleId])
            .then(()=> {
                return res.status(200).json({
                    success: true
                });
            })
            .catch((err:any) => {
                return next(new HttpException(500, 'Error doing role assignment'));
            })
    });
});

/**
 * Edits a role info
 */
userRolesRouter.put('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const { name, image, color, type } = req.body;
    if(!name && !image && !color && !type) {
        return next(new HttpException(400, 'You must edit shomething'));
    }
    if(isNaN(req.params.id as any)) {
        return next(new HttpException(400, 'Id must be integer'));
    }
    db.task(async t => {
        // Check if it's a valid id
        const validRole = (await db.query('SELECT id FROM user_roles WHERE id=$1', [req.params.id]).catch((err)=>{return []})).length > 0;
        if(!validRole) {
            return next(new HttpException(400, 'Invalid id'));
        }

        // Build the query
        let query = 'UPDATE user_roles SET';
        let params = [];
        // Check every param and add them to the query
        if (name) {
            // Unique name
            const nameExists = (await t.query('SELECT id FROM user_roles WHERE name=$1', [name])).length > 0;
            if (nameExists) {
                return next(new HttpException(400, 'That name already exists'));
            }
            params.push(name);
            query += ` name=$${params.length}`;
        }

        if (image) {
            // No check here, we don't really care about the image
            if (params.length > 0) {
                query += ","
            }
            params.push(image);
            query += ` image=$${params.length}`;
        }

        if (color) {
            // No check here, we don't really care about the color
            if (params.length > 0) {
                query += ","
            }
            params.push(color);
            query += ` color=$${params.length}`;
        }

        if (type) {
            // Check role type
            const validTypes = (await t.query('SELECT name FROM valid_role_types')).map((r:any) => r.name);
            if (!validTypes.includes(type)) {
                return next(new HttpException(400, 'Invalid role type'));
            }
            if (params.length > 0) {
                query += ","
            }
            params.push(type);
            query += ` type=$${params.length}`;
        }

        params.push(req.params.id);
        query += ` ,updated_at=now() WHERE id=$${params.length}`;
        await t.query(query, params);
        return res.status(200).json({
            success: true
        });
    });
});

/**
 * Deletes an assigned role from an user
 * @param userId <Number> Id of the user to assign the role
 * @param roleId <Number> Id of the role to assign to the user
 */
userRolesRouter.delete('/assigned', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {
    const {userId, roleId} = req.body;

    if(isNaN(userId as any) || isNaN(roleId as any)){
        return next(new HttpException(400, 'Userid And roleId must be integers'));
    }
    db.task(async t => {
        //Is it even assigned to anyone?
        const alreadyAssigned = (await t.query("SELECT * FROM user_roles_inventory WHERE user_id=$1 AND role_id=$2", [userId, roleId]).catch((err:any)=>{return []})).length > 0;
        if(!alreadyAssigned) {
            return next(new HttpException(400, 'Role is not assigned'));
        }

        // Delete it
        await t.query('DELETE FROM user_roles_inventory WHERE user_id=$1 AND role_id=$2', [userId, roleId]);

        return res.status(200).json({
            success: true
        });
    });
    
});

/**
 * @param id <Number> Id of the role to delete
 */
userRolesRouter.delete('/:id', roleRequired('admin'), (req: IUserRequest, res: Response, next: NextFunction) => {

    const { id } = req.params;
    if(isNaN(id as any)) {
        return next(new HttpException(400, 'Id must be integer'));
    }
    db.task(async t=> {
        const roleSearch = await t.query('SELECT id,name FROM user_roles WHERE id=$1', [id]);
        // Does the role exists?
        const roleExists = roleSearch.length > 0;
        if(!roleExists) {
            return next(new HttpException(400, 'Invalid id'));
        }
        // Is it a "base" role?
        const roleName = roleSearch[0].name;
        if(forbiddenRoles.includes(roleName)) {
            return next(new HttpException(403, 'Stop right there criminal scum. You can\'t delete that role'));
        }

        // Ight' imma delete it now
        await t.query('DELETE FROM user_roles WHERE id=$1', [id]);
        return res.status(200).json({
            success: true
        });
    });

});


export default userRolesRouter;
