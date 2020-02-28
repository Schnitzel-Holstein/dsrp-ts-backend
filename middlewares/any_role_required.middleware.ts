import { Response, NextFunction } from "express";
import Token from "../classes/token";
import { IUserRequest } from "../declarations/request_user";
import { UserToken } from "../interfaces/user_token.interface";
import { db } from "../lib/database";
import { hasAnyOfTheseRoles } from "../lib/user_utils";

/**
 * Check that there's an user token in the headers and that has required permissions
 * @param roles 
 */
function anyRoleRequired(roles: string | string[]) {
    // If we receive a string, transform it into an string array
    if(typeof(roles) === "string") {
        let role = roles;
        roles = [];
        roles.push(role);
    }

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

                    const hasAny = await hasAnyOfTheseRoles(decoded.id, roles);
                    if(!hasAny){
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