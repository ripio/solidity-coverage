
/**
 * This file contains methods that produce a coverage map to pass to instanbul
 * from data generated by `instrumentSolidity.js`
 */
const SolidityCoder = require('web3/lib/solidity/coder.js');
const path = require('path');
const keccak = require('keccakjs');
const fs = require('fs');

/**
 * Converts solcover event data into an object that can be
 * be passed to instanbul to produce coverage reports.
 * @type {CoverageMap}
 */
module.exports = class CoverageMap {

  constructor() {
    this.coverage = {};
    this.assertCoverage = {};
    this.lineTopics = [];
    this.functionTopics = [];
    this.branchTopics = [];
    this.statementTopics = [];
    this.assertPreTopics = [];
    this.assertPostTopics = [];
  }

  /**
   * Initializes a coverage map object for contract instrumented per `info` and located
   * at `canonicalContractPath`
   * @param {Object} info `info = getIntrumentedVersion(contract, fileName, true)`
   * @param {String} canonicalContractPath target file location
   * @return {Object} coverage map with all values set to zero
   */

  addContract(info, canonicalContractPath, sourceTopicsFile) {
    this.coverage[canonicalContractPath] = {
      l: {},
      path: canonicalContractPath,
      s: {},
      b: {},
      f: {},
      fnMap: {},
      statementMap: {},
      branchMap: {},
    };
    this.assertCoverage[canonicalContractPath] = { };

    info.runnableLines.forEach((item, idx) => {
      this.coverage[canonicalContractPath].l[info.runnableLines[idx]] = 0;
    });
    this.coverage[canonicalContractPath].fnMap = info.fnMap;
    for (let x = 1; x <= Object.keys(info.fnMap).length; x++) {
      this.coverage[canonicalContractPath].f[x] = 0;
    }
    this.coverage[canonicalContractPath].branchMap = info.branchMap;
    for (let x = 1; x <= Object.keys(info.branchMap).length; x++) {
      this.coverage[canonicalContractPath].b[x] = [0, 0];
      this.assertCoverage[canonicalContractPath][x] = {
        preEvents: 0,
        postEvents: 0,
      };
    }
    this.coverage[canonicalContractPath].statementMap = info.statementMap;
    for (let x = 1; x <= Object.keys(info.statementMap).length; x++) {
      this.coverage[canonicalContractPath].s[x] = 0;
    }

    const keccakhex = (x => {
      const hash = new keccak(256); // eslint-disable-line new-cap
      hash.update(x);
      return hash.digest('hex');
    });

    const lineHash = keccakhex('__Coverage' + info.contractName + '(string,uint256)');
    const fnHash = keccakhex('__FunctionCoverage' + info.contractName + '(string,uint256)');
    const branchHash = keccakhex('__BranchCoverage' + info.contractName + '(string,uint256,uint256)');
    const statementHash = keccakhex('__StatementCoverage' + info.contractName + '(string,uint256)');
    const assertPreHash = keccakhex('__AssertPreCoverage' + info.contractName + '(string,uint256)');
    const assertPostHash = keccakhex('__AssertPostCoverage' + info.contractName + '(string,uint256)');

    this.lineTopics.push(lineHash);
    this.functionTopics.push(fnHash);
    this.branchTopics.push(branchHash);
    this.statementTopics.push(statementHash);
    this.assertPreTopics.push(assertPreHash);
    this.assertPostTopics.push(assertPostHash);

    const topics = `${lineHash}\n${fnHash}\n${branchHash}\n${statementHash}\n${assertPreHash}\n${assertPostHash}\n`;
    fs.appendFileSync(sourceTopicsFile, topics);
  }

  /**
   * Populates an empty coverage map with values derived from an array of events
   * fired by instrumented contracts as they are tested
   * @param  {Array} events
   * @param  {String} relative path to host contracts eg: './../contracts'
   * @return {Object} coverage map.
   */
  generate(events, pathPrefix) {
    for (let idx = 0; idx < events.length; idx++) {
      const event = JSON.parse(events[idx]);

      if (event.topics.filter(t => this.lineTopics.indexOf(t) >= 0).length > 0) {
        const data = SolidityCoder.decodeParams(['string', 'uint256'], event.data.replace('0x', ''));
        const canonicalContractPath = data[0];
        this.coverage[canonicalContractPath].l[data[1].toNumber()] += 1;
      } else if (event.topics.filter(t => this.functionTopics.indexOf(t) >= 0).length > 0) {
        const data = SolidityCoder.decodeParams(['string', 'uint256'], event.data.replace('0x', ''));
        const canonicalContractPath = data[0];
        this.coverage[canonicalContractPath].f[data[1].toNumber()] += 1;
      } else if (event.topics.filter(t => this.branchTopics.indexOf(t) >= 0).length > 0) {
        const data = SolidityCoder.decodeParams(['string', 'uint256', 'uint256'], event.data.replace('0x', ''));
        const canonicalContractPath = data[0];
        this.coverage[canonicalContractPath].b[data[1].toNumber()][data[2].toNumber()] += 1;
      } else if (event.topics.filter(t => this.statementTopics.indexOf(t) >= 0).length > 0) {
        const data = SolidityCoder.decodeParams(['string', 'uint256'], event.data.replace('0x', ''));
        const canonicalContractPath = data[0];
        this.coverage[canonicalContractPath].s[data[1].toNumber()] += 1;
      } else if (event.topics.filter(t => this.assertPreTopics.indexOf(t) >= 0).length > 0) {
        const data = SolidityCoder.decodeParams(['string', 'uint256'], event.data.replace('0x', ''));
        const canonicalContractPath = data[0];
        this.assertCoverage[canonicalContractPath][data[1].toNumber()].preEvents += 1;
      } else if (event.topics.filter(t => this.assertPostTopics.indexOf(t) >= 0).length > 0) {
        const data = SolidityCoder.decodeParams(['string', 'uint256'], event.data.replace('0x', ''));
        const canonicalContractPath = data[0];
        this.assertCoverage[canonicalContractPath][data[1].toNumber()].postEvents += 1;
      }
    }
    // Finally, interpret the assert pre/post events
    Object.keys(this.assertCoverage).forEach(contractPath => {
      const contract = this.coverage[contractPath];
      for (let i = 1; i <= Object.keys(contract.b).length; i++) {
        const branch = this.assertCoverage[contractPath][i];
        if (branch.preEvents > 0) {
          // Then it was an assert branch.
          this.coverage[contractPath].b[i] = [branch.postEvents, branch.preEvents - branch.postEvents];
        }
      }
    });
    return Object.assign({}, this.coverage);
  }
};
