import pgPromise from 'pg-promise';
const config = require('../config').postgres;
// @ts-ignore
const initOptions = config.initOptions;
// @ts-ignore
const configOptions = config.dbConfig;
const pgp: pgPromise.IMain = pgPromise(initOptions);
const db: pgPromise.IDatabase<any> = pgp(configOptions);


export {pgp, db}

