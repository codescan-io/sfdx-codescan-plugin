import * as fs from 'fs';
import * as Path from 'path';
const request = require("request");

function poll(pollFn, interval = 100) {
  var intervalHandle = null
  return {
    until(conditionFn) {
      return new Promise((resolve, reject) => {
        intervalHandle = setInterval(() => {
          pollFn().then((data) => {
            let passesCondition = false;
            try {
              passesCondition = conditionFn(data);
            } catch(e) {
              reject(e);
            }
            if (passesCondition) {
              resolve(data);
              clearInterval(intervalHandle);
            }
          }).catch((err)=>{
            reject(err);
            clearInterval(intervalHandle);
          })
        }, interval)
      })
    }
  }
}

function getCeTaskUrl(sonarWorkingDir){
  let lines = fs.readFileSync(Path.join(sonarWorkingDir, "report-task.txt"), "utf-8").split("\n");
  for ( let i in lines ){
    let line = lines[i];
    if ( line.startsWith('ceTaskUrl=') ){
      return line.substring('ceTaskUrl='.length);
    }
  }
  return null;
}

function getQualityGateUrl(sonarWorkingDir, ceTask){
  let analysisId = null;
  if ( ceTask['analysisId'] ){
    analysisId = ceTask['analysisId'];
  }else{
    analysisId = ceTask['id'];
  }

  let lines = fs.readFileSync(Path.join(sonarWorkingDir, "report-task.txt"), "utf-8").split("\n");
  let projectKey = null;
  let serverUrl = null;
  for ( let i in lines ){
    let line = lines[i];
    if ( line.startsWith('serverUrl=') ){
      serverUrl = line.substring('serverUrl='.length);
    }else if ( line.startsWith('projectKey=') ){
      projectKey = line.substring('projectKey='.length);
    }
    if ( serverUrl && projectKey ){
      break;
    }
  }
  if ( serverUrl && projectKey ){
    return serverUrl + "/api/qualitygates/project_status?analysisId=" + analysisId;
  }
  return null;
}

export function pollQualityGate(end, sonarWorkingDir, interval, resolve, reject){
  let url = getCeTaskUrl(sonarWorkingDir);
  if ( !url ){
    reject("ceTaskUrl not found");
  }
  poll(function(){ 
    return new Promise((resolve, reject)=>{
      request(url, function(error, response, body){
          if ( error ){
            return reject(error);
          }
          let json = JSON.parse(body);
          if ( json.errors ){
            reject(json.errors[0].msg)
          }
          resolve(json.task)
      })
    });
  }, interval)
  .until(data => {
    return (data.status !== 'IN_PROGRESS' && data.status !== 'PENDING') || new Date().getTime() >= end
  })
  .then((ceTask)=>{
    let qgurl = getQualityGateUrl(sonarWorkingDir, ceTask);
    if ( !qgurl ){
      reject("qualityGate url not found");
    }
    //fetch quality gate...
    request(qgurl, function(error, response, body){
      if ( error ){
        return reject(error);
      }
      let json = JSON.parse(body);
      if ( json.errors ){
        reject(json.errors[0].msg)
      }
      resolve(json.projectStatus)
    })
  })
  .catch(reject)
}
