import * as fs from 'fs';
import * as Path from 'path';
import * as request from 'request';

function poll(pollFn, interval = 100) {
  let intervalHandle = null;
  return {
    until(conditionFn) {
      return new Promise((resolve, reject) => {
        intervalHandle = setInterval(() => {
          pollFn().then(data => {
            let passesCondition = false;
            try {
              passesCondition = conditionFn(data);
            } catch (e) {
              reject(e);
            }
            if (passesCondition) {
              resolve(data);
              clearInterval(intervalHandle);
            }
          }).catch(err => {
            reject(err);
            clearInterval(intervalHandle);
          });
        }, interval);
      });
    }
  };
}

function getCeTaskUrl(sonarWorkingDir) {
  const lines = fs.readFileSync(Path.join(sonarWorkingDir, 'report-task.txt'), 'utf-8').split('\n');
  for ( const i in lines ) {
    if ( lines[i].startsWith('ceTaskUrl=') ) {
      return lines[i].substring('ceTaskUrl='.length);
    }
  }
  return null;
}

function getQualityGateUrl(sonarWorkingDir, ceTask) {
  let analysisId = null;
  if (ceTask['analysisId']) {
    analysisId = ceTask['analysisId'];
  } else {
    analysisId = ceTask['id'];
  }

  const lines = fs.readFileSync(Path.join(sonarWorkingDir, 'report-task.txt'), 'utf-8').split('\n');
  let projectKey = null;
  let serverUrl = null;
  for (const i in lines) {
    if (lines[i].startsWith('serverUrl=')) {
      serverUrl = lines[i].substring('serverUrl='.length);
    } else if (lines[i].startsWith('projectKey=')) {
      projectKey = lines[i].substring('projectKey='.length);
    }
  }
  if ( serverUrl && projectKey ) {
    return serverUrl + '/api/qualitygates/project_status?analysisId=' + analysisId;
  }
  return null;
}

export function pollQualityGate(end, sonarWorkingDir, interval, resolve, reject) {
  const url = getCeTaskUrl(sonarWorkingDir);
  if (!url) {
    reject('ceTaskUrl not found');
  }
  poll(() => {
    return new Promise((_resolve, _reject) => {
      request(url, (error, response, body) => {
          if (error) {
            return _reject(error);
          }
          const json = JSON.parse(body);
          if (json.errors) {
            _reject(json.errors[0].msg);
          }
          _resolve(json.task);
      });
    });
  }, interval)
  .until(data => {
    return (data.status !== 'IN_PROGRESS' && data.status !== 'PENDING') || new Date().getTime() >= end;
  })
  .then(ceTask => {
    const qgurl = getQualityGateUrl(sonarWorkingDir, ceTask);
    if (!qgurl) {
      reject('qualityGate url not found');
    }

    // fetch quality gate...
    request(qgurl, (error, response, body) => {
      if (error) {
        return reject(error);
      }
      const json = JSON.parse(body);
      if (json.errors) {
        reject(json.errors[0].msg);
      }
      resolve(json.projectStatus);
    });
  })
  .catch(reject);
}
