/**
 * Validates config.json against jConfig.json using z-schema.
 * It is called on server start up and should be invoked at
 * the earliest opportunity.
 */
const ZSchema = require('z-schema'),
	constants = require('./constants'),
	CRITICAL_LVL = constants.CRITICAL,
	WARN_LVL = constants.WARNING;
	 
require('colors');

const JConfigValidator = function(options) {
	this._zschema = new ZSchema({
		reportPathAsArray : true,
		breakOnFirstError : false
	});
	this._options = options || {};
}
JConfigValidator.prototype = {
	/**
	 * Validates config object and returns it.
	 */
	validate : function(config, schema) {
		const clone = this._clone,
			printReport = this._printReport,
			zschema = this._zschema,
			print = this._print;
			
		try {
			assert.isObject(config, constants.EXPECTING_CONFIG_OBJ);
			assert.isObject(schema, constants.EXPECTING_SCHEMA_OBJ);
			const isValid = zschema.validate( clone(config), clone(schema));
			if (!isValid) {
				this._printReport();
			}
		} catch(e) {
			print('Config checking skipped'.red);
		}
	},
	/**
	 * z-schema will decorate tested objects, so 
	 * use clone instead. 
	 */
	_clone : function(obj) {
		return JSON.parse(JSON.stringify(obj));
	},
	_print : function(severity, str) {
		const outStr = severity + ':' + str
		if (this._options.printToError) {
			console.error(outStr);
		} else {
			console.log(outStr);
		}
	},
	_printReport: function() {
		var errors = zschema.getLastErrors();
		var messages = this._report(errors);
		var self = this;
		var exit = false;

		console.log('Warning problems detected in config.json :- ');
		console.log('');

		messages.forEach(function(e, i) {
			var message = e.level + ': ' + e.message;
			if (e.level !== CRITICAL_LVL) {
				self._print('yellow', message);
			}
			console.log('');
		});

		messages.forEach(function(e, i) {
			var message = e.level + ': ' + e.message;
			if (e.level === CRITICAL_LVL) {
				self._print('red', message);
				exit = true;
			}
			console.log('');
		});

		if (exit) {
			console.log('Critical configuration problem(s) in ' + configPath);
			console.log('Exiting ...');
			process.exit(1);
		}

		console.log('Configuration issue(s) need fixing in ' + configPath);
		console.log('');
	},

	_print : function(colour, message) {
		var split = message.split('\n');
		split.forEach(function(m, i) {
			console.log(!i ? m[colour] : m);
			// first line in colour
		});
	},

	_map : {
		OBJECT_MISSING_REQUIRED_PROPERTY : function(e) {
			var ret = [];
			var path = e.path.join('.');

			e.params.map(function(i) {
				var str = '[';
				str += i + '] is required. ';
				var def = validator._buildDescription(e.path, i);
				if (def)
					str += '\n ' + def;
				str += '\nSOLUTION: Add [' + i + '] to config.json.';

				ret.push({
					level : CRITICAL_LVL,
					message : str
				});
			});
			return ret;
		},

		OBJECT_ADDITIONAL_PROPERTIES : function(e) {

			var ret = [];
			var path = e.path.join('.');
			//console.log(e);
			e.params[0].map(function(i) {
				var str = '';
				str += '[' + path + i + '] not recognised.\n';
				str += 'SOLUTION: Remove from config.json or add definition in jConfig.json.';
				ret.push({
					level : WARN_LVL,
					message : str
				});
			});

			return ret;
		},

		INVALID_TYPE : function(e) {
			var params = e.params;
			var prop = e.path.join('.');

			var ret = prop + ' should not be ' + params[1];
			var desc = '';
			var def = validator._buildDescription(e.path);
			if (def)
				desc += '\n' + def;
			ret += desc;
			ret += '\nSOLUTION: edit config.json and change [' + prop + '] to be ' + params[0] + ' and not ' + params[1] + '.';
			var desc = '';

			return [{
				level : WARN_LVL,
				message : ret
			}];
		},

		ENUM_MISMATCH : function(e) {
			var params = e.params;
			var prop = e.path[e.path.length - 1];
			var ret = 'The value [' + params[0] + '] of configuration option [' + prop + '] is not known.';
			var def = validator._buildDescription(e.path);
			if (def)
				ret += '\n' + def;
			ret += '\nSOLUTION: edit config.json and add an option from the currently available options in jConfig.json or add the value [' + params[0] + '] to the enum in jConfig.json.';

			var jDef = validator._getJSchemaDef(e.path);
			if (jDef && jDef.def) {
				var en = jDef.def.enum;
				if (en) {
					ret += 'The currently available options are: ' + en.join(', ');
				}

			}
			return [{
				level : WARN_LVL,
				message : ret
			}];
		}
	},
	/**
	 * Takes an array of z-schema errors and reports
	 * If there is no custom handler it will
	 * send native z-schema report.
	 */
	_report : function(zErrors) {
		var report = [];
		var self = this;
		zErrors.map(function(err) {
			var mapped = self._map[err.code];
			if (mapped) {
				report = report.concat(mapped(err));
			} else {
				var str = JSON.stringify(err, null, ' ');
				report.push({
					level : WARN_LVL,
					message : str
				});
			}

		});
		return report;
	},

	_buildDescription : function(pathArray, prop) {
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

	_getJSchemaDef : function(errorPath, prop) {
		var str = '';
		var js = jConfig;
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
			def : js,
			path : str
		};
	}
};
const assert = {
	isObject : function(candidate, message) {
		if (!candidate || typeof candidate !== 'object') {
			throw new Error(message);
		}
	}
}
module.exports = JConfigValidator;
