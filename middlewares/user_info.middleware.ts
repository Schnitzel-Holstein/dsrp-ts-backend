import { Request, Response, NextFunction } from "express";
import Token from "../classes/token";
import { IUserRequest } from "../declarations/request_user";
import { UserToken } from "../interfaces/user_token.interface";

function userRequestInfo(req: IUserRequest, res: Response, next: NextFunction) {
    const token = req.get('x-token') || '';

    Token.checkToken( token )
        .then((decoded: UserToken) => {
            req.user = decoded;
            next();
        })
        .catch((err) => {
            req.user = undefined;
            next();
        })
};

export default userRequestInfo;