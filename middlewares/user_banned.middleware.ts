import { Request, Response, NextFunction } from "express";
import Token from "../classes/token";
import { IUserRequest } from "../declarations/request_user";
import { db } from '../lib/database';
import { UserToken } from "../interfaces/user_token.interface";

function userBannedMiddleware(req: IUserRequest, res: Response, next: NextFunction) {
    const token = req.get('x-token') || '';

    Token.checkToken( token )
        .then((decoded: UserToken) => {
            db.task(async t=> {
                const rightNow = new Date();
                const userDetails = await t.query('SELECT banned_until FROM users WHERE id=$1', [decoded.id]);
                if(userDetails[0] && userDetails[0].banned_until) {
                    let bannedUntil = typeof(userDetails[0].banned_until) === 'string' ? new Date(userDetails[0].banned_until) : userDetails[0].banned_until;
                    if(rightNow > bannedUntil) {
                        // Keep going, criminal
                        next();
                    }
                    else {
                        // You have no power here
                        return res.status(403).json({
                            code: 403,
                            description: `Banned until ${bannedUntil}`
                        });
                    }
                }
                else {
                    next();
                }
            })
            
        })
        .catch((err) => {
            next();
        })
};

export default userBannedMiddleware;