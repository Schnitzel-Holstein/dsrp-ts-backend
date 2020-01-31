import * as path from 'path';
import crypto from 'crypto';

export = {
    // This will be overridden by `index.ts`.
    env: null,

    http: {
        port: 3000,

        // String that should be prepended to `req.path` to get the public path
        // of the requested resource.
        //
        // Useful when using a reverse proxy.
        pathPrefix: '',
    },
    postgres: {
        dbConfig: {
            host: null,
            port: '5432',
            user: null,
            password: null,
            database: null,
            min: 20,
            max: 100
        },
        initOptions: {
            error(err:any, e: any) {
                console.log(e.query)
            }
        }
    },
    logging: {
        root: path.join(__dirname, '..', 'logs'),
    }
};
