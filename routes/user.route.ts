import { Router, Request, Response, NextFunction } from "express";
import bcrypt, { hash } from 'bcrypt';
import Token from "../classes/token";
import HttpException from "../exceptions/HttpException";
import { IUserRequest } from "../declarations/request_user";
import { db } from "../lib/database";
import loginRequired from "../middlewares/login_required.middleware";
import roleRequired from "../middlewares/role_required.middleware";
import { buildPagination } from "../lib/utils";
import userRequestInfo from "../middlewares/user_info.middleware";


const userRoutes = Router();


userRoutes.post('/login', (req: Request, res: Response, next: NextFunction) => {

    const { body } = req;
    // Email and password are required
    if(!body.email || !body.password) {
        return next(new HttpException(400, 'Email and password are required'));
    }

    db.task(async t => {
        const userDetailsSearch = await t.query('SELECT * FROM users WHERE email=$1', [body.email]);
        if(userDetailsSearch.length === 0) {
            return next(new HttpException(400, 'Invalid credentials'));
        }
        const userDetails = userDetailsSearch[0];
        const samePassword = await bcrypt.compare(body.password, userDetails.password);
        if(!samePassword) {
            return next(new HttpException(400, 'Invalid credentials'));
        }
        let caducity = '1d';
        if(body.rememberMe) {
            // For centuries 🎵
            caducity = '30d';
        }
        const userToken = Token.getJWTToken({id: userDetails.id}, caducity);

        // Expires in 30 days
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + (body.rememberMe? 30 : 1));
        return res.status(200).json({
            token: userToken,
            expiresAt: expDate
        });

    });
});

/**
 * User registration
 */
userRoutes.post('/register', (req: Request, res: Response, next: NextFunction) => {
    const { body } = req;
    const { username, email, password} = body;
    if(!email || !password || !username) {
        return next(new HttpException(400, 'Username, email and password are required'));
    }
    

    db.task(async t => {
        // Check user existence
        const emailExistence = (await t.query('SELECT id FROM users WHERE email=$1', [body.email])).length > 0;
        const usernameExistence = (await t.query('SELECT id FROM users WHERE username=$1', [body.username])).length > 0;
        if (emailExistence) {
            return next(new HttpException(400, 'Email already exists'));
        }
        else if (usernameExistence) {
            return next(new HttpException(400, 'Username already exists'));
        }

        // Create the user
        const hashedPassword = await bcrypt.hash(password, 10);
        const userQuery = await t.query(
            'INSERT INTO users(username, email, password) VALUES($1,$2,$3) RETURNING id',
            [username, email, hashedPassword]
        );
        const createdUser = userQuery[0];
        console.log(`Created user ${JSON.stringify(createdUser)}`);
        const userToken = Token.getJWTToken({id: createdUser.id}, '1d');
        

        // Expires in 30 days
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + 30);
        return res.status(200).json({
            token: userToken,
            expiresAt: expDate
        });
    });
    
});

/**
 * Get current user info
 */
userRoutes.get('/me', userRequestInfo, (req: IUserRequest, res: Response, next: NextFunction) => {
    if(!req.user) {
        return res.status(200).json({
            user: null
        });
    }
    db.task(async t => {
        const userInfo = await t.query('SELECT id, username, email, avatar_url, created_at, updated_at FROM users WHERE id=$1', [req.user?.id]);
        return res.status(200).json({
            user: userInfo[0] || null
        });
    });
});

userRoutes.get('/:id', loginRequired, (req: IUserRequest, res:Response, next: NextFunction) => {
    db.task(async t => {
        const userInfo = (await t.query('SELECT id, username, email, avatar_url, created_at, updated_at FROM users WHERE id=$1', [req.params.id]).catch((err:any)=>{return []}));
        return res.status(200).json({
            user: userInfo[0] || null
        });
    });
});



/**
 * Get List of users
 */
userRoutes.get('/', loginRequired, (req: IUserRequest, res: Response, next: NextFunction) => {
    const {page, limit} = buildPagination(req);

    db.task(async t => {
        const query = 'SELECT id, username, email, avatar_url, created_at, updated_at FROM users GROUP BY id ORDER BY id ASC LIMIT $1 OFFSET $2';
        const queryCount = 'SELECT count(id) FROM users';
        const total = (await t.query(queryCount))[0].count;
        const results = await t.query(query, [limit, (page-1)*limit]);

        return res.status(200).json({
            total,
            users: results         
        })
    });
});

/**
 * Update user info
 */
userRoutes.put('/:id', loginRequired, (req: IUserRequest, res: Response, next: NextFunction) => {
    if(!req.user) {
        return next(new HttpException(401, 'You can\'t do that'));
    }
    return next(new HttpException(501, 'Not yet'));
});

/**
 * Change user avatar
 */
userRoutes.post('/avatar', loginRequired, (req: IUserRequest, res: Response, next: NextFunction) => {
    if(!req.user) {
        return next(new HttpException(401, 'You can\'t do that'));
    }
    return next(new HttpException(501, 'Not yet'));
});


export default userRoutes;
