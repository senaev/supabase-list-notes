export const SQL_SCHEMA_IMPORT_PROMISE: Promise<string> = import('../schema.sql?raw').then((module) => module.default);
