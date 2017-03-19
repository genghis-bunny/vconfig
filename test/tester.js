const JConfigValidator = require('../JConfigValidator'),
	should = require('should'),
    config = require('./configs/config.json'),
    jSchema = require('./jconfig/serverConfig.json');

let validator;

describe("JConfigValidator", function() {
	describe("should", function() {
		it("instaniate", function(next) {
			validator = new JConfigValidator({});
			should.exist(validator, 'new JConfigValidator' );
			next();
		});
		it("validate", function(next) {
			validator.validate(config, jSchema);
			next();
		});
	});
});

