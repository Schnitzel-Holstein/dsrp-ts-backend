# dsrp-ts-backend

## Basic config

Clone the repository, then
```
cp config/development.example.ts config/development.ts
```
(or production)
After that, fill the file with the proper config, then run `tsc`.

## Migrations
To create a new migration, run
```
npm run create-migration -- --name="name of the migration"
```
or just go to `migrations` folder and run `node create_migration.js --name="name of the migration"`, the `name` flag is optional, but recommended.

To run all of them, run
```
npm run run-migrations
```
Or inside `migrations` folder, run `node run_migrations.js`
You need to have the config files generated inside `/dist`.