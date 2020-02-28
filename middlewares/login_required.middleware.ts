import { Request, Response, NextFunction } from "express";
import Token from "../classes/token";
import { IUserRequest } from "../declarations/request_user";
import { UserToken } from "../interfaces/user_token.interface";

function loginRequired(req: IUserRequest, res: Response, next: NextFunction) {
    const token = req.get('x-token') || '';

    Token.checkToken( token )
        .then((decoded: UserToken) => {
            req.user = decoded;
            next();
        })
        .catch((err) => {
            return res.json({
                code: 401,
                description: 'You can\'t do that'
            });
        })
};

export default loginRequired;