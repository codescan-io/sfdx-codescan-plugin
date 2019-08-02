sfdx-codescan-plugin
=============

Run CodeScan or SonarQube jobs from sfdx

[![Version](https://img.shields.io/npm/v/sfdx-codescan-plugin.svg)](https://npmjs.org/package/sfdx-codescan-plugin)
[![CircleCI](https://circleci.com/gh/VillageChief/sfdx-codescan-plugin/tree/master.svg?style=shield)](https://circleci.com/gh/VillageChief/sfdx-codescan-plugin/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/VillageChief/sfdx-codescan-plugin?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/sfdx-codescan-plugin/branch/master)
[![Codecov](https://codecov.io/gh/VillageChief/sfdx-codescan-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/VillageChief/sfdx-codescan-plugin)
[![Greenkeeper](https://badges.greenkeeper.io/VillageChief/sfdx-codescan-plugin.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/VillageChief/sfdx-codescan-plugin/badge.svg)](https://snyk.io/test/github/VillageChief/sfdx-codescan-plugin)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-codescan-plugin.svg)](https://npmjs.org/package/sfdx-codescan-plugin)
[![License](https://img.shields.io/npm/l/sfdx-codescan-plugin.svg)](https://github.com/VillageChief/sfdx-codescan-plugin/blob/master/package.json)


```sh-session
$ npm install -g sfdx-codescan-plugin
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
sfdx-codescan-plugin/1.0.0 linux-x64 node-v8.11.3
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
[`sfdx codescan:run [name=value...] [-s <string>] [-o <string>] [-k <string>] [-t <string>] [-u <string>] [-p <string>] [--noqualitygate] [--javahome <string>] [--nofail] [--qgtimeout <integer>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-codescanrun-namevalue--s-string--o-string--k-string--t-string--u-string--p-string---noqualitygate---javahome-string---nofail---qgtimeout-integer---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

runs a SonarQube analysis

```
USAGE
  $ sfdx codescan:run [name=value...] [-s <string>] [-o <string>] [-k <string>] [-t <string>] [-u <string>] [-p 
  <string>] [--noqualitygate] [--javahome <string>] [--nofail] [--qgtimeout <integer>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -k, --projectkey=projectkey                                                       sonar.projectKey - the project key
                                                                                    to create

  -o, --organization=organization                                                   CodeScan Organization Id. Only
                                                                                    required when connecting to CodeScan
                                                                                    Cloud

  -p, --password=password                                                           SonarQube password (token is
                                                                                    preferred)

  -s, --server=server                                                               SonarQube server. Defaults to
                                                                                    CodeScan Cloud
                                                                                    (https://app.codescan.io)

  -t, --token=token                                                                 SonarQube token (preferred)

  -u, --username=username                                                           SonarQube username (token is
                                                                                    preferred)

  --javahome=javahome                                                               JAVA_HOME to use

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --nofail                                                                          Don't fail if sonar-scanner fails

  --noqualitygate                                                                   Don't wait until the SonarQube
                                                                                    background task is finished and
                                                                                    return the build Quality Gate

  --qgtimeout=qgtimeout                                                             Timeout in seconds to wait for
                                                                                    Quality Gate to complete (default
                                                                                    300)

EXAMPLES
  $ sfdx codescan:run --token <token> --projectkey my-project-key --organization my-org-key
  
  $ sfdx codescan:run --token <token> --projectkey my-project-key --organization my-org-key -Dsonar.verbose=true
       -D can be used for passing any sonar-scanner definition
       -X will be passed as a jvm arg
  
  $ sfdx codescan:run ... -X
       Verbose output
```

_See code: [src/commands/codescan/run.ts](https://github.com/VillageChief/sfdx-codescan-plugin/blob/v1.0.0/src/commands/codescan/run.ts)_
