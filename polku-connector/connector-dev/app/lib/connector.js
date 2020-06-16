"use strict";
/**
 * Module dependencies.
 */
const winston = require('../../logger.js');
const rest = require('../protocols/rest');
const validator = require('./validator');
const events = require('events');
const cache = require('../cache');
const moment = require('moment');
const _ = require('lodash');
const fs = require('fs');

/**
 * Connector library.
 *
 * Handles data fetching by product code specific configurations.
 */

/** Import platform of trust definitions. */
const {
    PRODUCT_CODE,
    TIMESTAMP,
    PARAMETERS,
    IDS,
    START,
    END,
    DATA_TYPES,
    supportedParameters
} = require('../../config/definitions/request');

// Initialize objects for protocols and plugins.
const protocols = {};
const plugins = {};

// Set directories.
const templatesDir = './config/templates';
const resourcesDir = './config/resources';
const protocolsDir = './app/protocols';
const pluginsDir = './config/plugins';
const configsDir = './config';

// Make sure directories for templates, protocols, configs and plugins exists.
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);
if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir);
if (!fs.existsSync(protocolsDir)) fs.mkdirSync(protocolsDir);
if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir);
if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);

/**
 * Handles JSON data.
 *
 * @param {String} collection
 * @param {Object} file
 * @param {String} data
 */
function handleFile(collection, file, data) {
    let object;
    try {
        object = JSON.parse(data);
        // If config has protocol mqtt, connect to the broker.
        if (Object.hasOwnProperty.call(object, 'static')) {
            if (Object.hasOwnProperty.call(object.static, 'topic')) {
                protocols['mqtt'].connect(object, file);
            }
        }
    } catch (err) {
        /** File is not a valid JSON. */
    }
    cache.setDoc(collection, file, object || data);
}

/**
 * Caches or requires file contents.
 *
 * @param {String} dir
 * @param {String} ext
 * @param {String} collection
 * @param {Object} file
 */
function readFile(dir, ext, collection, file) {
    return new Promise(function (resolve, reject) {
        fs.readFile(dir + '/' + file, 'utf8', function (err, data) {
            if (err) return winston.log('error', 'File read error', err.message);
            try {
                switch (ext) {
                    /** JSON. */
                    case '.json':
                        handleFile(collection, file.split('.')[0], data);
                        break;
                    /** JavaScript. */
                    case '.js':
                        eval(collection)[file.split('.')[0]] = require('../.' + dir + '/' + file);
                        break;
                    /** Resources. */
                    case '.*':
                        handleFile(collection, file, data);
                        break;
                }
                winston.log('info', 'Loaded ' + dir + '/' + file + '.');
            } catch (err) {
                winston.log('error', err.message);
            }
            resolve();
        });
    });
}

/**
 * Scans directory and handles files.
 *
 * @param {String} dir
 *   Directory to be scanned.
 * @param {String} ext
 *   Extension of the files to be scanned.
 * @param {String} collection
 *   Collection name.
 *  @param {Function} callback
 *   Handler for single file.
 */
function load(dir, ext, collection, callback) {
    return new Promise(function (resolve, reject) {
        fs.readdir(dir, async (err, files) => {
            if (err) reject(err);
            for (let i = 0; i < files.length; i++) {
                // Handle only files with given file extension.
                if (files[i].substr(-ext.length) !== ext && ext !== '.*') continue;
                await callback(dir, ext, collection, files[i]);
            }
            resolve();
        });
    });
}

// Emitter for loading status.
const emitter = new events.EventEmitter();

/**
 * Loads JSON files from array.
 *
 * @param {String} collection
 *   Type of the contents.
 * @param {String} string
 *   Content of the environment variable.
 */
function loadJSON(collection, string) {
    try {
        const object = JSON.parse(Buffer.from(string, 'base64').toString('utf8'));
        for (let i = 0; i < Object.keys(object).length; i++) {
            const filename = Object.keys(object)[i];
            handleFile('configs', filename, JSON.stringify(object[filename]));
            winston.log('info', 'Loaded from environment ' + collection + '/' + filename + '.');
        }
    } catch (err) {
        winston.log('error', err.message);
    }
    return Promise.resolve();
}

/**
 * Emits cached collections.
 *
 * @param {Array} collections
 *   Collection names.
 */
function emit(collections) {
    const data = {};
    for (let i = 0; i < collections.length; i++) {
        try {
            data[collections[i]] = Object.assign({},
                ...cache.getKeys(collections[i]).map(key => {
                    return {[key]: cache.getDoc(collections[i], key)}
                })
            )
        } catch (err) {
            winston.log('error', err.message);
        }
    }
    emitter.emit('collections', data);
    return Promise.resolve();
}

// Load templates, protocols, configurations and plugins.
(process.env.TEMPLATES ?
    /** Source selection for templates. */
    loadJSON('templates', process.env.TEMPLATES) :
    load(templatesDir, '.json', 'templates', readFile))
    .then(() => {return (process.env.RESOURCES ?
        /** Source selection for resources. */
        loadJSON('resources', process.env.RESOURCES) :
        load(resourcesDir, '.*', 'resources', readFile))})
    .then(() => {return load(protocolsDir, '.js', 'protocols', readFile)})
    .then(() => {return (process.env.CONFIGS ?
        /** Source selection for configs. */
        loadJSON('configs', process.env.CONFIGS) :
        load(configsDir, '.json', 'configs', readFile))})
    .then(() => {return load(pluginsDir, '.js', 'plugins', readFile)})
    .then(() => {return emit(['templates', 'configs', 'resources'])})
    .catch((err) => winston.log('error', err.message));

/**
 * Replaces placeholder/s with given value/s.
 *
 * @param {String/Object} template
 *   Template value.
 * @param {String} placeholder
 *   Placeholder name. Used when value is not an object.
 * @param {String/Object} value
 *   Inserted value.
 * @return {String/Object}
 *   Template value with placeholder values.
 */
function replacer(template, placeholder, value) {
    let r = JSON.stringify(template);
    if (value instanceof Date) value = value.toISOString();
    if (_.isObject(value)) {
        Object.keys(value).forEach(function (key) {
            r = r.replace('${' + key + '}', value[key])
        });
        // In case id placeholder is left untouched.
        if (r === '"${id}"' && Object.keys(value).length > 0) {
            // Place object to the id placeholder.
            r = r.replace('"${id}"', JSON.stringify(value))
        }
        return JSON.parse(r);
    } else {
        return JSON.parse(r.replace('${' + placeholder + '}', value));
    }
}

/**
 * Configures template with data product config (static)
 * and request parameters (dynamic).
 *
 * @param {Object} config
 *   Data product specific config.
 * @param {Object} template
 *   Connection template for external system.
 * @param {Object} params
 *   Parameters from broker API request.
 * @return {Object}
 *   Configured template.
 */
function replacePlaceholders(config, template, params) {
    // In case dynamic parameter object ´ids´ does not contain objects,
    // these elements will be converted from [x, y, ...] to [{id: x}, {id: y}, ...].
    // This will ease the following dynamic placeholder procedure.
    if (Object.hasOwnProperty.call(params, 'ids')) {
        for (let i = 0; i < params.ids.length; i++) {
            if (!_.isObject(params.ids[i])) {
                params.ids[i] = {id: params.ids[i]};
            }
        }
    }

    /** Dynamic parameters. */
    if (Object.hasOwnProperty.call(config, 'dynamic')) {
        Object.keys(config.dynamic).forEach(function (path) {
            let placeholders = config.dynamic[path];
            if (!Array.isArray(placeholders)) {
                placeholders = [placeholders];
            }
            placeholders.forEach(function (placeholder) {
                if (Object.hasOwnProperty.call(params, placeholder)) {
                    const templateValue = _.get(template, path);
                    if (Array.isArray(params[placeholder])) {
                        // Transform placeholder to array, if given parameters are in an array.
                        const array = [];
                        params[placeholder].forEach(function (element) {
                            array.push(replacer(templateValue, placeholder, element));
                        });
                        _.set(template, path, array);
                    } else {
                        _.set(template, path, replacer(templateValue, placeholder, params[placeholder]));
                    }
                }
            });
        });
    }

    /** Static parameters. */
    if (Object.hasOwnProperty.call(config, 'static')) {
        template = replacer(template, null, config.static);
    }

    return template;
}

/**
 * Parses timestamp to date object.
 *
 * @param {String/Number} timestamp
 * @return {Date/String/Number}
 */
const parseTs = function (timestamp) {
    if (!timestamp) return timestamp;
    try {
        let parsed = new Date(Date.parse(timestamp));
        if (parsed.toString() === 'Invalid Date' || parsed.toString() === 'Invalid date') {
            // Try parsing the timestamp to integer.
            timestamp = Number.parseInt(timestamp);
            parsed = new Date(timestamp);
        }
        // Sometimes a timestamp in seconds is encountered and it needs to be converted to millis.
        if (parsed.getFullYear() === 1970) parsed = new Date(timestamp * 1000);
        return parsed;
    } catch (err) {
        return timestamp;
    }
};

/**
 * Interprets mode (latest/history/prediction).
 *
 * @param {Object} config
 *   Data product specific config.
 * @param {Object} parameters
 *   Broker request parameters.
 * @return {Object}
 *   Config with mode.
 */
const interpretMode = function (config, parameters) {
    // Some systems require always start and end time and latest values cannot be queried otherwise.
    // Start and end times are set to match last 24 hours from given timestamp.
    // Limit property is used to include only latest values.
    const defaultTimeRange = 1000 * 60 * 60 * 24;

    // Latest by default.
    config.mode = 'latest';

    // Detect history request from start and end time.
    if (parameters.start && parameters.end) {
        // Sort timestamps to correct order.
        if (parameters.end < parameters.start) {
            const start = parameters.end;
            parameters.end = parameters.start;
            parameters.start = start;
        }
        config.mode = 'history';
    } else {
        // Include default range.
        parameters.start = new Date(config.timestamp.getTime() - defaultTimeRange);
    }

    // Detect prediction request from end time and client's current local time.
    if (parameters.end.getTime() > config.timestamp.getTime()) {
        config.mode = 'prediction';
    }

    if (config.mode === 'latest') {
        // Add limit query property, if it's required.
        if (Object.hasOwnProperty.call(config, 'generalConfig')) {
            if (Object.hasOwnProperty.call(config.generalConfig, 'query')) {
                if (!Object.hasOwnProperty.call(config.generalConfig.query, 'properties')) {
                    config.generalConfig.query.properties = [];
                }
                if (Object.hasOwnProperty.call(config.generalConfig.query, 'limit')) {
                    config.generalConfig.query.properties.push(config.generalConfig.query.limit);
                }
            }
        }
    }

    // Save parameters to config.
    config.parameters = parameters;

    return config;
};

/**
 * Loads config by requested product code and retrieves template defined in the config.
 * Places static and dynamic parameters to the template as described.
 * Consumes described resources.
 *
 * @param {Object} reqBody
 * @return {Array}
 *   Data array.
 */
const getData = async (reqBody) => {
    /** Parameter validation */
    const validation = validator.validate(reqBody, supportedParameters);
    if (Object.hasOwnProperty.call(validation, 'error')) {
        if (validation.error) return rest.promiseRejectWithError(422, validation.error);
    }

    // Pick supported parameters from reqBody.
    const productCode = _.get(reqBody, PRODUCT_CODE) || 'default';
    const timestamp = parseTs(_.get(reqBody, TIMESTAMP) || moment.now());
    let parameters = {
        ids: _.uniq(_.get(reqBody, IDS) || []),
        start: parseTs(_.get(reqBody, START)),
        end: parseTs(_.get(reqBody, END) || timestamp),
        dataTypes: _.uniq(_.get(reqBody, DATA_TYPES) || []),
    };

    // Leave unsupported parameters untouched.
    _.unset(reqBody, IDS);
    _.unset(reqBody, START);
    _.unset(reqBody, END);
    _.unset(reqBody, DATA_TYPES);
    parameters = {...parameters, ..._.get(reqBody, PARAMETERS) || {}};

    // Get data product config.
    let config = cache.getDoc('configs', productCode);
    if (!config) config = cache.getDoc('configs', 'default');
    if (!config) return rest.promiseRejectWithError(404, 'Data product config not found.');
    if (!Object.hasOwnProperty.call(config, 'template')) {
        return rest.promiseRejectWithError(404, 'Data product config template not defined.');
    }

    // Get data product config template.
    let template = cache.getDoc('templates', config.template);
    if (!template) return rest.promiseRejectWithError(404, 'Data product config template not found.');

    // Template identifies connector settings for multiple configs.
    // ProductCode identifies requested data product.
    template.authConfig.template = config.template;
    template.productCode = productCode;

    // Execute parameters plugin function.
    for (let i = 0; i < template.plugins.length; i++) {
        if (Object.hasOwnProperty.call(plugins, template.plugins[i])) {
            if (!!plugins[template.plugins[i]].parameters) {
                parameters = await plugins[template.plugins[i]].parameters(config, parameters);
            }
        }
    }

    // Place values defined in config to template.
    template = replacePlaceholders(config, template, parameters);

    // Timestamp presents client's current local time.
    template.timestamp = parseTs(timestamp);

    // Interpret mode.
    template = interpretMode(template, parameters);

    // Check that authConfig exists.
    if (!Object.hasOwnProperty.call(template, 'authConfig')) {
        return rest.promiseRejectWithError(500, 'Insufficient authentication configurations.');
    }

    // Attach plugins.
    if (Object.hasOwnProperty.call(template, 'plugins')) {
        if (template.plugins.length !== Object.keys(plugins).filter(p => template.plugins.includes(p)).length) {
            return rest.promiseRejectWithError(500, 'Missing required plugins.');
        } else {
            template.plugins = Object.keys(plugins).filter(n => template.plugins.includes(n)).map(n => plugins[n]);
        }
    } else {
        template.plugins = [];
    }

    // Check that resource path is defined.
    if (!Object.hasOwnProperty.call(template.authConfig, 'path')) {
        return rest.promiseRejectWithError(500, 'Insufficient resource configurations.');
    }

    let pathArray = [];
    let path = template.authConfig.path;
    if (!Array.isArray(path)) pathArray.push(path);
    else pathArray = path;

    // Remove duplicates.
    pathArray = _.uniq(pathArray);

    // Initialize items array.
    let items = [];

    // Check that a protocol is defined.
    if (!Object.hasOwnProperty.call(template, 'protocol')) {
        return rest.promiseRejectWithError(500, 'Connection protocol not defined.');
    } else {
        // Check that the protocol is supported.
        if (!Object.hasOwnProperty.call(protocols, template.protocol)) {
            return rest.promiseRejectWithError(500, 'Connection protocol ' + template.protocol + ' is not supported.');
        } else {
            items = await protocols[template.protocol].getData(template, pathArray);
            if (!items) items = [];
        }
    }

    return Promise.resolve(_.flatten(items));
};

/**
 * Expose library functions.
 */
module.exports = {
    getData,
    emitter
};
