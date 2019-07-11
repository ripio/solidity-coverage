
    var contract = artifacts.require('./Simple.sol');
    module.exports = function(deployer) {
      deployer.deploy(contract);
    };