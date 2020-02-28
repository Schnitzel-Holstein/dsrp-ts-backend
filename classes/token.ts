import jwt from 'jsonwebtoken';
import config = require('../config');
import { UserToken } from '../interfaces/user_token.interface';

export default class Token {
    private static seed: string = config.jwt.key;
    private static caducity: string = config.jwt.caducity;

    static getJWTToken(payload: any, caducity?: string): string {
        return jwt.sign({
            user: payload
        }, this.seed, {expiresIn: caducity? caducity : this.caducity});
    }

    static checkToken(userToken: string): Promise<UserToken> {

        return new Promise((resolve, reject) => {
            jwt.verify(userToken, this.seed, (err: any, decoded: any) => {
                
                if(err) {
                    // Don't trust
                    reject();
                }
                else {
                    const user: UserToken = decoded.user;
                    resolve(user);
                }
            });
        });

    }
}