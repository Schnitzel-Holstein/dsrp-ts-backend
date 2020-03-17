// Server
import Server from './classes/server';

// Dependencies
import bodyParser from 'body-parser';
import cors from 'cors';
import Morgan from 'morgan';
import config = require('./config');

// Exceptions
import HttpException from './exceptions/HttpException';

// Middlewares
import errorMiddleware from './middlewares/error.middleware';
import userBannedMiddleware from './middlewares/user_banned.middleware';

// Routes
import userRoutes from './routes/user.route';
import threadRouter from './routes/thread.route';
import postRouter from './routes/post.route';
import userRolesRouter from './routes/user_roles.route';
import userExtraFieldRouter from './routes/user_extra_field.route';
import forumRouter from './routes/forum.route';
import categoryRouter from './routes/category.route';


const server = new Server(config.http.port);

// Body parser
server.app.use(bodyParser.urlencoded({extended:true}));
server.app.use(bodyParser.json());

// Morgan
server.app.use(Morgan('dev'))

// Configure CORS
server.app.use(cors({origin: true, credentials: true}));

// If the user is banned, always return 403
server.app.use(userBannedMiddleware);

// Routes
server.app.use('/user', userRoutes);
server.app.use('/user-roles', userRolesRouter);
server.app.use('/user-fields', userExtraFieldRouter);
server.app.use('/categories', categoryRouter);
server.app.use('/forum', forumRouter);
server.app.use('/thread', threadRouter);
server.app.use('/post', postRouter);


// catch 404 and forward to error handler
server.app.use((req, res, next) => {
	next(new HttpException(404, 'page not found'));
});

// Error handler
server.app.use(errorMiddleware);


server.start(()=>{console.log(`Server running on port ${server.port}`)});
