import { Response, NextFunction } from "express";
import Token from "../classes/token";
import { IUserRequest } from "../declarations/request_user";
import { UserToken } from "../interfaces/user_token.interface";
import { db } from "../lib/database";
import { hasAllRoles } from "../lib/user_utils";

/**
 * Check that there's an user token in the headers and that has required permissions
 * @param roles 
 */
function roleRequired(roles: string | string[]) {

    return function(req: IUserRequest, res: Response, next: NextFunction) {
        const token = req.get('x-token') || '';

        Token.checkToken( token )
            .then((decoded: UserToken) => {
                db.task(async t => {
                    const userDetails = await t.query('SELECT * FROM users WHERE id=$1', [decoded.id]);
                    if (!userDetails) {
                        // User no longer exists
                        return res.status(401).json({code: 401, description: 'You can\'t do that'});
                    }

                    
                    const hasAll = await hasAllRoles(decoded.id, roles);
                    if(!hasAll){
                        return res.status(403).json({code: 403, description: 'You can\'t do that'});
                    }
                    req.user = decoded;
                    next();
                });
            })
            .catch((err) => {
                return res.status(401).json({code: 401, description: 'You can\'t do that'});
            });
    }
    
};

export default roleRequired;