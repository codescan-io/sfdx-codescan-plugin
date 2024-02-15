import * as fs from 'fs';
import * as Path from 'path';
import axios from 'axios';

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
              clearInterval(intervalHandle);
              resolve(data);
            }
          }).catch(err => {
            clearInterval(intervalHandle);
            reject(err);
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

export function pollQualityGate(auth, end, sonarWorkingDir, interval, resolve, reject) {
  const url = getCeTaskUrl(sonarWorkingDir);
  if (!url) {
    reject('ceTaskUrl not found');
    return;
  }

  poll(() => {
    return new Promise((_resolve, _reject) => {
      axios.get(url, { auth })
        .then(response => {
          const data = response.data;
          if (data.errors) {
            _reject(data.errors[0].msg);
          }
          _resolve(data.task);
        })
        .catch(error => _reject(error));
    });
  }, interval)
  .until(data => {
    return (data.status !== 'IN_PROGRESS' && data.status !== 'PENDING') || new Date().getTime() >= end;
  })
  .then(ceTask => {
    if (ceTask['status'] === 'IN_PROGRESS' || ceTask['status'] === 'PENDING') {
      reject('Quality Gate Timeout');
    } else {
      const qgurl = getQualityGateUrl(sonarWorkingDir, ceTask);
      if (!qgurl) {
        reject('qualityGate url not found');
      } else {
        // fetch quality gate...
        axios.get(qgurl, { auth })
          .then(response => {
            const data = response.data;
            if (data.errors) {
              reject(data.errors[0].msg);
            }
            resolve(data.projectStatus);
          })
          .catch(error => reject(error));
      }
    }
  })
  .catch(reject);
}
