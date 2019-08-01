import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson, JsonMap } from '@salesforce/ts-types';
import {spawn} from 'child_process';
import * as fs from 'fs';
import * as Path from 'path';
import * as request from 'request';
import {pollQualityGate} from '../../lib/qualitygate';
import {resolveRequirements} from '../../lib/requirements';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-codescan-plugin', 'codescan');

export default class Run extends SfdxCommand {

  public static description = messages.getMessage('runCommandDescription');

  public static examples = [
  `$ sfdx codescan:run --token <token> --projectkey my-project-key --organization my-org-key
  `,
  `$ sfdx codescan:run --token <token> --projectkey my-project-key --organization my-org-key -Dsonar.verbose=true
    -D can be used for passing any sonar-scanner definition
    -X will be passed as a jvm arg
  `,
  `$ sfdx codescan:run ... -X
    Verbose output`
  ];

  public static args = [];

  protected static varargs = true;

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    server: flags.string({char: 's', description: messages.getMessage('serverFlagDescription')}),
    organization: flags.string({char: 'o', description: messages.getMessage('organizationFlagDescription')}),

    projectkey: flags.string({char: 'k', description: messages.getMessage('projectKeyFlagDescription')}),

    token: flags.string({char: 't', description: messages.getMessage('tokenFlagDescription')}),
    username: flags.string({char: 'u', description: messages.getMessage('usernameFlagDescription')}),
    password: flags.string({char: 'p', description: messages.getMessage('passwordFlagDescription')}),

    noqualitygate: flags.boolean({description: messages.getMessage('noqualitygateFlagDescription')}),

    javahome: flags.string({description: messages.getMessage('javahomeFlagDescription')}),
    nofail: flags.boolean({description: messages.getMessage('nofailFlagDescription')}),
    qgtimeout: flags.integer({description: messages.getMessage('qgtimeoutFlagDescription')})
  };

  private static SONAR_SCANNER_VERSION = '3.3.0.1492';
  private static scannerUrl = 'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-SONAR_SCANNER_VERSION.zip';

  protected varargValues = [];
  protected codescanPath = null;

  public async run(): Promise<AnyJson> {
    const varargs = this.varargValues.slice();
    const command = await this.resolveJava(this.flags.javahome);
    let args = [];

    if (this.contains(varargs, '-Dsonar.host.url')) {
      // skip
    } else if (!this.flags.server) {
      this.flags.server = 'https://app.codescan.io';
    } else if (!this.flags.server.startsWith('http://') && !this.flags.server.startsWith('https://')) {
      throw new SfdxError(messages.getMessage('errorInvalidServerUrl'));
    }
    if (this.flags.server && this.flags.server.endsWith('codescan.io') && !this.flags.organization) {
      throw new SfdxError(messages.getMessage('errorNoOrganization'));
    }

    // put -X vm args at front...
    for ( const x in varargs) {
      if (varargs[x].startsWith('-X') && varargs[x] !== '-X') {
        args.push(varargs[x]);
        varargs.splice(parseInt(x, 10), 1);
      }
    }

    // jar
    args.push('-jar');
    args.push(await this.resolveSonarScanner());

    // server
    if (this.flags.server) {
      if (this.contains(varargs, '-Dsonar.host.url')) {
        throw new SfdxError(messages.getMessage('errorDuplicateValues', ['server']));
      }
      args.push('-Dsonar.host.url=' + this.flags.server );
    }
    if (this.flags.organization) {
      if (this.contains(varargs, '-Dsonar.organization')) {
        throw new SfdxError(messages.getMessage('errorDuplicateValues', ['organization']));
      }
      args.push( '-Dsonar.organization=' + this.flags.organization );
    }

    // authentication
    if (this.contains(varargs, '-Dsonar.login') || this.contains(varargs, '-Dsonar.password')) {
      if (this.flags.token || this.flags.username && this.flags.password) {
        throw new SfdxError(messages.getMessage('errorDuplicateValues', ['token/username/password']));
      }
    } else if (this.flags.token) {
      if (this.flags.username || this.flags.password) {
        throw new SfdxError(messages.getMessage('errorTokenAndUserPass'));
      }
      args.push( '-Dsonar.login=' + this.flags.token );
    } else if (this.flags.username && this.flags.password) {
      args.push( '-Dsonar.login=' + this.flags.username );
      args.push( '-Dsonar.password=' + this.flags.password );
    } else if (this.flags.username || this.flags.password) {
      throw new SfdxError(messages.getMessage('errorOnlyUserOrPass'));
    } else {
      this.ux.log('No --token specified. This will probably fail');
    }

    if (this.flags.projectkey) {
      if (this.contains(varargs, '-Dsonar.projectKey')) {
        throw new SfdxError(messages.getMessage('errorDuplicateValues', ['projectkey']));
      }
      args.push('-Dsonar.projectKey=' + this.flags.projectkey);
    }

    // setup working dir
    let sonarWorkingDir = this.contains(varargs, '-Dsonar.working.directory=');
    if (sonarWorkingDir) {
      sonarWorkingDir = sonarWorkingDir.substring('-Dsonar.working.directory='.length);
    } else {
      sonarWorkingDir = Path.join(this.codescanPath, 'sonarworker');
      args.push('-Dsonar.working.directory=' + sonarWorkingDir);
    }

    // add rest of varargs
    args = args.concat(varargs);

    // spawn scanner
    const cmd = spawn(command, args);
    cmd.stdout.pipe(process.stdout);
    cmd.stderr.pipe(process.stderr);
    const nofail = !!this.flags.nofail;
    const noqualitygate = !!this.flags.noqualitygate;

    const getQualityGate = this.getQualityGate;
    const _this = this;
    return new Promise((resolve, reject) => {
      cmd.addListener('exit', code => {
        if (code === 0 && !noqualitygate) {
          _this.ux.startSpinner('Waiting for SonarQube Background Task...');
          return getQualityGate(_this, sonarWorkingDir)
          .catch(error => {
            _this.ux.stopSpinner();
            if (_this.flags.nofail) {
              return resolve({code: 0, qualitygate: _this.printQualityGate(error)['qualitygate']});
            } else {
              return reject(error);
            }
          })
          .then(ret => {
            _this.ux.stopSpinner();
            resolve({code, qualitygate: _this.printQualityGate(ret)});
          });
        } else if (code === 0 || nofail) {
          resolve({code});
        } else {
          reject({code});
        }
      });
    });
  }

  protected parseVarargs(args?: string[]): JsonMap {
    this.varargValues = args;
    return {};
  }

  private printQualityGate(qualitygate) {
    const chalk = require('chalk');
    if (qualitygate['status'] === 'OK') {
      this.ux.log(chalk.green('Quality Gate passed'));
    } else {
      this.ux.error(chalk.red('Quality Gate failed'));
    }
    return qualitygate;
  }
  private getQualityGate(_this, sonarWorkingDir) {
    const qgtimeout = _this.flags.qgtimeout ? parseInt(_this.flags.qgtimeout, 10) : 300;
    const end = new Date().getTime() + (qgtimeout * 1000);
    return new Promise((resolve, reject) => {
      pollQualityGate(end, sonarWorkingDir, 2000, resolve, reject);
    });
  }

  private resolveJava(javaHome) {
    return resolveRequirements(javaHome)
    .catch(error => {
      throw error;
    })
    .then(requirements => {
      return requirements.javaHome + '/bin/java';
    });
  }

  private resolveSonarScanner() {
    const scannerUrl = Run.scannerUrl.replace('SONAR_SCANNER_VERSION', Run.SONAR_SCANNER_VERSION);

    // create parent dirs
    if (!fs.existsSync(Path.normalize('.sfdx/'))) {
      fs.mkdirSync(Path.normalize('.sfdx/'));
    }
    this.codescanPath = this.codescanPath = Path.normalize('.sfdx/codescan');
    if (!fs.existsSync(this.codescanPath)) {
      fs.mkdirSync(this.codescanPath);
    }

    const sonarScannerPath = Path.join(this.codescanPath, 'sonar-scanner-' + Run.SONAR_SCANNER_VERSION + '/lib/sonar-scanner-cli-' + Run.SONAR_SCANNER_VERSION + '.jar');
    if (!fs.existsSync(sonarScannerPath)) {
      const unzip = require('unzip2');
      this.ux.startSpinner('Downloading sonar-scanner...');
      return new Promise((resolve, reject) => {
        request(scannerUrl)
        .on('error', () => {
          this.ux.stopSpinner('Failed to download ' + scannerUrl);
          reject('Failed to download ' + scannerUrl);
        })
        .pipe(unzip.Extract({ path: this.codescanPath}).on('close', () => {
          this.ux.stopSpinner();
          if (!fs.existsSync(sonarScannerPath)) {
            throw new SfdxError(messages.getMessage('errorSonarScannerPathDoestExist', [sonarScannerPath]));
          }
          resolve(sonarScannerPath);
        }));
      });
    }

    return sonarScannerPath;
  }

  private contains(arr, prefix) {
    for ( const x in arr) {
      if (arr[x].startsWith(prefix)) {
        return arr[x];
      }
    }
    return false;
  }
}
