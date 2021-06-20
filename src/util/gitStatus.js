// im not using this file

const {exec} = require(`child_process`);

const getBranch = async () =>
  new Promise((res, rej) => {
    exec(`git rev-parse --abbrev-ref HEAD`, (err, stdout, stderr) => {
      if (err || stderr) {
        rej(err || stderr);
      }
      // replace trailing whitespaces and new lines
      res(stdout.replace(/\s+$/, ``));
    });
  });

const getLastCommit = async () =>
  new Promise((res, rej) => {
    exec(`git log --format=%H -n 1`, (err, stdout, stderr) => {
      if (err || stderr) {
        rej(err || stderr);
      }
      res(stdout.slice(0, 8));
    });
  });

const getHeadDiff = async (ops) =>
  new Promise((res, rej) => {
    ops = ops ?? `--compact-summary`;
    exec(`git diff origin/HEAD HEAD ${ops}`, (err, stdout, stderr) => {
      if (err || stderr) {
        rej(err || stderr);
      }
      res(stdout);
    });
  });

const getBranchDiff = async (a, b, ops) =>
  new Promise((res, rej) => {
    ops = ops ?? `--compact-summary`;
    exec(`git diff origin/${a} ${b} ${ops}`, (err, stdout, stderr) => {
      if (err || stderr) {
        rej(err || stderr);
      }
      res(stdout);
    });
  });
const getUnstagedDiff = async (ops) =>
  new Promise((res, rej) => {
    ops = ops ?? `--compact-summary`;
    exec(`git diff ${ops}`, (err, stdout, stderr) => {
      if (err || stderr) {
        rej(err || stderr);
      }
      res(stdout);
    });
  });

module.exports = {
  getBranch,
  getLastCommit,
  getHeadDiff,
  getUnstagedDiff,
  getBranchDiff,
};
