// Highly inspired from https://github.com/redhat-developer/vscode-java/blob/1f6783957c699e261a33d05702f2da356017458d/src/requirements.ts
'use strict';

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const isWindows = process.platform.indexOf('win') === 0;
const JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');

export interface RequirementsData {
    javaHome: string;
    javaVersion: number;
}

/**
 * Resolves the requirements needed to run the extension.
 * Returns a promise that will resolve to a RequirementsData if
 * all requirements are resolved
 *
 */
export async function resolveRequirements(javaHomeConfig): Promise<RequirementsData> {
    const javaHome = await checkJavaRuntime(javaHomeConfig);
    const javaVersion = await checkJavaVersion(javaHome);
    return Promise.resolve({javaHome, javaVersion});
}

function checkJavaRuntime(javaHome: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let source: string;
        if (javaHome) {
            source = 'The --javahome setting specified';
        } else {
            javaHome = process.env['JDK_HOME'];
            if (javaHome) {
                source = 'The JDK_HOME environment variable';
            } else {
                javaHome = process.env['JAVA_HOME'];
                source = 'The JAVA_HOME environment variable';
            }
        }
        if (javaHome) {
            javaHome = require('expand-home-dir')(javaHome);
            if (!fs.existsSync(javaHome)) {
                openJDKDownload(reject, source + ' points to a missing folder');
            }
            if (!fs.existsSync(path.resolve(javaHome, 'bin', JAVAC_FILENAME))) {
                openJDKDownload(reject, source + ' does not point to a JDK.');
            }
            return resolve(javaHome);
        }
        // No settings, let's try to detect as last resort.
        require('find-java-home')((err, home) => {
            if (err) {
                openJDKDownload(reject, 'Java runtime could not be located');
            } else {
                resolve(home);
            }
        });
    });
}

function checkJavaVersion(javaHome: string): Promise<number> {
    return new Promise((resolve, reject) => {
        cp.execFile(javaHome + '/bin/java', ['-version'], {}, (error, stdout, stderr) => {
            const javaVersion = parseMajorVersion(stderr);
            if (javaVersion < 8) {
                openJDKDownload(reject, 'Java 8 or more recent is required to run. Please download and install a recent JDK');
            } else {
                resolve(javaVersion);
            }
        });
    });
}

function parseMajorVersion(content: string): number {
    let regexp = /version "(.*)"/g;
    let match = regexp.exec(content);
    if (!match) {
        return 0;
    }
    let version = match[1];
    // Ignore '1.' prefix for legacy Java versions
    if (version.startsWith('1.')) {
        version = version.substring(2);
    }

    // look into the interesting bits now
    regexp = /\d+/g;
    match = regexp.exec(version);
    let javaVersion = 0;
    if (match) {
        javaVersion = parseInt(match[0], 10);
    }
    return javaVersion;
}

function openJDKDownload(reject, cause) {
    let jdkUrl = 'https://developers.redhat.com/products/openjdk/download/?sc_cid=701f2000000RWTnAAO';
    if (process.platform === 'darwin') {
        jdkUrl = 'http://www.oracle.com/technetwork/java/javase/downloads/index.html';
    }
    reject({
        message: cause + ': Get the Java Development Kit: ' + jdkUrl
    });
}
