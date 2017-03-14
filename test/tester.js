const JConfigValidator = require('../JConfigValidator'),
    config = require('./configs/config.json'),
    jSchema = require('./jconfig/schemaConfig.json');

let validator;

describe("JConfigValidator", function() {
	describe("should", function() {
		it("instaniate", function() {
			validator = new JConfigValidator({});
		});
	});
});

