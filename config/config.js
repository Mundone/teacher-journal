// config/config.js
require("dotenv").config();

const isLocal = false;

const localConfig = {
  database: {
    username: process.env.LOCAL_DB_USERNAME,
    password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME,
    host: process.env.LOCAL_DB_HOST,
    dialect: "mysql",
    logging: false,
    timezone: "+08:00", // for writing to database
  },
  jwtSecret: process.env.LOCAL_JWT_SECRET,
};

const productionConfig = {
  database: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
    // dialectOptions: {
    //   ssl: {
    //     require: true,
    //     rejectUnauthorized: false,
    //   },
    // },
    timezone: "+08:00", // for writing to database
  },
  jwtSecret: process.env.JWT_SECRET,
};

const config = isLocal ? localConfig : productionConfig;
console.log(isLocal ? "local" : "production")

module.exports = config;
