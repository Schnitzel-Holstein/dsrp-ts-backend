// Server
import Server from './classes/server';

// Routes
//import userRoutes from './routes/user.route';

import bodyParser from 'body-parser';
import cors from 'cors';
import Morgan from 'morgan';
import errorMiddleware from './middlewares/error.middleware';
import HttpException from './exceptions/HttpException';
import config = require('./config');

const server = new Server(config.http.port);

// Load user info
//server.app.use(userRequestInfo);

// Body parser
server.app.use(bodyParser.urlencoded({extended:true}));
server.app.use(bodyParser.json());

// Morgan
server.app.use(Morgan('dev'))

// Configure CORS
server.app.use(cors({origin: true, credentials: true}));

// Routes
//server.app.use('/user', userRoutes);


// catch 404 and forward to error handler
server.app.use((req, res, next) => {
	next(new HttpException(404, 'page not found'));
});

// Error handler
server.app.use(errorMiddleware);


server.start(()=>{console.log(`Server running on port ${server.port}`)});
