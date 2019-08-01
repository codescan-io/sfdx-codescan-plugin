import { expect, test } from '@salesforce/command/lib/test';

describe('codescan:run', () => {
  test
    .stdout()
    .command(['codescan:run', '--organization', 'test', '-Dsonar.projectKey', '-Dsonar.host.url=http://localhost:9999', '--nofail'])
    .it('runs codescan:run', ctx => {
      expect(ctx.stdout).to.contain('EXECUTION FAILURE');
    });
});
