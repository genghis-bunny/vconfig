/**
 * remove me - for development only.
 */

const JConfigValidator = require('./JConfigValidator');

const validator = new JConfigValidator({
	colourise: true
});
validator.validate("./test/configs/config.json", "./test/jconfig/serverConfig.json");





