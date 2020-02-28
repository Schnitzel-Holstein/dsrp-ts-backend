export = {
    http: {
        port: 3000
    },
    postgres: {
        dbConfig: {
            host: 'localhost',
            port: '5432',
            user: 'user',
            password: 'password',
            database: 'the database',
            min: 20,
            max: 100
        },
        initOptions: {
            error(err:any, e:any) {
                console.log(`Error with query "${e.query}"`);
            }
        }
    },
    jwt: {
        key: 'A nice and strong key here',
        caducity: '30d'
    }

};
