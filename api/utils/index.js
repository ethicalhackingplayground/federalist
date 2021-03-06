const fs = require('fs');
const path = require('path');
const moment = require('moment');

const config = require('../../config');
const { logger } = require('../../winston');

function filterEntity(res, name, field = 'name') {
  let errMsg = `Not found: Entity @${field} = ${name}`;
  const filtered = res.resources.filter(item => item.entity[field] === name);
  if (filtered.length === 0) {
    const error = new Error(errMsg);
    error.name = name;
    throw error;
  }
  if (name === 'basic-public') {
    const servicePlan = filtered.find(f => f.entity.unique_id === config.app.s3ServicePlanId);
    if (!servicePlan) {
      errMsg = `${errMsg} @basic-public service plan = (${config.app.s3ServicePlanId})`;
      const error = new Error(errMsg);
      error.name = name;
      throw error;
    }
    return servicePlan;
  }
  return filtered[0];
}

function firstEntity(res, name) {
  if (res.resources.length === 0) {
    const error = new Error('Not found');
    error.name = name;
    throw error;
  }

  return res.resources[0];
}

function generateS3ServiceName(owner, repository) {
  if (!owner || !repository) return undefined;

  const format = str => str
    .toString()
    .toLowerCase()
    .split(' ')
    .join('-');

  const serviceName = `o-${format(owner)}-r-${format(repository)}`;

  if (serviceName.length < 47) {
    return serviceName;
  }

  function makeId() {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < 6; i += 1) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  const slicedServiceName = `${serviceName.slice(0, 39)}-${makeId()}`;
  return slicedServiceName;
}

function isPastAuthThreshold(authDate) {
  return moment().isAfter(
    moment(authDate).add(config.policies.authRevalidationMinutes, 'minutes')
  );
}

function getDirectoryFiles(dir, existingFileList) {
  let fileList = existingFileList || [];
  fs.readdirSync(dir).forEach((file) => {
    fileList = fs.statSync(path.join(dir, file)).isDirectory()
      ? getDirectoryFiles(path.join(dir, file), fileList)
      : fileList.concat(path.join(dir, file));
  });
  return fileList;
}

function loadDevelopmentManifest() {
  const webpackConfig = require('../../webpack.development.config.js'); // eslint-disable-line global-require
  const { filename: jsFilename, publicPath } = webpackConfig.output;

  // This requires that MiniCssExtractPlugin be the first plugin in the
  // development configuration!!!!!
  const cssFilename = webpackConfig.plugins[0].options.filename;

  return {
    'main.js': publicPath.slice(1) + jsFilename,
    'main.css': publicPath.slice(1) + cssFilename,
  };
}

function loadProductionManifest() {
  const manifestFile = 'webpack-manifest.json';
  if (!fs.existsSync(manifestFile)) {
    const msg = 'webpack-manifest.json does not exist. Have you run webpack (`yarn build`)?';
    logger.error(msg);
    throw new Error(msg);
  }
  return JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
}

function loadAssetManifest() {
  return process.env.NODE_ENV === 'development'
    ? loadDevelopmentManifest() : loadProductionManifest();
}

function getSiteDisplayEnv() {
  if (config.app.app_env !== 'production') {
    return config.app.app_env;
  }
  return null;
}

function shouldIncludeTracking() {
  return config.app.app_env === 'production';
}

function mapValues(fn, obj) {
  const reducer = (acc, key) => {
    acc[key] = fn(obj[key]);
    return acc;
  };
  return Object.keys(obj).reduce(reducer, {});
}

function wrapHandler(fn) {
  return (...args) => fn(...args).catch(args[1].error);
  // We really want to just call `next` (args[2]) with the error
  // but we currently have this other error handling that is short
  // circuiting the typical Express error handling stack. Save
  // refactoring it for another day.
  // This will call `res.error(err)`, see logic in api/responses.
  // return (...args) => fn(...args).catch(args[2]);
}

function wrapHandlers(handlers) {
  return mapValues(wrapHandler, handlers);
}

module.exports = {
  filterEntity,
  firstEntity,
  generateS3ServiceName,
  getDirectoryFiles,
  getSiteDisplayEnv,
  isPastAuthThreshold,
  loadAssetManifest,
  loadDevelopmentManifest,
  loadProductionManifest,
  mapValues,
  shouldIncludeTracking,
  wrapHandler,
  wrapHandlers,
};
