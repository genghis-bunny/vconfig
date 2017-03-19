"use strict"
/**
 * Validates config.json against jConfig.json using z-schema.
 * 
 */

const ZSchema = require('z-schema'),
	fs = require('fs'),
	constants = require('./constants.js'),
    CRITICAL = constants.CRITICAL,
    WARNING = constants.WARNING;

require('colors');

const JConfigValidator = function(options) {
    this._zschema = new ZSchema({
        reportPathAsArray: true,
        breakOnFirstError: false
    });
    this._options = options || {};
    assert.isObject(this._zschema, constants.ZSCHEMA_SET);
    assert.isObject(this._options, constants.OPTIONS_SET);
}

JConfigValidator.prototype = {
    /**
     * Validates config object against it's corrosponding json schema.
     * configPath - path to config file to be validated
     * schemaPath
     */
    validate: function(configPath, schemaPath) {
        try {
        	assert.isString(configPath, constants.EXPECTING_CONFIG_PATH);
            assert.isString(schemaPath, constants.EXPECTING_SCHEMA_PATH);
			const config = this._loadJson(configPath),
				schema = this._loadJson(schemaPath);
			
			
            const test = this.test = {
        		config: config,
        		schema: schema,
        		configPath: configPath,
        		schemaPath: schemaPath
        	};
        	let ret = false;

            if (!this._zschema.validate(test.config, test.schema)) {
                this._printReport();
            } else {
                ret = true;
            }
            return ret;
        } catch (e) {
            this._console(CRITICAL, 'Config checking skipped ' + e && e.message);
        }
    },
   
    _console: (severity, str) => {
        const outStr = severity + ':' + str,
            options = this._options;
        // if (options.printToError) {
        // console.error(outStr);
        // } else {
        // console.log(outStr);
        // }
        console.log(outStr);
    },
    _printReport: function() {
        const errors = this._zschema.getLastErrors(),
            messages = this._report(errors);

        let exit = false;

        console.log('Warning problems detected in config :- ');
        console.log('');

        messages.forEach((e, i) => {
            var message = e.level + ': ' + e.message;
            if (e.level !== CRITICAL) {
                this._print('yellow', message);
            }
            console.log('');
        });

        messages.forEach((e, i) => {// TODO: merge with above
            var message = e.level + ': ' + e.message;
            if (e.level === CRITICAL) {
                this._print('red', message);
                exit = true;
            }
            console.log('');
        });

        if (exit) {
            console.log('Critical configuration problem(s) in ' + this.test.configPath);
            console.log('Exiting ...');
            process.exit(1);
        }

        console.log('Configuration issue(s) need fixing in ' + configPath);
        console.log('');
    },
    _print: function(colour, message) {
        var split = message.split('\n');
        split.forEach(function(m, i) {
            console.log(!i ? m[colour] : m);
            // first line in colour
        });
    },
    _map: {
        OBJECT_MISSING_REQUIRED_PROPERTY: function(e) {
            const ret = [];
            let path = e.path.join('.');

            e.params.map(function(i) {
                var str = '[';
                str += i + '] is required. ';
                var def = this._buildDescription(e.path, i);
                if (def)
                    str += '\n ' + def;
                str += '\nSOLUTION: Add [' + i + '] to config.json.';

                ret.push({
                    level: CRITICAL,
                    message: str
                });
            }, this);
            return ret;
        },
        OBJECT_ADDITIONAL_PROPERTIES: (e) => {

            var ret = [];
            const path = e.path.join('.');
            
            e.params[0].map(function(i) {
                var str = '';
                str += '[' + path + i + '] not recognised.\n';
                str += 'SOLUTION: Remove from config.json or add definition in jConfig.json.';
                ret.push({
                    level: WARNING,
                    message: str
                });
            });

            return ret;
        },
        INVALID_TYPE: function(e) {
            var params = e.params;
            var prop = e.path.join('.');

            var ret = prop + ' should not be ' + params[1];
            var desc = '';
            var def = this._buildDescription(e.path);
            if (def)
                desc += '\n' + def;
            ret += desc;
            ret += '\nSOLUTION: edit config.json and change [' + prop + '] to be ' + params[0] + ' and not ' + params[1] + '.';
            var desc = '';

            return [{
                level: WARNING,
                message: ret
            }];
        },
        ENUM_MISMATCH: function(e) {
            var params = e.params;
            var prop = e.path[e.path.length - 1];
            var ret = 'The value [' + params[0] + '] of configuration option [' + prop + '] is not known.';
            var def = this._buildDescription(e.path);
            if (def)
                ret += '\n' + def;
            ret += '\nSOLUTION: edit config.json and add an option from the currently available options in jConfig.json or add the value [' + params[0] + '] to the enum in jConfig.json.';

            var jDef = this._getJSchemaDef(e.path);
            if (jDef && jDef.def) {
                var en = jDef.def.enum;
                if (en) {
                    ret += 'The currently available options are: ' + en.join(', ');
                }

            }
            return [{
                level: WARNING,
                message: ret
            }];
        }
    },
    /**
     * Takes an array of z-schema errors and reports
     * If there is no custom handler it will
     * send native z-schema report.
     */
    _report: function(zErrors) {
        var report = [];
        zErrors.map(function(err) {
            var mapped = this._map[err.code];
            if (mapped) {
                report = report.concat(mapped.call(this, err));
            } else {
                var str = JSON.stringify(err, null, ' ');
                report.push({
                    level: WARNING,
                    message: str
                });
            }

        }, this);
        return report;
    },
    /**
     * 
 	 * This will be caught as an exception on error.
     */
	_loadJson: function(path) {
		return JSON.parse(fs.readFileSync(path));	
	},
	
    _buildDescription: function(pathArray, prop) {
        if (pathArray) {
            var def = this._getJSchemaDef(pathArray, prop);
            var d = def.def;
            var path = def.path;

            if (!d)
                return 'FIXME: definition not found for ' + path;
            if (!d.description)
                return 'FIXME: No description found for ' + path;

            if (d && d.description) {
                return '' + (prop || pathArray[pathArray.length - 1]) + ' (' + d.type + ') ' + d.description + '';
            }
        }

        return '';
    },
    _getJSchemaDef: function(errorPath, prop) {
        let str = '',
         js = this.test.schema;
         
        errorPath.forEach(function(i) {
            if (js.properties) {
                str += 'properties.';
                js = js.properties;
            }
            str += i;
            js = js[i];
        });
        if (prop) {
            if (js.properties) {
                str += '.properties.';
                js = js.properties;
            }
            str += prop;
            js = js[prop];
        }
        return {
            def: js,
            path: str
        };
    }
};
const assert = {
    isObject: function(candidate, message) {
        if (!candidate || typeof candidate !== 'object') {
            throw new Error(message);
        }
    },
    isString: function(candidate, message) {
    	 if (!candidate || typeof candidate !== 'string') {
            throw new Error(message);
        }
    }
}
module.exports = JConfigValidator;